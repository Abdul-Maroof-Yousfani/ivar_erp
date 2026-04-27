"use client"
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { PermissionGuard } from "@/components/auth/permission-guard";
import {
  Users,
  DollarSign,
  Package,
  ShoppingCart,
  ArrowUpRight,
  ArrowDownRight,
  Filter,
  Calendar,
  Download,
  Search,
  LayoutDashboard,
  BarChart3,
  RefreshCcw,
  Layers,
  ChevronRight,
  TrendingUp,
  Loader2,
  Zap,
  Target,
  BrainCircuit,
  Activity,
  PieChart as PieChartIcon
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { 
  Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  Cell, PieChart, Pie, Line, LineChart as ReLineChart, 
  Area, AreaChart, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Scatter, ScatterChart, ZAxis
} from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import { authFetch } from "@/lib/auth";
import { stockLedgerApi } from "@/lib/api";
import { toast } from "sonner";



const dayMap = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const hourMap = ['08:00', '10:00', '12:00', '14:00', '16:00'];



// --- Internal Components ---

function StatsCard({
  title,
  value,
  icon: Icon,
  description,
  trend,
  trendType,
  highlight,
  loading,
  subValue
}: {
  title: string,
  value: string | number,
  icon: any,
  description: string,
  trend?: string,
  trendType?: 'up' | 'down' | 'neutral',
  highlight?: boolean,
  loading?: boolean,
  subValue?: string
}) {
  return (
    <Card className={cn(
      "group relative overflow-hidden transition-all duration-300 hover:border-primary/30",
      highlight && "border-primary/50 bg-primary/5"
    )}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-bold text-muted-foreground group-hover:text-primary transition-colors">
          {title}
        </CardTitle>
        <div className={cn(
          "p-2 rounded-lg transition-all duration-300 group-hover:scale-110",
          highlight ? "bg-primary text-primary-foreground shadow-md" : "bg-muted/50 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
        )}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-9 w-24 bg-muted animate-pulse rounded" />
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-black tracking-tight">{value}</div>
              {trend && (
                <div className={cn(
                  "flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                  trendType === 'up' ? "text-green-600 bg-green-50" : trendType === 'down' ? "text-red-600 bg-red-50" : "text-blue-600 bg-blue-50"
                )}>
                  {trendType === 'up' ? <ArrowUpRight className="h-3 w-3" /> : trendType === 'down' ? <ArrowDownRight className="h-3 w-3" /> : <Activity className="h-3 w-3" />}
                  {trend}
                </div>
              )}
            </div>
            {subValue && <div className="text-xs font-bold text-primary/70 mt-0.5">{subValue}</div>}
          </>
        )}
        <p className="text-[11px] text-muted-foreground font-medium mt-1 leading-none opacity-80">
          {description}
        </p>
      </CardContent>
      <div className="absolute inset-x-0 bottom-0 h-[2px] bg-primary opacity-0 group-hover:opacity-100 transition-opacity" />
    </Card>
  );
}

const ERPDashboard = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [orders, setOrders] = useState<any[]>([]);
  const [stockLevels, setStockLevels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { hasPermission } = useAuth();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const fetches: Promise<any>[] = [];
      const canViewOverview = hasPermission("erp.dashboard.overview.view");
      const canViewInventory = hasPermission("erp.dashboard.inventory.view");

      const [ordersRes, stockRes] = await Promise.all([
        canViewOverview
          ? authFetch("/pos-sales/orders", { params: { limit: 1000 } })
          : Promise.resolve(null),
        canViewInventory
          ? stockLedgerApi.getLevels()
          : Promise.resolve(null),
      ]);

      if (ordersRes?.ok && ordersRes.data?.status) {
        setOrders(ordersRes.data.data || []);
      }
      if (stockRes) {
        setStockLevels(stockRes || []);
      }
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }, [hasPermission]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Derived Data ---

  const kpis = useMemo(() => {
    const hasOrders = orders.length > 0;
    const hasStock = stockLevels.length > 0;

    const totalRevenue = hasOrders 
      ? orders.reduce((sum, order) => sum + Number(order.grandTotal || 0), 0)
      : 0;

    const activeUsers = hasOrders 
      ? new Set(orders.map(o => o.customerId).filter(Boolean)).size
      : 0;

    const totalOrders = hasOrders ? orders.length : 0;

    const inventoryValue = hasStock 
      ? stockLevels.reduce((sum, level) => sum + (Number(level.totalQty || 0) * 0), 0)
      : 0;

    return {
      totalRevenue: `PKR ${totalRevenue.toLocaleString('en-PK', { maximumFractionDigits: 0 })}`,
      activeUsers: activeUsers.toLocaleString(),
      inventoryValue: `PKR ${inventoryValue.toLocaleString('en-PK')}`,
      totalOrders: totalOrders.toLocaleString(),
      inventoryCount: hasStock ? stockLevels.length : 0
    };
  }, [orders, stockLevels]);

  const revenueTrendData = useMemo(() => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    const result: { label: string, revenue: number, profit: number }[] = [];

    // If no orders, return empty trend
    if (orders.length === 0 && !loading) {
       return [];
    }

    const monthlyData: Record<string, { label: string, revenue: number, profit: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = months[d.getMonth()];
      monthlyData[label] = { label, revenue: 0, profit: 0 };
    }

    orders.forEach(order => {
      const d = new Date(order.createdAt);
      const label = months[d.getMonth()];
      if (monthlyData[label]) {
        monthlyData[label].revenue += Number(order.grandTotal || 0);
        monthlyData[label].profit += Number(order.grandTotal || 0) * 0.25;
      }
    });

    return Object.values(monthlyData);
  }, [orders, loading]);

  const categoryAggregation = useMemo(() => {
    const colors = [
      "var(--primary)",
      "oklch(0.6721 0.1944 294.4928)",
      "oklch(0.8003 0.1821 151.7110)",
      "oklch(0.7106 0.1661 22.2162)",
      "oklch(0.8077 0.1035 19.5706)"
    ];

    if (orders.length === 0 && !loading) {
      return [];
    }

    const counts: Record<string, number> = {};
    orders.forEach(order => {
      order.items?.forEach((line: any) => {
        const cat = line.item?.category?.name || "Uncategorized";
        counts[cat] = (counts[cat] || 0) + Number(line.lineTotal || 0);
      });
    });

    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return Object.entries(counts)
      .map(([name, value], i) => ({
        name,
        value: Math.round((value / (total || 1)) * 100),
        color: colors[i % colors.length]
      }))
      .sort((a, b) => b.value - a.value);
  }, [orders, loading]);

  const recentTransactions = useMemo(() => {
    if (orders.length === 0 && !loading) return [];
    return orders.slice(0, 5).map(order => ({
      id: order.orderNumber,
      name: `Sale - ${order.orderNumber}`,
      cat: order.items?.[0]?.item?.category?.name || "POS Sale",
      val: `PKR ${Number(order.grandTotal).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }));
  }, [orders, loading]);

  // ── Analytics Tab: derived from real orders ──────────────────────────────

  const funnelData = useMemo(() => {
    const total = orders.length;
    const completed = orders.filter(o => o.status === 'completed').length;
    const held = orders.filter(o => o.status === 'hold').length;
    const withCustomer = orders.filter(o => o.customerId).length;
    const multiItem = orders.filter(o => (o.items?.length || 0) > 1).length;

    return [
      { stage: 'Total Orders',     value: total,                                          fill: "var(--primary)" },
      { stage: 'With Customer',    value: withCustomer,                                   fill: "oklch(0.6721 0.1944 294.4928)" },
      { stage: 'Multi-Item',       value: multiItem,                                      fill: "oklch(0.8003 0.1821 151.7110)" },
      { stage: 'Completed',        value: completed,                                      fill: "oklch(0.7106 0.1661 22.2162)" },
      { stage: 'Held / Pending',   value: held,                                           fill: "#10b981" },
    ];
  }, [orders]);

  const activityData = useMemo(() => {
    // Build a 7-day × 5-hour intensity matrix from real order timestamps
    const matrix: Record<string, number> = {};
    const hourBuckets = [8, 10, 12, 14, 16];
    const hourLabels = ['08:00', '10:00', '12:00', '14:00', '16:00'];

    orders.forEach(order => {
      const d = new Date(order.createdAt);
      const dayIdx = d.getDay() === 0 ? 6 : d.getDay() - 1; // Mon=0..Sun=6
      const h = d.getHours();
      const hourIdx = hourBuckets.reduce((best, bh, i) => Math.abs(h - bh) < Math.abs(h - hourBuckets[best]) ? i : best, 0);
      const key = `${dayIdx}-${hourIdx}`;
      matrix[key] = (matrix[key] || 0) + 1;
    });

    if (orders.length === 0) {
      return [];
    }

    const maxCount = Math.max(...Object.values(matrix), 1);
    return Object.entries(matrix).map(([key, count]) => {
      const [dayIdx, hourIdx] = key.split('-').map(Number);
      return {
        dayIdx,
        hourIdx,
        intensity: Math.round((count / maxCount) * 100),
        day: dayMap[dayIdx],
        hour: hourLabels[hourIdx],
      };
    });
  }, [orders]);

  const performanceRadarData = useMemo(() => {
    if (orders.length === 0) {
      return [];
    }

    const completed = orders.filter(o => o.status === 'completed').length;
    const completionRate = Math.round((completed / orders.length) * 150);

    const withCustomer = orders.filter(o => o.customerId).length;
    const retentionScore = Math.round((withCustomer / orders.length) * 150);

    const avgItems = orders.reduce((s, o) => s + (o.items?.length || 1), 0) / orders.length;
    const volumeScore = Math.min(Math.round(avgItems * 30), 150);

    const cashOrders = orders.filter(o => o.tenderType === 'cash' || o.cashAmount > 0).length;
    const efficiencyScore = Math.round((cashOrders / orders.length) * 150);

    const totalRevenue = orders.reduce((s, o) => s + Number(o.grandTotal || 0), 0);
    const avgOrder = totalRevenue / orders.length;
    const marginsScore = Math.min(Math.round((avgOrder / 5000) * 150), 150);

    const heldOrders = orders.filter(o => o.status === 'hold').length;
    const supportScore = Math.max(150 - Math.round((heldOrders / orders.length) * 300), 30);

    return [
      { subject: 'Completion',  A: completionRate,  B: 110, fullMark: 150 },
      { subject: 'Retention',   A: retentionScore,  B: 130, fullMark: 150 },
      { subject: 'Efficiency',  A: efficiencyScore, B: 130, fullMark: 150 },
      { subject: 'Avg Order',   A: marginsScore,    B: 100, fullMark: 150 },
      { subject: 'Volume',      A: volumeScore,     B: 90,  fullMark: 150 },
      { subject: 'Hold Rate',   A: supportScore,    B: 85,  fullMark: 150 },
    ];
  }, [orders]);

  const analyticsKpis = useMemo(() => {
    if (orders.length === 0) return {
      forecastedRevenue: 'Rs. 0', churnPct: '0%',
      logisticsEff: '0%', topCategory: 'N/A',
      forecastTrend: '0%', topCategoryShare: '0%',
    };

    const totalRevenue = orders.reduce((s, o) => s + Number(o.grandTotal || 0), 0);
    // Simple linear projection: last 30 days × 1.1
    const now = new Date();
    const last30 = orders.filter(o => (now.getTime() - new Date(o.createdAt).getTime()) < 30 * 86400000);
    const last30Rev = last30.reduce((s, o) => s + Number(o.grandTotal || 0), 0);
    const projected = last30Rev * 1.1;

    const completed = orders.filter(o => o.status === 'completed').length;
    const efficiencyPct = orders.length > 0 ? Math.round((completed / orders.length) * 100) : 0;

    const withCustomer = orders.filter(o => o.customerId).length;
    const churnPct = orders.length > 0 ? (100 - Math.round((withCustomer / orders.length) * 100)) : 0;

    // Top category
    const catCounts: Record<string, number> = {};
    orders.forEach(o => o.items?.forEach((li: any) => {
      const cat = li.item?.category?.name || 'Uncategorized';
      catCounts[cat] = (catCounts[cat] || 0) + Number(li.lineTotal || 0);
    }));
    const topCat = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0];
    const totalCatRev = Object.values(catCounts).reduce((a, b) => a + b, 0);
    const topCatShare = topCat ? Math.round((topCat[1] / (totalCatRev || 1)) * 100) : 0;

    const fmt = (n: number) => n >= 1_000_000
      ? `${formatCurrency(n / 1_000_000).replace('PKR ', '')}M`
      : n >= 1_000 ? `${formatCurrency(n / 1_000).replace('PKR ', '')}K` : formatCurrency(Math.round(n));

    return {
      forecastedRevenue: fmt(projected),
      churnPct: `${churnPct}%`,
      logisticsEff: `${efficiencyPct}%`,
      topCategory: topCat?.[0] || 'N/A',
      forecastTrend: last30Rev > 0 ? `+${((projected - last30Rev) / last30Rev * 100).toFixed(1)}%` : '0%',
      topCategoryShare: `${topCatShare}% share`,
    };
  }, [orders]);

  // ── Inventory Tab: derived from real stockLevels ─────────────────────────

  const inventoryStats = useMemo(() => {
    const LOW_THRESHOLD = 10;
    let lowStock = 0, outOfStock = 0;
    stockLevels.forEach((s: any) => {
      const qty = Number(s.totalQty || 0);
      if (qty === 0) outOfStock++;
      else if (qty <= LOW_THRESHOLD) lowStock++;
    });
    return {
      totalSkus: stockLevels.length,
      lowStockCount: stockLevels.length > 0 ? lowStock : 0,
      outOfStockCount: stockLevels.length > 0 ? outOfStock : 0,
      inTransitCount: stockLevels.filter((s: any) => s.location?.type === 'transit').length,
    };
  }, [stockLevels]);

  const inventoryRows = useMemo(() => {
    const LOW_THRESHOLD = 10;
    if (stockLevels.length === 0 && !loading) return [];
    return stockLevels.slice(0, 50).map((s: any) => {
      const qty = Number(s.totalQty || 0);
      return {
        id: s.item?.sku || s.itemId,
        name: s.item?.description || s.itemId,
        category: s.warehouse?.name || s.location?.name || "—",
        qty,
        status: qty === 0 ? "Out of Stock" : qty <= LOW_THRESHOLD ? "Low Stock" : "In Stock",
      };
    });
  }, [stockLevels, loading]);

  return (
    <div className="space-y-6 pb-12">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Layers className="h-5 w-5" />
            </div>
            <h2 className="text-3xl font-bold tracking-tight bg-linear-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              Enterprise Analytics
            </h2>
          </div>
          <p className="text-muted-foreground">Strategic overview of your business infrastructure and performance.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" className="gap-2 font-semibold">
            <Calendar className="h-4 w-4" />
            Last 30 Days
          </Button>
          {hasPermission("erp.dashboard.overview.export") && (
            <Button variant="outline" size="sm" className="gap-2 font-semibold">
              <Download className="h-4 w-4" />
              Export
            </Button>
          )}
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/50 pb-1 mb-6">
          <TabsList variant="underline" color="primary" className="bg-transparent border-none p-0 overflow-x-auto">
            <TabsTrigger value="overview" className="gap-2">
              <LayoutDashboard className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="inventory" className="gap-2">
              <Package className="h-4 w-4" />
              Inventory
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search records..." className="pl-9 h-8 bg-muted/20 border-border" />
            </div>
            <Button variant="ghost" size="icon-sm" onClick={fetchData} disabled={loading}>
              <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>

        <div className="animate-in fade-in duration-500">
          <TabsContent value="overview" className="m-0 space-y-6">
            <PermissionGuard permissions="erp.dashboard.overview.view">
            {/* KPI Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatsCard
                title="Total Revenue"
                value={kpis.totalRevenue}
                icon={DollarSign}
                description="Gross sales from POS"
                trend="Live"
                trendType="up"
                highlight
                loading={loading}
              />
              <StatsCard
                title="Active Customers"
                value={kpis.activeUsers}
                icon={Users}
                description="Unique purchasers"
                trend="Stable"
                trendType="up"
                loading={loading}
              />
              <StatsCard
                title="Inventory Items"
                value={kpis.inventoryCount}
                icon={Package}
                description="Unique SKUs in stock"
                trend="Updated"
                trendType="up"
                loading={loading}
              />
              <StatsCard
                title="Total Orders"
                value={kpis.totalOrders}
                icon={ShoppingCart}
                description="Combined transaction count"
                trend="Active"
                trendType="up"
                loading={loading}
              />
            </div>

            <div className="grid gap-6 md:grid-cols-12">
              {/* Main Analytics Section */}
              <div className="md:col-span-8 space-y-6">
                <Card className="transition-all hover:shadow-lg border-border/50 overflow-hidden min-h-[400px]">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <TrendingUp className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle className="text-base font-bold">Performance Matrix</CardTitle>
                        <CardDescription>Revenue vs Estimated Profit (6 Months)</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {loading ? (
                      <div className="h-[280px] w-full flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : (
                      <ChartContainer config={{
                        revenue: { label: "Revenue", color: "var(--primary)" },
                        profit: { label: "Est. Profit", color: "#10b981" }
                      }} className="h-[280px] w-full">
                        <ReLineChart data={revenueTrendData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="label" axisLine={false} tickLine={false} fontSize={10} fontWeight={500} dy={10} />
                          <YAxis axisLine={false} tickLine={false} fontSize={10} fontWeight={500} tickFormatter={(v) => `PKR ${(v/1000).toFixed(0)}K`} />
                          <Tooltip content={<ChartTooltipContent />} />
                          <Line type="monotone" dataKey="revenue" stroke="var(--primary)" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: "#fff" }} activeDot={{ r: 6, strokeWidth: 0 }} />
                          <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: "#fff" }} activeDot={{ r: 6, strokeWidth: 0 }} />
                        </ReLineChart>
                      </ChartContainer>
                    )}
                  </CardContent>
                </Card>

                {/* Assets Table */}
                <Card className="border-border/50 shadow-sm overflow-hidden min-h-[400px]">
                  <CardHeader className="bg-muted/5 border-b py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Layers className="h-5 w-5 text-primary" />
                        <CardTitle className="text-lg font-bold">Recent Transactions</CardTitle>
                      </div>
                      <button className="text-xs font-bold text-primary hover:underline group flex items-center gap-1">
                        View All <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="bg-muted/30 text-[10px] uppercase tracking-wider font-bold text-muted-foreground border-b">
                          <tr>
                            <th className="px-6 py-4">Entity ID</th>
                            <th className="px-6 py-4">Transaction Name</th>
                            <th className="px-6 py-4">Allocation</th>
                            <th className="px-6 py-4 text-right">Value</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {loading ? (
                            Array.from({ length: 4 }).map((_, i) => (
                              <tr key={i}>
                                <td className="px-6 py-4"><div className="h-4 w-16 bg-muted animate-pulse rounded" /></td>
                                <td className="px-6 py-4"><div className="h-4 w-32 bg-muted animate-pulse rounded" /></td>
                                <td className="px-6 py-4"><div className="h-4 w-20 bg-muted animate-pulse rounded" /></td>
                                <td className="px-6 py-4"><div className="h-4 w-24 bg-muted animate-pulse rounded ml-auto" /></td>
                              </tr>
                            ))
                          ) : recentTransactions.length > 0 ? (
                            recentTransactions.map((item) => (
                              <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                                <td className="px-6 py-4 font-mono text-xs font-black text-primary">{item.id}</td>
                                <td className="px-6 py-4 text-sm font-bold">{item.name}</td>
                                <td className="px-6 py-4">
                                  <Badge variant="outline" className="text-[10px] font-bold uppercase">{item.cat}</Badge>
                                </td>
                                <td className="px-6 py-4 text-sm font-black text-right">{item.val}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground font-medium">
                                No recent transactions found
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar Column */}
              <div className="md:col-span-4 space-y-6">
                <Card className="transition-all hover:shadow-md border-border/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-bold">Category Distribution</CardTitle>
                    <CardDescription>Sales share by item category</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="h-[250px] w-full flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : (
                      <>
                        <ChartContainer config={{}} className="h-[250px] w-full">
                          <PieChart>
                            <Pie
                              data={categoryAggregation}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                              strokeWidth={0}
                            >
                              {categoryAggregation.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip content={<ChartTooltipContent />} />
                          </PieChart>
                        </ChartContainer>
                        <div className="grid gap-2 mt-4">
                          {categoryAggregation.slice(0, 5).map((item) => (
                            <div key={item.name} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                <span className="text-xs font-bold text-muted-foreground line-clamp-1">{item.name}</span>
                              </div>
                              <span className="text-xs font-black">{item.value}%</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-primary/20 bg-primary/5 shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      Strategic Insight
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Based on {orders.length} transactions, your average order value is <span className="text-primary font-bold">
                        PKR {orders.length > 0 ? (orders.reduce((s, o) => s + Number(o.grandTotal), 0) / orders.length).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00"}
                      </span>.
                      Most sales occur in the <span className="text-primary font-bold">{categoryAggregation[0]?.name || "N/A"}</span> category.
                    </p>
                    <Button size="sm" className="w-full text-xs font-bold" onClick={fetchData}>Refresh Insights</Button>
                  </CardContent>
                </Card>
              </div>
            </div>
            </PermissionGuard>
          </TabsContent>

          <TabsContent value="analytics" className="m-0 space-y-6">
            <PermissionGuard permissions="erp.dashboard.analytics.view">
            {/* Advanced KPIs */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatsCard
                title="Projected Revenue"
                value={analyticsKpis.forecastedRevenue}
                icon={BrainCircuit}
                description="Linear projection from last 30 days"
                trend={analyticsKpis.forecastTrend}
                trendType="up"
                subValue="Based on recent trend"
                highlight
                loading={loading}
              />
              <StatsCard
                title="Walk-in Rate"
                value={analyticsKpis.churnPct}
                icon={Target}
                description="Orders without a linked customer"
                trend="Anonymous sales"
                trendType="neutral"
                loading={loading}
              />
              <StatsCard
                title="Completion Rate"
                value={analyticsKpis.logisticsEff}
                icon={Zap}
                description="Orders marked as completed"
                trend="Fulfilment"
                trendType="up"
                loading={loading}
              />
              <StatsCard
                title="Top Category"
                value={analyticsKpis.topCategory}
                icon={PieChartIcon}
                description="Highest revenue category"
                trend={analyticsKpis.topCategoryShare}
                trendType="up"
                loading={loading}
              />
            </div>

            <div className="grid gap-6 md:grid-cols-12">
              {/* Funnel & Heatmap Section */}
              <div className="md:col-span-8 space-y-6">
                <Card className="border-border/50 shadow-sm overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                       <Filter className="h-4 w-4 text-primary" />
                       Order Pipeline Funnel
                    </CardTitle>
                    <CardDescription>Breakdown of orders by status and engagement</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {loading ? (
                      <div className="h-[350px] flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : (
                      <ChartContainer
                        config={{
                          value: { label: "Orders" },
                        }}
                        className="h-[350px] w-full"
                      >
                        <BarChart
                          layout="vertical"
                          data={funnelData}
                          margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                          <XAxis type="number" hide />
                          <YAxis
                            dataKey="stage"
                            type="category"
                            axisLine={false}
                            tickLine={false}
                            fontSize={12}
                            fontWeight={600}
                          />
                          <ChartTooltip
                            cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                            content={
                              <ChartTooltipContent
                                indicator="line"
                                labelKey="stage"
                                nameKey="stage"
                                formatter={(value, name, item) => (
                                  <div className="flex items-center justify-between gap-4 w-full">
                                    <span className="text-muted-foreground">{item.payload.stage}</span>
                                    <span className="font-mono font-semibold tabular-nums text-foreground">
                                      {Number(value).toLocaleString()}
                                    </span>
                                  </div>
                                )}
                              />
                            }
                          />
                          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={32}>
                            {funnelData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ChartContainer>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/50 shadow-sm overflow-hidden">
                  <CardHeader>
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                       <Activity className="h-4 w-4 text-primary" />
                       Order Intensity Matrix
                    </CardTitle>
                    <CardDescription>Peak activity hours across the business week</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    {loading ? (
                      <div className="h-[300px] flex items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : (
                      <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis
                              dataKey="hourIdx"
                              name="Hour"
                              type="number"
                              ticks={[0, 1, 2, 3, 4]}
                              tickFormatter={(v) => hourMap[v] || ''}
                              axisLine={false}
                              tickLine={false}
                              fontSize={10}
                              fontWeight={600}
                            />
                            <YAxis
                              dataKey="dayIdx"
                              name="Day"
                              type="number"
                              ticks={[0, 1, 2, 3, 4, 5, 6]}
                              tickFormatter={(v) => dayMap[v] || ''}
                              axisLine={false}
                              tickLine={false}
                              fontSize={10}
                              fontWeight={600}
                            />
                            <ZAxis dataKey="intensity" range={[50, 800]} name="Intensity" />
                            <Tooltip
                              cursor={{ strokeDasharray: '3 3' }}
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const d = payload[0].payload;
                                  return (
                                    <div className="bg-background border border-border p-2 rounded-lg shadow-sm text-xs">
                                      <div className="font-bold">{d.day} @ {d.hour}</div>
                                      <div className="text-primary font-bold">Intensity: {d.intensity}%</div>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Scatter name="Activity" data={activityData} fill="var(--primary)" fillOpacity={0.6}>
                              {activityData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fillOpacity={entry.intensity / 100} />
                              ))}
                            </Scatter>
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Advanced Sidebar */}
              <div className="md:col-span-4 space-y-6">
                 <Card className="border-border/50 shadow-sm overflow-hidden">
                    <CardHeader>
                       <CardTitle className="text-lg font-bold">Operational Radar</CardTitle>
                       <CardDescription>KPI balance vs benchmark</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-2">
                      {loading ? (
                        <div className="h-[280px] flex items-center justify-center">
                          <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                      ) : (
                        <>
                          <ChartContainer
                            config={{
                              A: { label: "Your Business", color: "var(--primary)" },
                              B: { label: "Benchmark",     color: "#10b981" },
                            }}
                            className="h-[280px] w-full"
                          >
                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={performanceRadarData}>
                              <PolarGrid stroke="#e2e8f0" />
                              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fontWeight: 700 }} />
                              <PolarRadiusAxis angle={30} domain={[0, 150]} hide />
                              <Radar name="Your Business" dataKey="A" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.5} />
                              <Radar name="Benchmark" dataKey="B" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
                              <ChartTooltip
                                content={
                                  <ChartTooltipContent
                                    indicator="line"
                                    labelKey="subject"
                                  />
                                }
                              />
                            </RadarChart>
                          </ChartContainer>
                          <div className="flex justify-center gap-4 mt-2">
                            <div className="flex items-center gap-1.5">
                              <div className="w-3 h-3 rounded-full bg-primary" />
                              <span className="text-[10px] font-bold">Your Business</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="w-3 h-3 rounded-full bg-[#10b981]" />
                              <span className="text-[10px] font-bold">Benchmark</span>
                            </div>
                          </div>
                        </>
                      )}
                    </CardContent>
                 </Card>

                 <Card className="bg-linear-to-br from-primary/10 to-transparent border-primary/20">
                    <CardHeader>
                       <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
                          <BrainCircuit className="h-4 w-4" />
                          Predictive Insight
                       </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                       {loading ? (
                         <div className="space-y-2">
                           <div className="h-4 bg-muted animate-pulse rounded w-full" />
                           <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
                         </div>
                       ) : (
                         <>
                           <p className="text-xs font-medium leading-relaxed">
                             Based on <span className="font-bold">{orders.length}</span> orders, your top category is{" "}
                             <span className="font-bold underline">{analyticsKpis.topCategory}</span> with{" "}
                             <span className="font-bold">{analyticsKpis.topCategoryShare}</span> of revenue.
                             Projected next-period revenue is{" "}
                             <span className="font-bold">{analyticsKpis.forecastedRevenue}</span>.
                           </p>
                           <div className="p-3 rounded-lg bg-background/50 border border-primary/10">
                             <div className="text-[10px] uppercase tracking-wider font-extrabold text-muted-foreground mb-1">Recommended Action</div>
                             <p className="text-xs font-bold leading-snug">
                               {analyticsKpis.logisticsEff !== '0%'
                                 ? `Maintain ${analyticsKpis.logisticsEff} completion rate. Focus on converting walk-in customers (${analyticsKpis.churnPct}) to registered accounts.`
                                 : 'Start processing orders to unlock actionable insights.'}
                             </p>
                           </div>
                         </>
                       )}
                    </CardContent>
                 </Card>
              </div>
            </div>
            </PermissionGuard>
          </TabsContent>

          <TabsContent value="inventory" className="m-0 space-y-6">
            <PermissionGuard permissions="erp.dashboard.inventory.view">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatsCard
                title="Total SKUs"
                value={inventoryStats.totalSkus}
                icon={Package}
                description="Unique items tracked in stock"
                highlight
                loading={loading}
              />
              <StatsCard
                title="Low Stock"
                value={`${inventoryStats.lowStockCount} SKUs`}
                icon={Filter}
                description="Items at or below 10 units"
                trendType="down"
                trend={inventoryStats.lowStockCount > 0 ? "Caution" : "OK"}
                loading={loading}
              />
              <StatsCard
                title="Out of Stock"
                value={`${inventoryStats.outOfStockCount} SKUs`}
                icon={Activity}
                description="Items with zero quantity"
                trendType={inventoryStats.outOfStockCount > 0 ? "down" : "up"}
                trend={inventoryStats.outOfStockCount > 0 ? "Action needed" : "Clear"}
                loading={loading}
              />
              <StatsCard
                title="In Transit"
                value={`${inventoryStats.inTransitCount} Units`}
                icon={Zap}
                description="Stock at transit locations"
                trendType="neutral"
                trend="Tracked"
                loading={loading}
              />
            </div>

            <Card className="border-border/50 shadow-sm overflow-hidden gap-0">
              <CardHeader className="bg-muted/5 border-b py-0">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold">Inventory Reconciliation</CardTitle>
                    <CardDescription>Current stock levels — showing top {inventoryRows.length} SKUs</CardDescription>
                  </div>
                  {hasPermission("erp.dashboard.inventory.refresh") && (
                    <Button variant="ghost" size="sm" onClick={fetchData} disabled={loading} className="gap-2 text-xs">
                      <RefreshCcw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                      Refresh
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0 mt-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-muted/30 text-[10px] uppercase tracking-wider font-bold text-muted-foreground border-b">
                      <tr>
                        <th className="px-6 py-4">SKU</th>
                        <th className="px-6 py-4">Name</th>
                        <th className="px-6 py-4">Warehouse / Location</th>
                        <th className="px-6 py-4 text-right">Quantity</th>
                        <th className="px-6 py-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/30">
                      {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <tr key={i}>
                            {Array.from({ length: 5 }).map((_, j) => (
                              <td key={j} className="px-6 py-4">
                                <div className="h-4 bg-muted animate-pulse rounded" />
                              </td>
                            ))}
                          </tr>
                        ))
                      ) : inventoryRows.map((item) => (
                        <tr key={item.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-6 py-4 font-mono text-xs font-black text-primary">{item.id}</td>
                          <td className="px-6 py-4 text-sm font-bold max-w-[240px] truncate">{item.name}</td>
                          <td className="px-6 py-4">
                            <Badge variant="outline" className="text-[10px] font-bold uppercase">{item.category}</Badge>
                          </td>
                          <td className="px-6 py-4 text-sm font-black text-right">{item.qty.toLocaleString('en-PK')}</td>
                          <td className="px-6 py-4 text-right">
                            <Badge variant="outline" className={cn(
                              "text-[10px] font-bold",
                              item.status === "In Stock"     ? "bg-green-500/10 text-green-600 border-green-500/20" :
                              item.status === "Low Stock"    ? "bg-amber-500/10 text-amber-600 border-amber-500/20" :
                                                               "bg-red-500/10 text-red-600 border-red-500/20"
                            )}>
                              {item.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
            </PermissionGuard>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};

export default function ERPPage() {
  return (
    <PermissionGuard permissions="erp.dashboard.view">
      <div className="animate-in fade-in duration-700">
        <ERPDashboard />
      </div>
    </PermissionGuard>
  );
}
