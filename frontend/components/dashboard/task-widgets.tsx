"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock, AlertTriangle, TrendingUp, Users } from "lucide-react";
import { getTaskAdminWidgets, getTaskEmployeeWidgets } from "@/lib/actions/tasks";
import { format, isPast } from "date-fns";

// ─── Admin Task Widgets ───────────────────────────────────────────────────────

export function AdminTaskWidgets() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    getTaskAdminWidgets().then(res => { if (res.status) setData((res as any).data); });
  }, []);

  if (!data) return null;

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Task Overview</h3>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <div
          className="border rounded-xl p-4 space-y-1 cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => router.push("/hr/tasks/projects")}
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span className="text-xs">Due Today</span>
          </div>
          <p className="text-2xl font-bold">{data.dueToday ?? 0}</p>
        </div>

        <div className="border rounded-xl p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span className="text-xs">Overdue</span>
          </div>
          <p className="text-2xl font-bold text-red-600">{data.overdue?.count ?? 0}</p>
        </div>

        <div className="border rounded-xl p-4 space-y-1 col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-xs">Completion Rate This Week</span>
            </div>
            <span className="text-sm font-semibold">{data.completionRateThisWeek ?? 0}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${data.completionRateThisWeek ?? 0}%` }}
            />
          </div>
        </div>
      </div>

      {/* Top employees */}
      {data.topEmployeesThisMonth?.length > 0 && (
        <div className="border rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-xs font-medium">Top Performers This Month</span>
          </div>
          <div className="space-y-2">
            {data.topEmployeesThisMonth.slice(0, 5).map((emp: any, i: number) => (
              <div key={emp.employeeId} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                  <span className="font-mono text-xs text-muted-foreground truncate max-w-[120px]">{emp.employeeId.slice(0, 8)}…</span>
                </div>
                <span className="font-semibold text-xs">{emp.tasksCompleted} tasks</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Overdue list */}
      {data.overdue?.items?.length > 0 && (
        <div className="border rounded-xl p-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Overdue Tasks</p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {data.overdue.items.slice(0, 8).map((task: any) => (
              <div key={task.id} className="flex items-center justify-between text-xs">
                <span className="truncate flex-1 text-red-600">{task.title}</span>
                <span className="text-muted-foreground ml-2 shrink-0">
                  {task.dueDate ? format(new Date(task.dueDate), "MMM d") : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Employee Task Widgets ────────────────────────────────────────────────────

export function EmployeeTaskWidgets() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    getTaskEmployeeWidgets().then(res => { if (res.status) setData((res as any).data); });
  }, []);

  if (!data) return null;

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">My Tasks</h3>

      <div className="grid grid-cols-3 gap-3">
        <div
          className="border rounded-xl p-3 space-y-1 cursor-pointer hover:bg-muted/30 transition-colors"
          onClick={() => router.push("/hr/tasks/my-tasks")}
        >
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span className="text-xs">Open</span>
          </div>
          <p className="text-xl font-bold">{data.openTasks ?? 0}</p>
        </div>

        <div className="border rounded-xl p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
            <span className="text-xs">Overdue</span>
          </div>
          <p className={`text-xl font-bold ${data.overdueTasks > 0 ? "text-red-600" : ""}`}>{data.overdueTasks ?? 0}</p>
        </div>

        <div className="border rounded-xl p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5 text-green-500" />
            <span className="text-xs">Rate</span>
          </div>
          <p className="text-xl font-bold">{data.completionRateThisMonth ?? 0}%</p>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Completion this month</span>
          <span>{data.completionRateThisMonth ?? 0}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${data.completionRateThisMonth ?? 0}%` }}
          />
        </div>
      </div>

      <button
        onClick={() => router.push("/hr/tasks/my-tasks")}
        className="w-full text-xs text-primary hover:underline text-left"
      >
        View all my tasks →
      </button>
    </div>
  );
}
