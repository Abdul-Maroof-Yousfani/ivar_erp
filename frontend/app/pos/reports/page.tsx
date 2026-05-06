"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { ColumnDef, PaginationState } from "@tanstack/react-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Banknote,
  CreditCard,
  Building2,
  Ticket,
  BookOpen,
  Users,
  Package,
  BarChart3,
  Download,
  RefreshCw,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  Tag,
  Percent,
  Calendar,
  Filter,
  X,
  Info,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import DataTable from "@/components/common/data-table";
import { DateRangePicker, DateRange } from "@/components/ui/date-range-picker";
import { cn, formatCurrency } from "@/lib/utils";
import { authFetch } from "@/lib/auth";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ReportSummary {
  totalOrders: number;
  totalRevenue: number;
  totalSubtotal: number;
  totalDiscount: number;
  totalTax: number;
  totalCash: number;
  totalCard: number;
  totalVoucher: number;
  avgOrderValue: number;
  discountedOrders: number;
  totalDiscountGiven: number;
}

interface PaymentBreakdown {
  method: string;
  total: number;
  count: number;
}

interface StatusBreakdown {
  status: string;
  total: number;
  count: number;
}

interface TrendPoint {
  key: string;
  label: string;
  sales: number;
  orders: number;
  returns: number;
}

interface TopItem {
  itemId: string;
  description: string;
  sku: string;
  barCode: string;
  qtySold: number;
  revenue: number;
  discountGiven: number;
  orderCount: number;
}

interface CashierStat {
  cashierUserId: string;
  name: string;
  email: string;
  totalSales: number;
  totalDiscount: number;
  orderCount: number;
  avgOrderValue: number;
}

interface ReportOrder {
  id: string;
  orderNumber: string;
  createdAt: string;
  grandTotal: string | number;
  subtotal: string | number;
  discountAmount: string | number;
  taxAmount: string | number;
  status: string;
  paymentMethod: string | null;
  tenderType: string | null;
  cashAmount: string | number | null;
  cardAmount: string | number | null;
  cashierName: string;
  items: { id: string }[];
  promo: { name: string; code: string } | null;
  coupon: { code: string } | null;
  alliance: { partnerName: string; code: string } | null;
}

interface ReportData {
  summary: ReportSummary;
  paymentBreakdown: PaymentBreakdown[];
  statusBreakdown: StatusBreakdown[];
  trend: TrendPoint[];
  topItems: TopItem[];
  cashierStats: CashierStat[];
  orders: ReportOrder[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(val: number | string | null | undefined) {
  return formatCurrency(Number(val ?? 0));
}

function fmtNum(val: number) {
  return val.toLocaleString("en-PK");
}

const STATUS_BADGE: Record<string, string> = {
  completed: "bg-emerald-500/10 text-emerald-700 border-emerald-300",
  voided: "bg-destructive/10 text-destructive border-destructive/30",
  partially_returned: "bg-blue-500/10 text-blue-700 border-blue-300",
  refunded: "bg-purple-500/10 text-purple-700 border-purple-300",
  exchanged: "bg-cyan-500/10 text-cyan-700 border-cyan-300",
  hold: "bg-amber-500/10 text-amber-700 border-amber-300",
};

const PAYMENT_ICONS: Record<string, React.ElementType> = {
  cash: Banknote,
  card: CreditCard,
  bank_transfer: Building2,
  voucher: Ticket,
  credit_account: BookOpen,
  split: BarChart3,
};

const PAYMENT_COLORS: Record<string, string> = {
  cash: "text-emerald-600",
  card: "text-blue-600",
  bank_transfer: "text-violet-600",
  voucher: "text-amber-600",
  credit_account: "text-rose-600",
  split: "text-slate-600",
};

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  sub,
  icon: Icon,
  trend,
  color = "default",
  tooltip,
}: {
  title: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
  color?: "default" | "green" | "blue" | "amber" | "red" | "purple";
  tooltip?: string;
}) {
  const colorMap: Record<string, { icon: string; glow: string; bar: string }> = {
    default: { icon: "bg-muted/60 text-foreground", glow: "", bar: "bg-foreground/20" },
    green:   { icon: "bg-emerald-500/15 text-emerald-500", glow: "shadow-emerald-500/10", bar: "bg-emerald-500/40" },
    blue:    { icon: "bg-blue-500/15 text-blue-500", glow: "shadow-blue-500/10", bar: "bg-blue-500/40" },
    amber:   { icon: "bg-amber-500/15 text-amber-500", glow: "shadow-amber-500/10", bar: "bg-amber-500/40" },
    red:     { icon: "bg-destructive/15 text-destructive", glow: "shadow-destructive/10", bar: "bg-destructive/40" },
    purple:  { icon: "bg-purple-500/15 text-purple-500", glow: "shadow-purple-500/10", bar: "bg-purple-500/40" },
  };

  const c = colorMap[color];

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Card className={cn("relative overflow-hidden transition-all hover:shadow-md cursor-default py-4!", c.glow)}>
            {/* subtle accent bar on top */}
            <div className={cn("absolute top-0 left-0 right-0 h-0.5", c.bar)} />
            <CardContent className="p-3 pt-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1 leading-none">
                    {title}
                    {tooltip && <Info className="h-2.5 w-2.5 opacity-50 shrink-0" />}
                  </p>
                  <p className="text-sm font-bold mt-1 leading-tight break-all">{value}</p>
                  {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
                </div>
                <div className={cn("rounded-lg p-2 shrink-0", c.icon)}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
              </div>
              {trend && (
                <div className={cn("flex items-center gap-1 mt-1.5 text-xs font-medium",
                  trend === "up" ? "text-emerald-500" : trend === "down" ? "text-destructive" : "text-muted-foreground")}>
                  {trend === "up" ? <ArrowUpRight className="h-3 w-3" /> : trend === "down" ? <ArrowDownRight className="h-3 w-3" /> : null}
                </div>
              )}
            </CardContent>
          </Card>
        </TooltipTrigger>
        {tooltip && (
          <TooltipContent side="bottom" className="max-w-[200px] text-xs">
            {tooltip}
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}

// ─── Mini bar chart (pure CSS) ────────────────────────────────────────────────

function MiniBarChart({ data, maxVal }: { data: TrendPoint[]; maxVal: number }) {
  if (!data.length) return <div className="text-xs text-muted-foreground text-center py-8">No data</div>;
  return (
    <div className="relative h-24 w-full flex items-end gap-0.5">
      {data.map((d) => {
        const pct = maxVal > 0 ? Math.max((d.sales / maxVal) * 100, 2) : 2;
        return (
          <div
            key={d.key}
            className="group relative flex-1 min-w-0 rounded-t bg-primary/60 hover:bg-primary transition-colors cursor-default"
            style={{ height: `${pct}%` }}
          >
            {/* Hover tooltip */}
            <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10 pointer-events-none">
              <div className="bg-popover border rounded shadow-md px-2 py-1 text-[10px] whitespace-nowrap">
                <div className="font-semibold">{d.label}</div>
                <div>{fmt(d.sales)}</div>
                <div className="text-muted-foreground">{d.orders} orders</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SalesReportPage() {
  // ── Default date range: first day of current month → today ──
  const defaultFrom = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const defaultTo = new Date();

  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  const [filters, setFilters] = useState({
    dateRange: { from: defaultFrom, to: defaultTo } as DateRange,
    status: "all",
    paymentMethod: "all",
    groupBy: "day",
    search: "",
  });

  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 20,
  });

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.dateRange?.from)
        params.set("startDate", filters.dateRange.from.toISOString().split("T")[0]);
      if (filters.dateRange?.to)
        params.set("endDate", filters.dateRange.to.toISOString().split("T")[0]);
      if (filters.status !== "all") params.set("status", filters.status);
      if (filters.paymentMethod !== "all") params.set("paymentMethod", filters.paymentMethod);
      params.set("groupBy", filters.groupBy);
      params.set("page", String(pagination.pageIndex + 1));
      params.set("limit", String(pagination.pageSize));
      if (filters.search) params.set("search", filters.search);

      const res = await authFetch(`/pos-sales/reports/sales?${params.toString()}`);
      if (res.ok && res.data?.status) {
        setReportData(res.data.data);
      } else {
        toast.error(res.data?.message || "Failed to load report data");
      }
    } catch {
      toast.error("Failed to load report data");
    } finally {
      setIsLoading(false);
    }
  }, [filters, pagination]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // ── Export CSV ─────────────────────────────────────────────────────────────
  const exportCSV = useCallback(() => {
    if (!reportData?.orders?.length) {
      toast.error("No orders to export");
      return;
    }
    const headers = [
      "Order #",
      "Date",
      "Cashier",
      "Items",
      "Subtotal",
      "Discount",
      "Tax",
      "Grand Total",
      "Payment Method",
      "Status",
    ];
    const rows = reportData.orders.map((o) => [
      o.orderNumber,
      new Date(o.createdAt).toLocaleString("en-PK"),
      o.cashierName,
      String(o.items?.length ?? 0),
      String(Number(o.subtotal ?? 0).toFixed(2)),
      String(Number(o.discountAmount ?? 0).toFixed(2)),
      String(Number(o.taxAmount ?? 0).toFixed(2)),
      String(Number(o.grandTotal ?? 0).toFixed(2)),
      o.tenderType ?? o.paymentMethod ?? "",
      o.status,
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported");
  }, [reportData]);

  // ── Columns: Orders ────────────────────────────────────────────────────────
  const orderColumns = useMemo<ColumnDef<ReportOrder>[]>(
    () => [
      {
        accessorKey: "orderNumber",
        header: "Order #",
        cell: ({ row }) => (
          <span className="font-mono text-xs font-semibold">{row.original.orderNumber}</span>
        ),
      },
      {
        accessorKey: "createdAt",
        header: "Date / Time",
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {new Date(row.original.createdAt).toLocaleString("en-PK", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        ),
      },
      {
        accessorKey: "cashierName",
        header: "Cashier",
        cell: ({ row }) => <span className="text-xs">{row.original.cashierName}</span>,
      },
      {
        accessorKey: "items",
        header: "Items",
        cell: ({ row }) => (
          <span className="text-xs text-center block">{row.original.items?.length ?? 0}</span>
        ),
      },
      {
        accessorKey: "subtotal",
        header: "Subtotal",
        cell: ({ row }) => <span className="text-xs">{fmt(row.original.subtotal)}</span>,
      },
      {
        accessorKey: "discountAmount",
        header: "Discount",
        cell: ({ row }) => (
          <span className="text-xs text-amber-600">{fmt(row.original.discountAmount)}</span>
        ),
      },
      {
        accessorKey: "taxAmount",
        header: "Tax",
        cell: ({ row }) => <span className="text-xs">{fmt(row.original.taxAmount)}</span>,
      },
      {
        accessorKey: "grandTotal",
        header: "Grand Total",
        cell: ({ row }) => (
          <span className="text-xs font-semibold">{fmt(row.original.grandTotal)}</span>
        ),
      },
      {
        accessorKey: "tenderType",
        header: "Payment",
        cell: ({ row }) => {
          const method = row.original.tenderType ?? row.original.paymentMethod ?? "—";
          const Icon = PAYMENT_ICONS[method] ?? Receipt;
          return (
            <div className={cn("flex items-center gap-1 text-xs capitalize", PAYMENT_COLORS[method])}>
              <Icon className="h-3 w-3" />
              {method.replace(/_/g, " ")}
            </div>
          );
        },
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge
            variant="outline"
            className={cn("text-[10px] px-1.5 py-0", STATUS_BADGE[row.original.status])}
          >
            {row.original.status.replace(/_/g, " ")}
          </Badge>
        ),
      },
    ],
    []
  );

  // ── Derived values ─────────────────────────────────────────────────────────
  const summary = reportData?.summary;
  const trendMax = useMemo(
    () => Math.max(...(reportData?.trend?.map((t) => t.sales) ?? [0]), 1),
    [reportData?.trend]
  );

  const totalPayments = useMemo(
    () => reportData?.paymentBreakdown?.reduce((s, p) => s + p.total, 0) ?? 0,
    [reportData?.paymentBreakdown]
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-4 p-4 md:p-6 min-h-screen">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sales Report</h1>
          <p className="text-sm text-muted-foreground">
            Comprehensive sales analytics and performance metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={isLoading}>
            <Download className="h-4 w-4 mr-1.5" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={fetchReport} disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* ── Filters ── */}
      <Card className="py-0!">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            {/* Date Range */}
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Date Range</Label>
              <DateRangePicker
                initialDateFrom={filters.dateRange?.from}
                initialDateTo={filters.dateRange?.to}
                onUpdate={({ range }) =>
                  setFilters((f) => ({ ...f, dateRange: range ?? { from: defaultFrom, to: defaultTo } }))
                }
                isPreset
              />
            </div>

            {/* Status */}
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select
                value={filters.status}
                onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}
              >
                <SelectTrigger className="w-[160px] h-9 text-sm">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="voided">Voided</SelectItem>
                  <SelectItem value="partially_returned">Partially Returned</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                  <SelectItem value="exchanged">Exchanged</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Payment Method */}
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Payment Method</Label>
              <Select
                value={filters.paymentMethod}
                onValueChange={(v) => setFilters((f) => ({ ...f, paymentMethod: v }))}
              >
                <SelectTrigger className="w-[160px] h-9 text-sm">
                  <SelectValue placeholder="All Methods" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="voucher">Voucher</SelectItem>
                  <SelectItem value="credit_account">Credit Account</SelectItem>
                  <SelectItem value="split">Split</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Group By */}
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Trend By</Label>
              <Select
                value={filters.groupBy}
                onValueChange={(v) => setFilters((f) => ({ ...f, groupBy: v }))}
              >
                <SelectTrigger className="w-[120px] h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Day</SelectItem>
                  <SelectItem value="week">Week</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
              <Label className="text-xs text-muted-foreground">Order Number</Label>
              <Input
                placeholder="Search order #..."
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  setPagination((p) => ({ ...p, pageIndex: 0 }));
                  fetchReport();
                }}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Filter className="h-4 w-4 mr-1.5" />}
                Apply
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setFilters({
                    dateRange: { from: defaultFrom, to: defaultTo },
                    status: "all",
                    paymentMethod: "all",
                    groupBy: "day",
                    search: "",
                  });
                  setPagination({ pageIndex: 0, pageSize: 20 });
                }}
              >
                <X className="h-4 w-4 mr-1.5" />
                Reset
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Loading overlay ── */}
      {isLoading && !reportData && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* ── Tabs ── */}
      {(reportData || isLoading) && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col gap-4">
          <TabsList className="w-fit">
            <TabsTrigger value="overview">
              <BarChart3 className="h-4 w-4 mr-1.5" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="top-items" className="w-52">
              <Package className="h-4 w-4 mr-1.5" />
              Top Items
            </TabsTrigger>
            <TabsTrigger value="cashiers">
              <Users className="h-4 w-4 mr-1.5" />
              Cashiers
            </TabsTrigger>
            <TabsTrigger value="orders">
              <Receipt className="h-4 w-4 mr-1.5" />
              Orders
            </TabsTrigger>
          </TabsList>

          {/* ══ OVERVIEW TAB ══ */}
          <TabsContent value="overview" className="flex flex-col gap-4 mt-0">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard
                title="Total Revenue"
                value={fmt(summary?.totalRevenue)}
                icon={TrendingUp}
                color="green"
                tooltip="Sum of all completed order grand totals in the selected period"
              />
              <StatCard
                title="Total Orders"
                value={fmtNum(summary?.totalOrders ?? 0)}
                icon={ShoppingCart}
                color="blue"
                tooltip="Total number of orders placed, including all statuses"
              />
              <StatCard
                title="Avg Order Value"
                value={fmt(summary?.avgOrderValue)}
                icon={Receipt}
                color="default"
                tooltip="Average grand total per order (Total Revenue ÷ Total Orders)"
              />
              <StatCard
                title="Total Discount"
                value={fmt(summary?.totalDiscount)}
                icon={Tag}
                color="amber"
                tooltip="Total discount amount applied across all orders"
              />
              <StatCard
                title="Total Tax"
                value={fmt(summary?.totalTax)}
                icon={Percent}
                color="purple"
                tooltip="Total tax collected across all orders in the selected period"
              />

              {/* Cash vs Card card */}
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Card className="relative overflow-hidden transition-all hover:shadow-md cursor-default">
                      <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-emerald-500/50 via-blue-500/50 to-emerald-500/10" />
                      <CardContent className="p-3 pt-3.5">
                        <p className="text-[11px] font-medium text-muted-foreground flex items-center gap-1 leading-none mb-2">
                          Cash vs Card
                          <Info className="h-2.5 w-2.5 opacity-50 shrink-0" />
                        </p>
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1 text-[11px] text-emerald-500 font-medium shrink-0">
                              <span className="rounded bg-emerald-500/15 p-0.5"><Banknote className="h-2.5 w-2.5" /></span>
                              Cash
                            </span>
                            <span className="text-xs font-bold text-right break-all">{fmt(summary?.totalCash)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1 text-[11px] text-blue-500 font-medium shrink-0">
                              <span className="rounded bg-blue-500/15 p-0.5"><CreditCard className="h-2.5 w-2.5" /></span>
                              Card
                            </span>
                            <span className="text-xs font-bold text-right break-all">{fmt(summary?.totalCard)}</span>
                          </div>
                          {/* mini split bar */}
                          {((summary?.totalCash ?? 0) + (summary?.totalCard ?? 0)) > 0 && (() => {
                            const total = (summary?.totalCash ?? 0) + (summary?.totalCard ?? 0);
                            const cashPct = ((summary?.totalCash ?? 0) / total) * 100;
                            return (
                              <div className="h-1 rounded-full bg-muted overflow-hidden mt-0.5">
                                <div
                                  className="h-full rounded-full bg-emerald-500/60 transition-all"
                                  style={{ width: `${cashPct.toFixed(1)}%` }}
                                />
                              </div>
                            );
                          })()}
                        </div>
                      </CardContent>
                    </Card>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[200px] text-xs">
                    Breakdown of cash vs card payments. The bar shows cash proportion of the two.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Payment Breakdown */}
              <Card className="py-0!">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold">Payment Method Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {!reportData?.paymentBreakdown?.length ? (
                    <p className="text-xs text-muted-foreground text-center py-6">No data</p>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {reportData.paymentBreakdown.map((p) => {
                        const Icon = PAYMENT_ICONS[p.method] ?? BarChart3;
                        const pct = totalPayments > 0 ? (p.total / totalPayments) * 100 : 0;
                        return (
                          <div key={p.method} className="flex flex-col gap-1">
                            <div className="flex items-center justify-between text-xs">
                              <span
                                className={cn(
                                  "flex items-center gap-1.5 font-medium capitalize",
                                  PAYMENT_COLORS[p.method]
                                )}
                              >
                                <Icon className="h-3.5 w-3.5" />
                                {p.method.replace(/_/g, " ")}
                              </span>
                              <div className="flex items-center gap-3 text-right">
                                <span className="text-muted-foreground">{fmtNum(p.count)} orders</span>
                                <span className="font-semibold w-24 text-right">{fmt(p.total)}</span>
                              </div>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary/60 transition-all"
                                style={{ width: `${pct.toFixed(1)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Status Breakdown */}
              <Card className="py-0!">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-semibold">Status Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4">
                  {!reportData?.statusBreakdown?.length ? (
                    <p className="text-xs text-muted-foreground text-center py-6">No data</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs text-right">Orders</TableHead>
                          <TableHead className="text-xs text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reportData.statusBreakdown.map((s) => (
                          <TableRow key={s.status}>
                            <TableCell className="py-2">
                              <Badge
                                variant="outline"
                                className={cn("text-[10px] px-1.5 py-0", STATUS_BADGE[s.status])}
                              >
                                {s.status.replace(/_/g, " ")}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2 text-right text-xs">
                              {fmtNum(s.count)}
                            </TableCell>
                            <TableCell className="py-2 text-right text-xs font-medium">
                              {fmt(s.total)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sales Trend */}
            <Card className="py-0!">
              <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm font-semibold">
                    Sales Trend
                    <span className="ml-2 text-xs font-normal text-muted-foreground capitalize">
                      by {filters.groupBy}
                    </span>
                  </CardTitle>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>
                      <span className="font-semibold text-foreground">
                        {fmtNum(reportData?.trend?.reduce((s, t) => s + t.orders, 0) ?? 0)}
                      </span>{" "}
                      orders
                    </span>
                    <Separator orientation="vertical" className="h-4" />
                    <span>
                      <span className="font-semibold text-foreground">
                        {fmt(reportData?.trend?.reduce((s, t) => s + t.sales, 0) ?? 0)}
                      </span>{" "}
                      revenue
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <MiniBarChart data={reportData?.trend ?? []} maxVal={trendMax} />
                {/* X-axis labels */}
                {(reportData?.trend?.length ?? 0) > 0 && (
                  <div className="flex gap-0.5 mt-1">
                    {reportData!.trend.map((d) => (
                      <div
                        key={d.key}
                        className="flex-1 text-center text-[9px] text-muted-foreground truncate"
                      >
                        {d.label}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══ TOP ITEMS TAB ══ */}
          <TabsContent value="top-items" className="mt-0">
            <Card className="py-0!">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold">Top 10 Items by Revenue</CardTitle>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                {!reportData?.topItems?.length ? (
                  <p className="text-xs text-muted-foreground text-center py-10">No data</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs w-10 pl-4">#</TableHead>
                        <TableHead className="text-xs">Item Description</TableHead>
                        <TableHead className="text-xs">SKU</TableHead>
                        <TableHead className="text-xs text-right">Qty Sold</TableHead>
                        <TableHead className="text-xs text-right">Revenue</TableHead>
                        <TableHead className="text-xs text-right">Discount</TableHead>
                        <TableHead className="text-xs text-right pr-4">Orders</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.topItems
                        .slice()
                        .sort((a, b) => b.revenue - a.revenue)
                        .map((item, idx) => (
                          <TableRow key={item.itemId}>
                            <TableCell className="py-2 pl-4 text-xs text-muted-foreground font-mono">
                              {idx + 1}
                            </TableCell>
                            <TableCell className="py-2 text-xs font-medium max-w-[200px] truncate">
                              {item.description}
                            </TableCell>
                            <TableCell className="py-2 text-xs font-mono text-muted-foreground">
                              {item.sku || item.barCode || "—"}
                            </TableCell>
                            <TableCell className="py-2 text-xs text-right">
                              {fmtNum(item.qtySold)}
                            </TableCell>
                            <TableCell className="py-2 text-xs text-right font-semibold">
                              {fmt(item.revenue)}
                            </TableCell>
                            <TableCell className="py-2 text-xs text-right text-amber-600">
                              {fmt(item.discountGiven)}
                            </TableCell>
                            <TableCell className="py-2 text-xs text-right pr-4">
                              {fmtNum(item.orderCount)}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══ CASHIERS TAB ══ */}
          <TabsContent value="cashiers" className="mt-0">
            <Card className="py-0!">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold">Cashier Performance</CardTitle>
              </CardHeader>
              <CardContent className="px-0 pb-0">
                {!reportData?.cashierStats?.length ? (
                  <p className="text-xs text-muted-foreground text-center py-10">No data</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs pl-4">Cashier Name</TableHead>
                        <TableHead className="text-xs text-right">Orders</TableHead>
                        <TableHead className="text-xs text-right">Total Sales</TableHead>
                        <TableHead className="text-xs text-right">Avg Order</TableHead>
                        <TableHead className="text-xs text-right pr-4">Discount Given</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {reportData.cashierStats
                        .slice()
                        .sort((a, b) => b.totalSales - a.totalSales)
                        .map((c) => (
                          <TableRow key={c.cashierUserId}>
                            <TableCell className="py-2 pl-4">
                              <div className="flex flex-col">
                                <span className="text-xs font-medium">{c.name}</span>
                                <span className="text-[10px] text-muted-foreground">{c.email}</span>
                              </div>
                            </TableCell>
                            <TableCell className="py-2 text-xs text-right">
                              {fmtNum(c.orderCount)}
                            </TableCell>
                            <TableCell className="py-2 text-xs text-right font-semibold">
                              {fmt(c.totalSales)}
                            </TableCell>
                            <TableCell className="py-2 text-xs text-right">
                              {fmt(c.avgOrderValue)}
                            </TableCell>
                            <TableCell className="py-2 text-xs text-right text-amber-600 pr-4">
                              {fmt(c.totalDiscount)}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══ ORDERS TAB ══ */}
          <TabsContent value="orders" className="mt-0">
            <DataTable
              columns={orderColumns}
              data={(reportData?.orders ?? []) as (ReportOrder & { id: string })[]}
              title="Orders"
              isLoading={isLoading}
              manualPagination
              rowCount={reportData?.meta?.total ?? 0}
              pageCount={reportData?.meta?.totalPages ?? 1}
              onPaginationChange={(p) => setPagination(p)}
            />
          </TabsContent>
        </Tabs>
      )}

      {/* ── Empty state ── */}
      {!isLoading && !reportData && (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
          <BarChart3 className="h-12 w-12 opacity-30" />
          <p className="text-sm">Apply filters and click Apply to load report data.</p>
        </div>
      )}
    </div>
  );
}
