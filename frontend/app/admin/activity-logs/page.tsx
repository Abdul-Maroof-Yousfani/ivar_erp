"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/components/providers/auth-provider";
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
import { Loader2, Search, Printer, Download, RefreshCw, Filter, ChevronLeft, ChevronRight, Activity } from "lucide-react";
import { toast } from "sonner";
import { useSocket } from "@/components/providers/socket-provider";
import { authFetch } from "@/lib/auth";

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

const actionColors: Record<string, string> = {
  login: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  logout: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  create: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  update: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  delete: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  password_change: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
};

const modules = ["auth", "employees", "departments", "payroll", "leaves", "attendance", "roles", "users"];
const actions = ["login", "logout", "create", "update", "delete", "password_change", "logout_all_devices"];

export default function ActivityLogsPage() {
  const [data, setData] = useState<PaginationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("");
  const [moduleFilter, setModuleFilter] = useState<string>("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;
  const { socket } = useSocket();

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });
      if (actionFilter && actionFilter !== "all") params.append('action', actionFilter);
      if (moduleFilter && moduleFilter !== "all") params.append('module', moduleFilter);
      if (search) params.append('search', search);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await authFetch(`/activity-logs?${params}`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) {
        throw new Error('Failed to fetch logs');
      }

      const result = await res.data;
      setData(result);
    } catch (error) {
      console.error(error);
      toast.error("Failed to fetch activity logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter, moduleFilter, startDate, endDate]);

  useEffect(() => {
    if (!socket) return;

    const handleNewLog = (newLog: ActivityLog) => {
      let matches = true;
      if (actionFilter && actionFilter !== "all" && newLog.action !== actionFilter) matches = false;
      if (moduleFilter && moduleFilter !== "all" && newLog.module !== moduleFilter) matches = false;

      if (matches) {
        setData(prev => {
          if (!prev) return null;
          const newLogs = [newLog, ...prev.logs].slice(0, limit);
          return {
            ...prev,
            logs: newLogs,
            total: prev.total + 1,
          };
        });
        toast.info(`New activity: ${newLog.action} by ${newLog.user?.email || 'System'}`);
      }
    };

    socket.on('activity_log', handleNewLog);

    return () => {
      socket.off('activity_log', handleNewLog);
    };
  }, [socket, actionFilter, moduleFilter]); // Re-connect or just update listener logic? 
  // Updating listener logic is better. But with useEffect dependency it will reconnect. 
  // Better to use a ref for filters or just always update state and let the filter logic inside 'on' handle it.
  // However, the 'on' callback captures the scope variables. 
  // To avoid reconnecting, we can use a ref for the current filters.

  // Ref approach for filters to avoid reconnecting socket
  const filtersRef = useRef({ actionFilter, moduleFilter });
  useEffect(() => {
    filtersRef.current = { actionFilter, moduleFilter };
  }, [actionFilter, moduleFilter]);

  // Wait, I put [actionFilter, moduleFilter] in the socket useEffect dependency, so it reconnects.
  // That's fine for now, it ensures the closure has fresh values.

  const handleSearch = () => {
    setPage(1);
    fetchLogs();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const clearFilters = () => {
    setSearch("");
    setActionFilter("");
    setModuleFilter("");
    setStartDate("");
    setEndDate("");
    setPage(1);
    // fetchLogs will trigger due to dependency change (except search)
    // If search is not in dependency, we need to call fetchLogs manually or add it.
    // Let's add search to dependency of fetchLogs useEffect but only if we want auto-search.
    // If not, we should call fetchLogs here.
    // But since other states change, it will trigger.
  };

  // Re-trigger fetch when search is cleared?
  useEffect(() => {
    if (search === "") fetchLogs();
  }, [search]);

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Activity Logs</title>
      <style>body{font-family:Arial;padding:20px}table{width:100%;border-collapse:collapse;font-size:10px}th,td{border:1px solid #ddd;padding:4px;text-align:left}th{background:#f4f4f4}h1{text-align:center}</style>
      </head><body><h1>Activity Logs</h1>
      <table><thead><tr><th>Date/Time</th><th>User</th><th>Action</th><th>Module</th><th>Description</th><th>IP Address</th><th>Status</th></tr></thead>
      <tbody>${data?.logs.map((log) => `<tr><td>${new Date(log.createdAt).toLocaleString()}</td><td>${log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System'}</td><td>${log.action}</td><td>${log.module || '-'}</td><td>${log.description || '-'}</td><td>${log.ipAddress || '-'}</td><td>${log.status}</td></tr>`).join("")}</tbody></table></body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleExportCSV = () => {
    if (!data?.logs) return;
    const headers = ["Date/Time", "User", "Email", "Action", "Module", "Entity", "Description", "IP Address", "Status", "Error"];
    const rows = data.logs.map((log) => [
      new Date(log.createdAt).toLocaleString(),
      log.user ? `${log.user.firstName} ${log.user.lastName}` : "System",
      log.user?.email || "",
      log.action,
      log.module || "",
      log.entity ? `${log.entity}:${log.entityId}` : "",
      log.description || "",
      log.ipAddress || "",
      log.status,
      log.errorMessage || "",
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${c}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `activity_logs_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    toast.success("CSV exported");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Activity Logs</h2>
          <p className="text-muted-foreground flex items-center gap-2">
            Monitor all system activities and user actions
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 animate-pulse">
              <Activity className="w-3 h-3 mr-1" /> Realtime
            </Badge>
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV} disabled={!data?.logs.length}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button variant="outline" onClick={handlePrint} disabled={!data?.logs.length}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button variant="outline" onClick={() => fetchLogs()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-9"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {actions.map((action) => (
                  <SelectItem key={action} value={action}>
                    {action.charAt(0).toUpperCase() + action.slice(1).replace('_', ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={moduleFilter} onValueChange={setModuleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by Module" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Modules</SelectItem>
                {modules.map((module) => (
                  <SelectItem key={module} value={module}>
                    {module.charAt(0).toUpperCase() + module.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="Start Date"
            />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="End Date"
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={handleSearch}>Apply Search</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date/Time</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && !data ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : data?.logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No activity logs found
                  </TableCell>
                </TableRow>
              ) : (
                data?.logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {log.user ? (
                        <div className="flex flex-col">
                          <span className="font-medium">{log.user.firstName} {log.user.lastName}</span>
                          <span className="text-xs text-muted-foreground">{log.user.email}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">System</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={actionColors[log.action] || "bg-gray-100"}>
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {log.module ? (
                        <Badge variant="secondary" className="capitalize">
                          {log.module}
                        </Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="max-w-[300px] truncate" title={log.description || ""}>
                      {log.description || "-"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{log.ipAddress || "-"}</TableCell>
                    <TableCell>
                      {log.status === "success" ? (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          Success
                        </Badge>
                      ) : (
                        <Badge variant="destructive">Failure</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
        {data && data.totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t">
            <div className="text-sm text-muted-foreground">
              Showing {(data.page - 1) * data.limit + 1} to {Math.min(data.page * data.limit, data.total)} of {data.total} entries
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <div className="text-sm font-medium">
                Page {page} of {data.totalPages}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                disabled={page === data.totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
