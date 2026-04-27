"use client";

import { useState, useEffect } from "react";
import { TrendingUp, RefreshCw, Loader2, BarChart3, Clock, Calendar, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
    getKpiEmployeeSummary,
    autoPopulateKpi,
    type KpiEmployeeSummary,
    type KpiMetricResult,
} from "@/lib/actions/kpi";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function currentQuarter() {
    return `${new Date().getFullYear()}-Q${Math.ceil((new Date().getMonth() + 1) / 3)}`;
}

function buildPeriodOptions(type: string): string[] {
    const year = new Date().getFullYear();
    if (type === "quarterly")
        return [`${year}-Q1`, `${year}-Q2`, `${year}-Q3`, `${year}-Q4`,
            `${year - 1}-Q1`, `${year - 1}-Q2`, `${year - 1}-Q3`, `${year - 1}-Q4`];
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
    if (score == null) return null;
    if (score >= 80) return { label: "Excellent", variant: "default" as const };
    if (score >= 60) return { label: "Good", variant: "secondary" as const };
    return { label: "Needs Improvement", variant: "destructive" as const };
}

const METRIC_ICONS: Record<string, React.ReactNode> = {
    attendance_rate: <Calendar className="h-4 w-4 text-blue-500" />,
    punctuality_score: <Clock className="h-4 w-4 text-purple-500" />,
    leave_utilization: <BarChart3 className="h-4 w-4 text-orange-500" />,
    overtime_hours: <TrendingUp className="h-4 w-4 text-green-500" />,
    increment_percentage: <Award className="h-4 w-4 text-indigo-500" />,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function LiveMetricCard({ metric }: { metric: KpiMetricResult }) {
    return (
        <Card className="border-muted/60">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-medium text-muted-foreground">{metric.label}</CardTitle>
                {METRIC_ICONS[metric.formula] ?? <BarChart3 className="h-4 w-4 text-muted-foreground" />}
            </CardHeader>
            <CardContent>
                <div className={`text-xl font-bold ${scoreColor(metric.actualValue)}`}>
                    {metric.actualValue.toFixed(1)}{metric.unit}
                </div>
                {metric.unit === "%" && (
                    <Progress value={Math.min(100, metric.actualValue)} className="mt-1.5 h-1" />
                )}
                {metric.meta && (
                    <div className="mt-1.5 space-y-0.5">
                        {Object.entries(metric.meta).map(([k, v]) => (
                            <p key={k} className="text-xs text-muted-foreground">
                                {k.replace(/([A-Z])/g, " $1").toLowerCase()}: <span className="font-medium">{String(v)}</span>
                            </p>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function SkeletonCards() {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
            <Skeleton className="h-40 rounded-xl" />
        </div>
    );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PerformanceContent({ employeeId }: { employeeId?: string | null }) {
    const [periodType, setPeriodType] = useState("quarterly");
    const [period, setPeriod] = useState(currentQuarter());
    const [summary, setSummary] = useState<KpiEmployeeSummary | null>(null);
    const [loading, setLoading] = useState(false);
    const [populating, setPopulating] = useState(false);
    const [hasFetched, setHasFetched] = useState(false);

    const periodOptions = buildPeriodOptions(periodType);

    useEffect(() => {
        setPeriod(buildPeriodOptions(periodType)[0]);
    }, [periodType]);

    useEffect(() => {
        if (employeeId && period) fetchSummary();
    }, [employeeId, period, periodType]);

    async function fetchSummary() {
        if (!employeeId) return;
        setLoading(true);
        const res = await getKpiEmployeeSummary(employeeId, period, periodType);
        if (res.status) setSummary(res.data ?? null);
        setHasFetched(true);
        setLoading(false);
    }

    async function handleAutoPopulate() {
        if (!employeeId) return;
        setPopulating(true);
        const res = await autoPopulateKpi({ employeeId, period, periodType });
        if (res.status) {
            toast.success(res.message ?? "KPI metrics refreshed");
            fetchSummary();
        } else {
            toast.error(res.message ?? "Failed to refresh metrics");
        }
        setPopulating(false);
    }

    if (!employeeId) {
        return (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
                No employee profile linked to your account.
            </div>
        );
    }

    const liveMetrics = summary ? Object.values(summary.liveMetrics) : [];
    const rating = scoreLabel(summary?.overallScore ?? null);

    return (
        <div className="space-y-5">
            {/* Controls */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 className="font-semibold text-base">My Performance</h3>
                    <p className="text-xs text-muted-foreground">KPI scores and live metrics for the selected period</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Select value={periodType} onValueChange={setPeriodType}>
                        <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {["monthly", "quarterly", "yearly"].map((t) => (
                                <SelectItem key={t} value={t} className="capitalize text-xs">{t}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={period} onValueChange={setPeriod}>
                        <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {periodOptions.map((p) => <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Button size="sm" variant="outline" onClick={handleAutoPopulate} disabled={populating} className="h-8 text-xs">
                        {populating
                            ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                            : <RefreshCw className="mr-1.5 h-3 w-3" />}
                        Refresh Metrics
                    </Button>
                </div>
            </div>

            {loading ? <SkeletonCards /> : (
                <>
                    {/* Overall Score */}
                    {summary?.overallScore != null && (
                        <Card className="border-2 bg-linear-to-br from-muted/30 to-background">
                            <CardContent className="pt-5 flex items-center gap-5">
                                <div className={`text-4xl font-bold tabular-nums ${scoreColor(summary.overallScore)}`}>
                                    {summary.overallScore.toFixed(1)}
                                </div>
                                <div className="flex-1">
                                    <div className="text-xs text-muted-foreground mb-1">Overall Weighted KPI Score</div>
                                    <Progress value={summary.overallScore} className="h-2" />
                                </div>
                                {rating && (
                                    <Badge variant={rating.variant} className="text-xs px-2.5 py-1">{rating.label}</Badge>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Live Auto-Computed Metrics */}
                    {liveMetrics.length > 0 && (
                        <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Live Metrics</p>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                                {liveMetrics.map((m) => <LiveMetricCard key={m.formula} metric={m} />)}
                            </div>
                        </div>
                    )}

                    {/* KPI Reviews */}
                    {summary && summary.reviews.length > 0 && (
                        <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">KPI Reviews — {period}</p>
                            <div className="space-y-2">
                                {summary.reviews.map((r) => {
                                    const score = r.score != null ? Number(r.score) : null;
                                    return (
                                        <div key={r.id} className="flex items-center gap-4 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium truncate">{r.kpiTemplate?.name ?? "—"}</div>
                                                <div className="text-xs text-muted-foreground capitalize">{r.kpiTemplate?.category}</div>
                                            </div>
                                            <div className="text-xs text-muted-foreground tabular-nums hidden sm:block">
                                                {r.actualValue != null ? Number(r.actualValue).toFixed(1) : "—"} / {Number(r.targetValue).toFixed(1)} {r.kpiTemplate?.unit ?? ""}
                                            </div>
                                            <div className="w-28 hidden md:block">
                                                {score != null ? (
                                                    <div className="flex items-center gap-1.5">
                                                        <Progress value={score} className="h-1.5 flex-1" />
                                                        <span className={`text-xs font-medium tabular-nums ${scoreColor(score)}`}>{score.toFixed(0)}%</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">No score</span>
                                                )}
                                            </div>
                                            <Badge
                                                variant={r.status === "approved" ? "default" : r.status === "submitted" ? "secondary" : r.status === "rejected" ? "destructive" : "outline"}
                                                className="capitalize text-xs shrink-0"
                                            >
                                                {r.status}
                                            </Badge>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Empty state */}
                    {hasFetched && liveMetrics.length === 0 && (!summary || summary.reviews.length === 0) && (
                        <div className="flex flex-col items-center justify-center py-14 text-center gap-3">
                            <TrendingUp className="h-10 w-10 text-muted-foreground/40" />
                            <p className="text-sm text-muted-foreground">No KPI data for {period}.</p>
                            <Button size="sm" variant="outline" onClick={handleAutoPopulate} disabled={populating}>
                                {populating ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-2 h-3 w-3" />}
                                Generate from my data
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
