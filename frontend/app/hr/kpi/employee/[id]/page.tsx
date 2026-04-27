"use client";

import { useState, useEffect, useTransition } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw, Loader2, TrendingUp, Clock, Calendar, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  getKpiEmployeeSummary, autoPopulateKpi,
  type KpiEmployeeSummary, type KpiMetricResult,
} from "@/lib/actions/kpi";

const PERIOD_TYPES = ["monthly", "quarterly", "yearly"] as const;

function buildPeriodOptions(type: string): string[] {
  const year = new Date().getFullYear();
  if (type === "quarterly") return [`${year}-Q1`, `${year}-Q2`, `${year}-Q3`, `${year}-Q4`];
  if (type === "monthly") {
    return Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, "0");
      return `${year}-${m}`;
    });
  }
  return [String(year), String(year - 1)];
}

function scoreColor(score: number | null): string {
  if (score == null) return "text-muted-foreground";
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  return "text-red-600";
}

function MetricCard({ metric }: { metric: KpiMetricResult }) {
  const icons: Record<string, React.ReactNode> = {
    attendance_rate: <Calendar className="h-5 w-5 text-blue-500" />,
    punctuality_score: <Clock className="h-5 w-5 text-purple-500" />,
    leave_utilization: <BarChart3 className="h-5 w-5 text-orange-500" />,
    overtime_hours: <TrendingUp className="h-5 w-5 text-green-500" />,
    increment_percentage: <TrendingUp className="h-5 w-5 text-indigo-500" />,
  };

  return (
    <Card>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{metric.label}</CardTitle>
        {icons[metric.formula] || <BarChart3 className="h-5 w-5 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${scoreColor(metric.actualValue)}`}>
          {metric.actualValue.toFixed(1)}{metric.unit}
        </div>
        {metric.unit === "%" && (
          <Progress value={Math.min(100, metric.actualValue)} className="mt-2 h-1.5" />
        )}
        {metric.meta && (
          <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
            {Object.entries(metric.meta).map(([k, v]) => (
              <div key={k}>{k.replace(/([A-Z])/g, " $1").toLowerCase()}: <span className="font-medium">{String(v)}</span></div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function EmployeeKpiSummaryPage() {
  const { id } = useParams<{ id: string }>();
  const [periodType, setPeriodType] = useState<string>("quarterly");
  const [period, setPeriod] = useState<string>(`${new Date().getFullYear()}-Q${Math.ceil((new Date().getMonth() + 1) / 3)}`);
  const [summary, setSummary] = useState<KpiEmployeeSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const periodOptions = buildPeriodOptions(periodType);

  useEffect(() => {
    // Reset period when type changes
    setPeriod(buildPeriodOptions(periodType)[0]);
  }, [periodType]);

  useEffect(() => {
    if (id && period) fetchSummary();
  }, [id, period, periodType]);

  async function fetchSummary() {
    setLoading(true);
    const res = await getKpiEmployeeSummary(id, period, periodType);
    if (res.status) setSummary(res.data || null);
    else toast.error(res.message || "Failed to load KPI summary");
    setLoading(false);
  }

  function handleAutoPopulate() {
    startTransition(async () => {
      const res = await autoPopulateKpi({ employeeId: id, period, periodType });
      if (res.status) {
        toast.success(res.message || "KPI reviews auto-populated");
        fetchSummary();
      } else {
        toast.error(res.message || "Failed to auto-populate");
      }
    });
  }

  const liveMetrics = summary ? Object.values(summary.liveMetrics) : [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {summary?.employee.employeeName || "Employee"} — KPI Summary
          </h1>
          <p className="text-muted-foreground text-sm">
            {summary?.employee.designationName || ""}{summary?.employee.departmentName ? ` · ${summary.employee.departmentName}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={periodType} onValueChange={setPeriodType}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PERIOD_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {periodOptions.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleAutoPopulate} disabled={isPending}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Auto-Populate
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Overall Score */}
          {summary?.overallScore != null && (
            <Card className="border-2">
              <CardContent className="pt-6 flex items-center gap-6">
                <div className={`text-5xl font-bold ${scoreColor(summary.overallScore)}`}>
                  {summary.overallScore.toFixed(1)}
                </div>
                <div className="flex-1">
                  <div className="text-sm text-muted-foreground mb-1">Overall Weighted KPI Score</div>
                  <Progress value={summary.overallScore} className="h-3" />
                </div>
                <Badge
                  variant={summary.overallScore >= 80 ? "default" : summary.overallScore >= 60 ? "secondary" : "destructive"}
                  className="text-sm px-3 py-1"
                >
                  {summary.overallScore >= 80 ? "Excellent" : summary.overallScore >= 60 ? "Good" : "Needs Improvement"}
                </Badge>
              </CardContent>
            </Card>
          )}

          {/* Live Auto-Computed Metrics */}
          {liveMetrics.length > 0 && (
            <div>
              <h2 className="text-base font-semibold mb-3">Live Metrics</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {liveMetrics.map((m) => <MetricCard key={m.formula} metric={m} />)}
              </div>
            </div>
          )}

          {/* Saved KPI Reviews */}
          {summary && summary.reviews.length > 0 && (
            <div>
              <h2 className="text-base font-semibold mb-3">KPI Reviews — {period}</h2>
              <div className="space-y-3">
                {summary.reviews.map((r) => {
                  const score = r.score != null ? Number(r.score) : null;
                  return (
                    <div key={r.id} className="flex items-center gap-4 p-4 rounded-lg border bg-card">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{r.kpiTemplate?.name || "—"}</div>
                        <div className="text-xs text-muted-foreground capitalize">{r.kpiTemplate?.category}</div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {r.actualValue != null ? Number(r.actualValue).toFixed(1) : "—"} / {Number(r.targetValue).toFixed(1)} {r.kpiTemplate?.unit || ""}
                      </div>
                      <div className="w-32">
                        {score != null ? (
                          <div className="flex items-center gap-2">
                            <Progress value={score} className="h-1.5 flex-1" />
                            <span className={`text-xs font-medium ${scoreColor(score)}`}>{score.toFixed(0)}%</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">No score</span>
                        )}
                      </div>
                      <Badge
                        variant={r.status === "approved" ? "default" : r.status === "submitted" ? "secondary" : "outline"}
                        className="capitalize text-xs"
                      >
                        {r.status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {summary && summary.reviews.length === 0 && liveMetrics.length === 0 && (
            <div className="text-center py-16 text-muted-foreground">
              No KPI data for {period}. Click Auto-Populate to generate from system data.
            </div>
          )}
        </>
      )}
    </div>
  );
}
