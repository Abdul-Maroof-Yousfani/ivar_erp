"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Search,
  Printer,
  Download,
  RefreshCw,
  Filter,
  ChevronLeft,
  ChevronRight,
  Activity,
  X,
  ShieldAlert,
  LogIn,
  LogOut,
  Plus,
  Pencil,
  Trash2,
  KeyRound,
  MonitorX,
} from "lucide-react";
import { toast } from "sonner";
import { useSocket } from "@/components/providers/socket-provider";
import { authFetch } from "@/lib/auth";
import { DateRangePicker, type DateRange } from "@/components/ui/date-range-picker";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface ActivityLog {
  id: string;
  userId: string | null;
  user: { id: string; email: string; firstName: string; lastName: string } | null;
  action: string;
  module: string | null;
  entity: string | null;
  entityId: string | null;
  description: string | null;
  oldValues: string | null;
  newValues: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

interface PaginationData {
  logs: ActivityLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Action config ────────────────────────────────────────────────────────────
const actionConfig: Record<
  string,
  { label: string; icon: React.ElementType; className: string }
> = {
  login: {
    label: "Login",
    icon: LogIn,
    className: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
  },
  logout: {
    label: "Logout",
    icon: LogOut,
    className: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  },
  create: {
    label: "Create",
    icon: Plus,
    className: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  },
  update: {
    label: "Update",
    icon: Pencil,
    className: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800",
  },
  delete: {
    label: "Delete",
    icon: Trash2,
    className: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
  },
  password_change: {
    label: "Password Change",
    icon: KeyRound,
    className: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800",
  },
  logout_all_devices: {
    label: "Logout All",
    icon: MonitorX,
    className: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300 dark:border-orange-800",
  },
  approve: {
    label: "Approve",
    icon: Activity,
    className: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800",
  },
  reject: {
    label: "Reject",
    icon: ShieldAlert,
    className: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-800",
  },
  generate: {
    label: "Generate",
    icon: RefreshCw,
    className: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-800",
  },
  bulk_upload: {
    label: "Bulk Upload",
    icon: Download,
    className: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950 dark:text-indigo-300 dark:border-indigo-800",
  },
  seed: {
    label: "Seed",
    icon: Plus,
    className: "bg-lime-50 text-lime-700 border-lime-200 dark:bg-lime-950 dark:text-lime-300 dark:border-lime-800",
  },
};

const LIMIT = 20;

// ─── Stat card ────────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border p-4 flex items-center gap-4", className)}>
      <div className="rounded-lg bg-background/60 p-2 shadow-sm">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-bold leading-none">{value.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </div>
    </div>
  );
}

// ─── Action badge ─────────────────────────────────────────────────────────────
function ActionBadge({ action }: { action: string }) {
  const cfg = actionConfig[action];
  if (!cfg) {
    return (
      <Badge variant="outline" className="capitalize">
        {action.replace(/_/g, " ")}
      </Badge>
    );
  }
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={cn("gap-1 capitalize", cfg.className)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ActivityLogsPage() {
  const [data, setData] = useState<PaginationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("");
  const [moduleFilter, setModuleFilter] = useState<string>("");
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
  const [page, setPage] = useState(1);
  // Dynamic filter options fetched from the DB
  const [availableModules, setAvailableModules] = useState<string[]>([]);
  const [availableActions, setAvailableActions] = useState<string[]>([]);
  const { socket } = useSocket();

  // ── Fetch filter options once on mount ────────────────────────────────────
  useEffect(() => {
    authFetch("/api/activity-logs/filters", { method: "GET" }).then((res) => {
      if (res.ok) {
        setAvailableModules(res.data.modules ?? []);
        setAvailableActions(res.data.actions ?? []);
      }
    });
  }, []);

  // Keep a ref to current filters so the socket handler always sees fresh values
  const filtersRef = useRef({ actionFilter, moduleFilter });
  useEffect(() => {
    filtersRef.current = { actionFilter, moduleFilter };
  }, [actionFilter, moduleFilter]);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchLogs = useCallback(
    async (overridePage?: number) => {
      setLoading(true);
      try {
        const currentPage = overridePage ?? page;
        const params = new URLSearchParams({
          page: currentPage.toString(),
          limit: LIMIT.toString(),
        });
        if (actionFilter && actionFilter !== "all") params.append("action", actionFilter);
        if (moduleFilter && moduleFilter !== "all") params.append("module", moduleFilter);
        if (search.trim()) params.append("search", search.trim());
        if (dateRange.from) params.append("startDate", dateRange.from.toISOString());
        if (dateRange.to) params.append("endDate", dateRange.to.toISOString());

        const res = await authFetch(`/activity-logs?${params}`, { method: "GET" });

        if (!res.ok) throw new Error("Failed to fetch logs");

        setData(res.data);
      } catch (error) {
        console.error(error);
        toast.error("Failed to fetch activity logs");
      } finally {
        setLoading(false);
      }
    },
    [page, actionFilter, moduleFilter, search, dateRange],
  );

  // Fetch on filter / page changes (except search — that's manual via button)
  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, actionFilter, moduleFilter, dateRange]);

  // ── Socket ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleNewLog = (newLog: ActivityLog) => {
      const { actionFilter: af, moduleFilter: mf } = filtersRef.current;
      const matchesAction = !af || af === "all" || newLog.action === af;
      const matchesModule = !mf || mf === "all" || newLog.module === mf;

      if (matchesAction && matchesModule) {
        setData((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            logs: [newLog, ...prev.logs].slice(0, LIMIT),
            total: prev.total + 1,
          };
        });
        toast.info(
          `New activity: ${newLog.action.replace(/_/g, " ")} by ${newLog.user?.email ?? "System"}`,
        );
      }
    };

    socket.on("activity_log", handleNewLog);
    return () => { socket.off("activity_log", handleNewLog); };
  }, [socket]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleSearch = () => {
    setPage(1);
    fetchLogs(1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const clearFilters = () => {
    setSearch("");
    setActionFilter("");
    setModuleFilter("");
    setDateRange({ from: undefined, to: undefined });
    setPage(1);
  };

  // Re-fetch when filters are cleared (page reset triggers fetchLogs via dep)
  const prevFiltersRef = useRef({ actionFilter, moduleFilter, dateRange });
  useEffect(() => {
    const prev = prevFiltersRef.current;
    const cleared =
      (prev.actionFilter && !actionFilter) ||
      (prev.moduleFilter && !moduleFilter) ||
      (prev.dateRange.from && !dateRange.from);
    if (cleared) fetchLogs(1);
    prevFiltersRef.current = { actionFilter, moduleFilter, dateRange };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionFilter, moduleFilter, dateRange]);

  // ── Print / Export ─────────────────────────────────────────────────────────
  const handlePrint = () => {
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Activity Logs</title>
      <style>
        body{font-family:Arial,sans-serif;padding:20px;color:#111}
        h1{text-align:center;margin-bottom:16px;font-size:18px}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th,td{border:1px solid #ddd;padding:5px 8px;text-align:left}
        th{background:#f4f4f4;font-weight:600}
        tr:nth-child(even){background:#fafafa}
      </style></head><body>
      <h1>Activity Logs — ${new Date().toLocaleString()}</h1>
      <table>
        <thead><tr>
          <th>Date/Time</th><th>User</th><th>Action</th>
          <th>Module</th><th>Description</th><th>IP Address</th><th>Status</th>
        </tr></thead>
        <tbody>
          ${data?.logs
            .map(
              (log) =>
                `<tr>
                  <td>${new Date(log.createdAt).toLocaleString()}</td>
                  <td>${log.user ? `${log.user.firstName} ${log.user.lastName}<br/><small>${log.user.email}</small>` : "System"}</td>
                  <td>${log.action.replace(/_/g, " ")}</td>
                  <td>${log.module ?? "-"}</td>
                  <td>${log.description ?? "-"}</td>
                  <td>${log.ipAddress ?? "-"}</td>
                  <td>${log.status}</td>
                </tr>`,
            )
            .join("")}
        </tbody>
      </table></body></html>
    `);
    win.document.close();
    win.print();
  };

  const handleExportCSV = () => {
    if (!data?.logs.length) return;
    const headers = [
      "Date/Time", "User", "Email", "Action", "Module",
      "Entity", "Description", "IP Address", "Status", "Error",
    ];
    const rows = data.logs.map((log) => [
      new Date(log.createdAt).toLocaleString(),
      log.user ? `${log.user.firstName} ${log.user.lastName}` : "System",
      log.user?.email ?? "",
      log.action,
      log.module ?? "",
      log.entity ? `${log.entity}:${log.entityId}` : "",
      log.description ?? "",
      log.ipAddress ?? "",
      log.status,
      log.errorMessage ?? "",
    ]);
    const csv = [
      headers.join(","),
      ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `activity_logs_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    toast.success("CSV exported");
  };

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = data
    ? {
        total: data.total,
        success: data.logs.filter((l) => l.status === "success").length,
        failure: data.logs.filter((l) => l.status !== "success").length,
        logins: data.logs.filter((l) => l.action === "login").length,
      }
    : null;

  const hasActiveFilters =
    !!search || (!!actionFilter && actionFilter !== "all") ||
    (!!moduleFilter && moduleFilter !== "all") || !!dateRange.from;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Activity Logs
          </h2>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
            Monitor all system activities and user actions
            <Badge
              variant="outline"
              className="bg-emerald-50 text-emerald-700 border-emerald-200 animate-pulse text-[10px] px-1.5 py-0"
            >
              ● Live
            </Badge>
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={!data?.logs.length}
          >
            <Download className="h-4 w-4 mr-1.5" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            disabled={!data?.logs.length}
          >
            <Printer className="h-4 w-4 mr-1.5" />
            Print
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchLogs()}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-1.5", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Total Records"
            value={stats.total}
            icon={Activity}
            className="bg-muted/40"
          />
          <StatCard
            label="Successful"
            value={stats.success}
            icon={LogIn}
            className="bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
          />
          <StatCard
            label="Failed"
            value={stats.failure}
            icon={ShieldAlert}
            className="bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
          />
          <StatCard
            label="Logins (page)"
            value={stats.logins}
            icon={KeyRound}
            className="bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
          />
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filters
              {hasActiveFilters && (
                <Badge variant="secondary" className="text-xs">
                  Active
                </Badge>
              )}
            </CardTitle>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 text-xs gap-1">
                <X className="h-3 w-3" />
                Clear all
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search user, description, IP…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-9 h-9"
              />
            </div>

            {/* Action filter */}
            <Select value={actionFilter || "all"} onValueChange={(v) => { setActionFilter(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All Actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {availableActions.map((key) => {
                  const cfg = actionConfig[key];
                  const Icon = cfg?.icon;
                  return (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2 capitalize">
                        {Icon && <Icon className="h-3.5 w-3.5" />}
                        {cfg?.label ?? key.replace(/_/g, " ")}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {/* Module filter */}
            <Select value={moduleFilter || "all"} onValueChange={(v) => { setModuleFilter(v === "all" ? "" : v); setPage(1); }}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="All Modules" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                {availableModules.map((m) => (
                  <SelectItem key={m} value={m} className="capitalize">
                    {m.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Date range picker */}
            <DateRangePicker
              range={dateRange}
              onUpdate={({ range }) => {
                setDateRange(range);
                setPage(1);
              }}
              placeholder="Pick date range"
              isPreset
              align="end"
            />
          </div>

          <div className="flex justify-end">
            <Button size="sm" onClick={handleSearch} className="gap-1.5">
              <Search className="h-3.5 w-3.5" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-[160px]">Date / Time</TableHead>
                <TableHead className="w-[180px]">User</TableHead>
                <TableHead className="w-[140px]">Action</TableHead>
                <TableHead className="w-[120px]">Module</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[130px]">IP Address</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !data ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : !data?.logs.length ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Activity className="h-8 w-8 opacity-30" />
                      <p className="text-sm">No activity logs found</p>
                      {hasActiveFilters && (
                        <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs">
                          Clear filters
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                data.logs.map((log) => (
                  <TableRow
                    key={log.id}
                    className={cn(
                      "transition-colors",
                      log.status !== "success" && "bg-red-50/30 dark:bg-red-950/10",
                    )}
                  >
                    {/* Date */}
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      <div className="font-medium text-foreground">
                        {format(new Date(log.createdAt), "MMM d, yyyy")}
                      </div>
                      <div>{format(new Date(log.createdAt), "hh:mm:ss a")}</div>
                    </TableCell>

                    {/* User */}
                    <TableCell>
                      {log.user ? (
                        <div>
                          <p className="font-medium text-sm leading-tight">
                            {log.user.firstName} {log.user.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate max-w-[160px]">
                            {log.user.email}
                          </p>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">System</span>
                      )}
                    </TableCell>

                    {/* Action */}
                    <TableCell>
                      <ActionBadge action={log.action} />
                    </TableCell>

                    {/* Module */}
                    <TableCell>
                      {log.module ? (
                        <Badge variant="secondary" className="capitalize text-xs">
                          {log.module}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>

                    {/* Description */}
                    <TableCell
                      className="max-w-[280px] text-sm text-muted-foreground truncate"
                      title={log.description ?? ""}
                    >
                      {log.description ?? (
                        <span className="italic text-xs">No description</span>
                      )}
                    </TableCell>

                    {/* IP */}
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {log.ipAddress ?? "—"}
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      {log.status === "success" ? (
                        <Badge
                          variant="outline"
                          className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 text-xs"
                        >
                          Success
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-xs">
                          Failed
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {data && data.totalPages >= 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/20">
            <p className="text-xs text-muted-foreground">
              {data.total === 0
                ? "No entries"
                : `Showing ${(data.page - 1) * data.limit + 1}–${Math.min(
                    data.page * data.limit,
                    data.total,
                  )} of ${data.total.toLocaleString()} entries`}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1 || loading}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Prev
              </Button>
              <span className="text-xs font-medium px-1">
                {page} / {data.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs gap-1"
                onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
                disabled={page === data.totalPages || loading}
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
