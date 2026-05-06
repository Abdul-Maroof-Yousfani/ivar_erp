"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  Download, Loader2, TrendingUp, Users, BarChart3, Award, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
  ChartLegend, ChartLegendContent, type ChartConfig,
} from "@/components/ui/chart";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  RadarChart, PolarGrid, PolarAngleAxis, Radar,
  Cell,
} from "recharts";
import { getKpiOrgDashboard, exportKpiReviews, type KpiOrgDashboard } from "@/lib/actions/kpi";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildPeriodOptions(type: string): string[] {
  const year = new Date().getFullYear();
  if (type === "quarterly") return [`${year}-Q1`, `${year}-Q2`, `${year}-Q3`, `${year}-Q4`];
  if (type === "monthly")
    return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  return [String(year), String(year - 1)];
}

function scoreColor(score: number | null) {
  if (score == null) return "text-muted-foreground";
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  return "text-red-600";
}

function scoreLabel(score: number | null) {
  if (score == null) return "—";
  if (score >= 80) return "Excellent";
  if (score >= 60) return "Good";
  return "Needs Improvement";
}

const BUCKET_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#16a34a"];

function downloadCsv(rows: Record<string, any>[], filename: string) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? "")).join(",")),
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Chart configs ────────────────────────────────────────────────────────────

const deptChartConfig: ChartConfig = {
  avgScore: { label: "Avg Score", color: "hsl(var(--chart-1))" },
};

const categoryChartConfig: ChartConfig = {
  avgScore: { label: "Avg Score", color: "hsl(var(--chart-2))" },
};

const liveMetricLabels: Record<string, string> = {
  attendance_rate: "Attendance",
  punctuality_score: "Punctuality",
  leave_utilization: "Leave Use",
  overtime_hours: "Overtime",
  increment_percentage: "Increment",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function KpiDashboardPage() {
  const [periodType, setPeriodType] = useState("quarterly");
  const [period, setPeriod] = useState(
    `${new Date().getFullYear()}-Q${Math.ceil((new Date().getMonth() + 1) / 3)}`,
  );
  const [data, setData] = useState<KpiOrgDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const hasFetched = useRef(false);

  const periodOptions = buildPeriodOptions(periodType);

  useEffect(() => {
    setPeriod(buildPeriodOptions(periodType)[0]);
  }, [periodType]);

  useEffect(() => {
    if (period) fetchDashboard();
  }, [period, periodType]);

  async function fetchDashboard() {
    setLoading(true);
    const res = await getKpiOrgDashboard(period, periodType);
    if (res.status) setData(res.data || null);
    else toast.error(res.message || "Failed to load dashboard");
    setLoading(false);
    hasFetched.current = true;
  }

  async function handleExport() {
    setExporting(true);
    const res = await exportKpiReviews(period);
    if (res.status && res.data) {
      downloadCsv(res.data, `kpi-reviews-${period}.csv`);
      toast.success("Export downloaded");
    } else {
      toast.error(res.message || "Export failed");
    }
    setExporting(false);
  }

  const radarData = data?.liveMetricAverages.map((m) => ({
    metric: liveMetricLabels[m.formula] || m.formula,
    value: m.avgValue,
  })) || [];

  const radarConfig: ChartConfig = { value: { label: "Avg Value", color: "hsl(var(--chart-3))" } };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">KPI Dashboard</h1>
          <p className="text-muted-foreground text-sm">Org-wide performance overview</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={periodType} onValueChange={setPeriodType}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["monthly", "quarterly", "yearly"].map((t) => (
                <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {periodOptions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExport} disabled={exporting || !data}>
            {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Export CSV
          </Button>
        </div>
      </div>

      {loading ? <DashboardSkeleton /> : data ? (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard
              icon={<BarChart3 className="h-5 w-5 text-blue-500" />}
              label="Total Reviews"
              value={data.summary.totalReviews}
            />
            <SummaryCard
              icon={<TrendingUp className="h-5 w-5 text-green-500" />}
              label="Avg Score"
              value={data.summary.avgScore != null ? `${data.summary.avgScore}%` : "—"}
              sub={scoreLabel(data.summary.avgScore)}
              subColor={scoreColor(data.summary.avgScore)}
            />
            <SummaryCard
              icon={<Award className="h-5 w-5 text-yellow-500" />}
              label="Approved"
              value={data.summary.byStatus["approved"] || 0}
            />
            <SummaryCard
              icon={<AlertTriangle className="h-5 w-5 text-orange-500" />}
              label="Pending"
              value={data.summary.byStatus["pending"] || 0}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Department Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Avg Score by Department</CardTitle>
                <CardDescription>Weighted average KPI score per department</CardDescription>
              </CardHeader>
              <CardContent>
                {data.departmentBreakdown.length > 0 ? (
                  <ChartContainer config={deptChartConfig} className="h-64">
                    <BarChart data={data.departmentBreakdown} layout="vertical" margin={{ left: 8, right: 24 }}>
                      <CartesianGrid horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} />
                      <YAxis type="category" dataKey="department" width={90} tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="avgScore" fill="var(--color-avgScore)" radius={4} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <EmptyState text="No department data for this period" />
                )}
              </CardContent>
            </Card>

            {/* Score Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Score Distribution</CardTitle>
                <CardDescription>How scores are spread across employees</CardDescription>
              </CardHeader>
              <CardContent>
                {data.scoreDistribution.some((b) => b.count > 0) ? (
                  <ChartContainer config={{ count: { label: "Employees", color: "hsl(var(--chart-1))" } }} className="h-64">
                    <BarChart data={data.scoreDistribution} margin={{ left: 0, right: 8 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                      <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" radius={4}>
                        {data.scoreDistribution.map((_, i) => (
                          <Cell key={i} fill={BUCKET_COLORS[i]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <EmptyState text="No scored reviews for this period" />
                )}
              </CardContent>
            </Card>

            {/* Category Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Avg Score by KPI Category</CardTitle>
              </CardHeader>
              <CardContent>
                {data.categoryBreakdown.length > 0 ? (
                  <ChartContainer config={categoryChartConfig} className="h-56">
                    <BarChart data={data.categoryBreakdown} margin={{ left: 0, right: 8 }}>
                      <CartesianGrid vertical={false} />
                      <XAxis dataKey="category" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} className="capitalize" />
                      <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="avgScore" fill="var(--color-avgScore)" radius={4} />
                    </BarChart>
                  </ChartContainer>
                ) : (
                  <EmptyState text="No category data for this period" />
                )}
              </CardContent>
            </Card>

            {/* Live Metric Radar */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Live Org Metrics (Avg)</CardTitle>
                <CardDescription>Auto-computed averages across sampled employees</CardDescription>
              </CardHeader>
              <CardContent>
                {radarData.length > 0 ? (
                  <ChartContainer config={radarConfig} className="h-56">
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="metric" tick={{ fontSize: 11 }} />
                      <Radar dataKey="value" fill="var(--color-value)" fillOpacity={0.4} stroke="var(--color-value)" />
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </RadarChart>
                  </ChartContainer>
                ) : (
                  <EmptyState text="No live metric data available" />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Top & Bottom Performers */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <PerformerList title="Top Performers" icon={<Award className="h-4 w-4 text-yellow-500" />} performers={data.topPerformers} variant="top" />
            <PerformerList title="Needs Attention" icon={<AlertTriangle className="h-4 w-4 text-orange-500" />} performers={data.bottomPerformers} variant="bottom" />
          </div>
        </>
      ) : hasFetched.current ? (
        <EmptyState text="No KPI data found for this period." />
      ) : null}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({ icon, label, value, sub, subColor }: {
  icon: React.ReactNode; label: string; value: string | number;
  sub?: string; subColor?: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <p className={`text-xs mt-0.5 font-medium ${subColor}`}>{sub}</p>}
      </CardContent>
    </Card>
  );
}

function PerformerList({ title, icon, performers, variant }: {
  title: string;
  icon: React.ReactNode;
  performers: Array<{ employeeId: string; name: string; score: number }>;
  variant: "top" | "bottom";
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">{icon}{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {performers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No data</p>
        ) : performers.map((p, i) => (
          <div key={p.employeeId} className="flex items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground w-5">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{p.name}</div>
              <Progress value={p.score} className="h-1.5 mt-1" />
            </div>
            <Badge
              variant={variant === "top" ? (p.score >= 80 ? "default" : "secondary") : "outline"}
              className="text-xs tabular-nums"
            >
              {p.score}%
            </Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">{text}</div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[...Array(2)].map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
      </div>
    </div>
  );
}
