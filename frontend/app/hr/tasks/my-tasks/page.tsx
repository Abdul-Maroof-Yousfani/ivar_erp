"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Circle, Clock, AlertCircle, AlertTriangle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { getMyTasks, changeTaskStatus, type Task } from "@/lib/actions/tasks";
import { format, isPast } from "date-fns";

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "text-red-600 bg-red-50 border-red-200",
  high: "text-orange-600 bg-orange-50 border-orange-200",
  medium: "text-yellow-600 bg-yellow-50 border-yellow-200",
  low: "text-blue-600 bg-blue-50 border-blue-200",
  none: "text-gray-500 bg-gray-50 border-gray-200",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  todo: <Circle className="h-4 w-4 text-gray-400" />,
  in_progress: <Clock className="h-4 w-4 text-blue-500" />,
  in_review: <AlertCircle className="h-4 w-4 text-yellow-500" />,
  done: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  cancelled: <Circle className="h-4 w-4 text-gray-300" />,
};

interface GroupedTasks {
  overdue: Task[];
  today: Task[];
  thisWeek: Task[];
  noDueDate: Task[];
}

function TaskRow({ task, onStatusChange }: { task: Task; onStatusChange: (id: string, status: string) => void }) {
  const isOverdue = task.dueDate && isPast(new Date(task.dueDate)) && task.status !== "done";

  return (
    <div className="flex items-center gap-3 py-2.5 px-4 hover:bg-muted/30 rounded-lg transition-colors group">
      <div className="shrink-0">{STATUS_ICONS[task.status]}</div>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>
          {task.title}
        </p>
        {task.dueDate && (
          <p className={`text-xs mt-0.5 ${isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
            {isOverdue ? "Overdue · " : "Due "}{format(new Date(task.dueDate), "MMM d, yyyy")}
          </p>
        )}
      </div>

      {task.priority !== "none" && (
        <span className={`text-xs px-1.5 py-0.5 rounded border capitalize shrink-0 ${PRIORITY_COLORS[task.priority]}`}>
          {task.priority}
        </span>
      )}

      <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <Select value={task.status} onValueChange={v => onStatusChange(task.id, v)}>
          <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["todo", "in_progress", "in_review", "done", "cancelled"].map(s => (
              <SelectItem key={s} value={s} className="text-xs capitalize">{s.replace("_", " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function TaskGroup({ title, tasks, icon, onStatusChange, defaultOpen = true }: {
  title: string;
  tasks: Task[];
  icon: React.ReactNode;
  onStatusChange: (id: string, status: string) => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  if (tasks.length === 0) return null;

  return (
    <div className="space-y-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left px-1 py-1 hover:bg-muted/30 rounded-lg transition-colors"
      >
        {icon}
        <span className="font-semibold text-sm">{title}</span>
        <span className="text-xs text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">{tasks.length}</span>
        <span className="ml-auto text-muted-foreground text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="border rounded-xl overflow-hidden divide-y">
          {tasks.map(task => (
            <TaskRow key={task.id} task={task} onStatusChange={onStatusChange} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function MyTasksPage() {
  const [grouped, setGrouped] = useState<GroupedTasks | null>(null);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    load();
  }, []);

  async function load() {
    setLoading(true);
    const res = await getMyTasks();
    if (res.status) setGrouped((res as any).data);
    else toast.error((res as any).message || "Failed to load tasks");
    setLoading(false);
  }

  async function handleStatusChange(taskId: string, status: string) {
    const res = await changeTaskStatus(taskId, status);
    if (res.status) {
      // Optimistic update across all groups
      setGrouped(prev => {
        if (!prev) return prev;
        const update = (arr: Task[]) => arr.map(t => t.id === taskId ? { ...t, status } : t);
        return {
          overdue: update(prev.overdue),
          today: update(prev.today),
          thisWeek: update(prev.thisWeek),
          noDueDate: update(prev.noDueDate),
        };
      });
    } else {
      toast.error((res as any).message || "Failed");
    }
  }

  const totalOpen = grouped
    ? grouped.overdue.length + grouped.today.length + grouped.thisWeek.length + grouped.noDueDate.length
    : 0;

  return (
    <PermissionGuard permissions="task.read">
      <div className="p-6 space-y-6 max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">My Tasks</h1>
            <p className="text-muted-foreground text-sm">
              {loading ? "Loading..." : `${totalOpen} open task${totalOpen !== 1 ? "s" : ""}`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !grouped || totalOpen === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <CheckCircle2 className="h-12 w-12 opacity-30" />
            <p className="text-sm font-medium">All caught up!</p>
            <p className="text-xs">No open tasks assigned to you.</p>
          </div>
        ) : (
          <div className="space-y-5">
            <TaskGroup
              title="Overdue"
              tasks={grouped.overdue}
              icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
              onStatusChange={handleStatusChange}
            />
            <TaskGroup
              title="Today"
              tasks={grouped.today}
              icon={<Clock className="h-4 w-4 text-orange-500" />}
              onStatusChange={handleStatusChange}
            />
            <TaskGroup
              title="This Week"
              tasks={grouped.thisWeek}
              icon={<Circle className="h-4 w-4 text-blue-500" />}
              onStatusChange={handleStatusChange}
            />
            <TaskGroup
              title="No Due Date"
              tasks={grouped.noDueDate}
              icon={<Circle className="h-4 w-4 text-gray-400" />}
              onStatusChange={handleStatusChange}
              defaultOpen={false}
            />
          </div>
        )}
      </div>
    </PermissionGuard>
  );
}
