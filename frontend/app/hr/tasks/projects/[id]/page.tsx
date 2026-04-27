"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  LayoutGrid, List, Calendar, ArrowLeft, Plus, MoreHorizontal,
  Loader2, Pencil, Trash2, CheckCircle2, Circle, Clock, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PermissionGuard } from "@/components/auth/permission-guard";
import {
  getProject, getTaskLists, getTasks, createTask, createTaskList,
  deleteTaskList, changeTaskStatus, deleteTask, reorderTasks,
  type TaskProject, type TaskList, type Task,
} from "@/lib/actions/tasks";
import { format, isPast, isToday } from "date-fns";

type ViewMode = "board" | "list" | "calendar";

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "text-red-600 bg-red-50",
  high: "text-orange-600 bg-orange-50",
  medium: "text-yellow-600 bg-yellow-50",
  low: "text-blue-600 bg-blue-50",
  none: "text-gray-500 bg-gray-50",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  todo: <Circle className="h-3.5 w-3.5 text-gray-400" />,
  in_progress: <Clock className="h-3.5 w-3.5 text-blue-500" />,
  in_review: <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />,
  done: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  cancelled: <Circle className="h-3.5 w-3.5 text-gray-300" />,
};

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({ task, onStatusChange, onDelete, draggable, onDragStart, onDragOver, onDrop }: {
  task: Task;
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, taskId: string) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent, listId: string) => void;
}) {
  const isOverdue = task.dueDate && isPast(new Date(task.dueDate)) && task.status !== "done";

  return (
    <div
      className="bg-card border rounded-lg p-3 space-y-2 hover:shadow-sm transition-shadow group cursor-grab active:cursor-grabbing"
      draggable={draggable}
      onDragStart={e => onDragStart?.(e, task.id)}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-snug flex-1">{task.title}</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {["todo", "in_progress", "in_review", "done", "cancelled"].map(s => (
              <DropdownMenuItem key={s} onClick={() => onStatusChange(task.id, s)} disabled={task.status === s}>
                {STATUS_ICONS[s]} <span className="ml-2 capitalize">{s.replace("_", " ")}</span>
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem className="text-destructive" onClick={() => onDelete(task.id)}>
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {task.priority !== "none" && (
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium capitalize ${PRIORITY_COLORS[task.priority]}`}>
            {task.priority}
          </span>
        )}
        {task.dueDate && (
          <span className={`text-xs flex items-center gap-1 ${isOverdue ? "text-red-500" : "text-muted-foreground"}`}>
            <Clock className="h-3 w-3" />
            {format(new Date(task.dueDate), "MMM d")}
          </span>
        )}
        {(task._count?.subtasks ?? 0) > 0 && (
          <span className="text-xs text-muted-foreground">{task._count?.subtasks} subtasks</span>
        )}
      </div>

      {task.assignees && task.assignees.length > 0 && (
        <div className="flex -space-x-1">
          {task.assignees.slice(0, 3).map(a => (
            <div key={a.id} className="w-5 h-5 rounded-full bg-primary/20 border border-background flex items-center justify-center text-[9px] font-bold text-primary">
              {a.employeeId.slice(0, 1).toUpperCase()}
            </div>
          ))}
          {task.assignees.length > 3 && (
            <div className="w-5 h-5 rounded-full bg-muted border border-background flex items-center justify-center text-[9px] text-muted-foreground">
              +{task.assignees.length - 3}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Board View ───────────────────────────────────────────────────────────────

function BoardView({ lists, tasks, onStatusChange, onDelete, onAddTask, onAddList, onDeleteList }: {
  lists: TaskList[];
  tasks: Task[];
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
  onAddTask: (listId: string) => void;
  onAddList: () => void;
  onDeleteList: (id: string) => void;
}) {
  const [dragTaskId, setDragTaskId] = useState<string | null>(null);

  function handleDragStart(e: React.DragEvent, taskId: string) {
    setDragTaskId(taskId);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  async function handleDrop(e: React.DragEvent, listId: string) {
    e.preventDefault();
    if (!dragTaskId) return;
    const listTaskIds = tasks.filter(t => t.listId === listId).map(t => t.id);
    if (!listTaskIds.includes(dragTaskId)) listTaskIds.push(dragTaskId);
    await reorderTasks(listTaskIds, listId);
    setDragTaskId(null);
    // Parent will reload
    window.dispatchEvent(new CustomEvent("task-reordered"));
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-220px)]">
      {lists.map(list => {
        const listTasks = tasks.filter(t => t.listId === list.id);
        return (
          <div
            key={list.id}
            className="flex-shrink-0 w-72 flex flex-col gap-2"
            onDragOver={handleDragOver}
            onDrop={e => handleDrop(e, list.id)}
          >
            {/* Column header */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                {list.color && <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: list.color }} />}
                <span className="font-medium text-sm">{list.name}</span>
                <span className="text-xs text-muted-foreground bg-muted rounded-full px-1.5">{listTasks.length}</span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onAddTask(list.id)}><Plus className="mr-2 h-3.5 w-3.5" /> Add Task</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={() => onDeleteList(list.id)}><Trash2 className="mr-2 h-3.5 w-3.5" /> Delete List</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Tasks */}
            <div className="flex flex-col gap-2 flex-1 min-h-[100px] rounded-lg p-1">
              {listTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onStatusChange={onStatusChange}
                  onDelete={onDelete}
                  draggable
                  onDragStart={handleDragStart}
                  onDragOver={handleDragOver}
                />
              ))}
            </div>

            <Button variant="ghost" size="sm" className="w-full text-muted-foreground justify-start" onClick={() => onAddTask(list.id)}>
              <Plus className="mr-1 h-3.5 w-3.5" /> Add task
            </Button>
          </div>
        );
      })}

      {/* Add list */}
      <div className="flex-shrink-0 w-72">
        <Button variant="outline" className="w-full border-dashed" onClick={onAddList}>
          <Plus className="mr-2 h-4 w-4" /> Add List
        </Button>
      </div>
    </div>
  );
}

// ─── List View ────────────────────────────────────────────────────────────────

function ListView({ tasks, onStatusChange, onDelete }: {
  tasks: Task[];
  onStatusChange: (id: string, status: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="border rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 border-b">
          <tr>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Task</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-28">Status</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-24">Priority</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-28">Due Date</th>
            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-20">Progress</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {tasks.length === 0 ? (
            <tr><td colSpan={6} className="text-center py-10 text-muted-foreground">No tasks</td></tr>
          ) : tasks.map(task => {
            const isOverdue = task.dueDate && isPast(new Date(task.dueDate)) && task.status !== "done";
            return (
              <tr key={task.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    {STATUS_ICONS[task.status]}
                    <span className={task.status === "done" ? "line-through text-muted-foreground" : ""}>{task.title}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5">
                  <Select value={task.status} onValueChange={v => onStatusChange(task.id, v)}>
                    <SelectTrigger className="h-7 text-xs w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["todo", "in_progress", "in_review", "done", "cancelled"].map(s => (
                        <SelectItem key={s} value={s} className="text-xs capitalize">{s.replace("_", " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-4 py-2.5">
                  <span className={`text-xs px-1.5 py-0.5 rounded capitalize ${PRIORITY_COLORS[task.priority]}`}>{task.priority}</span>
                </td>
                <td className={`px-4 py-2.5 text-xs ${isOverdue ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                  {task.dueDate ? format(new Date(task.dueDate), "MMM d, yyyy") : "—"}
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden w-16">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${task.completionPercentage}%` }} />
                    </div>
                    <span className="text-xs text-muted-foreground">{task.completionPercentage}%</span>
                  </div>
                </td>
                <td className="px-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem className="text-destructive" onClick={() => onDelete(task.id)}>
                        <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Calendar View ────────────────────────────────────────────────────────────

function CalendarView({ tasks }: { tasks: Task[] }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Array.from({ length: firstDay + daysInMonth }, (_, i) => i < firstDay ? null : i - firstDay + 1);

  const tasksByDay: Record<number, Task[]> = {};
  tasks.forEach(t => {
    if (!t.dueDate) return;
    const d = new Date(t.dueDate);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!tasksByDay[day]) tasksByDay[day] = [];
      tasksByDay[day].push(t);
    }
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{format(currentDate, "MMMM yyyy")}</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date(year, month - 1, 1))}>‹</Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Today</Button>
          <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date(year, month + 1, 1))}>›</Button>
        </div>
      </div>

      <div className="border rounded-xl overflow-hidden">
        <div className="grid grid-cols-7 bg-muted/50 border-b">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
            <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const dayTasks = day ? (tasksByDay[day] || []) : [];
            const isCurrentDay = day !== null && isToday(new Date(year, month, day));
            return (
              <div key={i} className={`min-h-[90px] border-b border-r p-1.5 ${!day ? "bg-muted/20" : ""} ${isCurrentDay ? "bg-primary/5" : ""}`}>
                {day && (
                  <>
                    <span className={`text-xs font-medium ${isCurrentDay ? "bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center" : "text-muted-foreground"}`}>
                      {day}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {dayTasks.slice(0, 3).map(t => (
                        <div key={t.id} className={`text-[10px] px-1 py-0.5 rounded truncate ${PRIORITY_COLORS[t.priority]}`}>
                          {t.title}
                        </div>
                      ))}
                      {dayTasks.length > 3 && (
                        <div className="text-[10px] text-muted-foreground px-1">+{dayTasks.length - 3} more</div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProjectBoardPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<ViewMode>((searchParams.get("view") as ViewMode) || "board");

  const [project, setProject] = useState<TaskProject | null>(null);
  const [lists, setLists] = useState<TaskList[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Add task dialog
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [addTaskListId, setAddTaskListId] = useState("");
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("none");
  const [savingTask, setSavingTask] = useState(false);

  // Add list dialog
  const [addListOpen, setAddListOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [savingList, setSavingList] = useState(false);

  const hasFetched = useRef(false);

  const load = useCallback(async () => {
    const [projRes, listsRes, tasksRes] = await Promise.all([
      getProject(id),
      getTaskLists(id),
      getTasks({ projectId: id }),
    ]);
    if (projRes.status) setProject((projRes as any).data);
    if (listsRes.status) setLists((listsRes as any).data || []);
    if (tasksRes.status) setTasks((tasksRes as any).data || []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    load();
  }, [load]);

  useEffect(() => {
    const handler = () => load();
    window.addEventListener("task-reordered", handler);
    return () => window.removeEventListener("task-reordered", handler);
  }, [load]);

  async function handleStatusChange(taskId: string, status: string) {
    const res = await changeTaskStatus(taskId, status);
    if (res.status) {
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status } : t));
    } else {
      toast.error((res as any).message || "Failed");
    }
  }

  async function handleDeleteTask(taskId: string) {
    const res = await deleteTask(taskId);
    if (res.status) {
      setTasks(prev => prev.filter(t => t.id !== taskId));
      toast.success("Task deleted");
    } else {
      toast.error((res as any).message || "Failed");
    }
  }

  async function handleAddTask() {
    if (!newTaskTitle.trim()) return toast.error("Title required");
    setSavingTask(true);
    const res = await createTask({ projectId: id, listId: addTaskListId, title: newTaskTitle, priority: newTaskPriority });
    setSavingTask(false);
    if (res.status) {
      toast.success("Task created");
      setAddTaskOpen(false);
      setNewTaskTitle("");
      setNewTaskPriority("none");
      load();
    } else {
      toast.error((res as any).message || "Failed");
    }
  }

  async function handleAddList() {
    if (!newListName.trim()) return toast.error("Name required");
    setSavingList(true);
    const res = await createTaskList(id, { name: newListName });
    setSavingList(false);
    if (res.status) {
      toast.success("List created");
      setAddListOpen(false);
      setNewListName("");
      load();
    } else {
      toast.error((res as any).message || "Failed");
    }
  }

  async function handleDeleteList(listId: string) {
    const res = await deleteTaskList(listId);
    if (res.status) {
      setLists(prev => prev.filter(l => l.id !== listId));
      setTasks(prev => prev.filter(t => t.listId !== listId));
      toast.success("List deleted");
    } else {
      toast.error((res as any).message || "Failed");
    }
  }

  function openAddTask(listId: string) {
    setAddTaskListId(listId);
    setAddTaskOpen(true);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return <div className="p-6 text-muted-foreground">Project not found.</div>;
  }

  return (
    <PermissionGuard permissions="task.read">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between gap-4 bg-background sticky top-0 z-10">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" onClick={() => router.push("/hr/tasks/projects")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="text-xl">{project.icon || "📁"}</span>
            <div className="min-w-0">
              <h1 className="font-semibold truncate">{project.name}</h1>
              <p className="text-xs text-muted-foreground font-mono">{project.code}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View switcher */}
            <div className="flex border rounded-lg overflow-hidden">
              {([["board", LayoutGrid], ["list", List], ["calendar", Calendar]] as [ViewMode, any][]).map(([v, Icon]) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 flex items-center gap-1.5 text-xs transition-colors ${view === v ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"}`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="capitalize">{v}</span>
                </button>
              ))}
            </div>

            <Button size="sm" onClick={() => { setAddTaskListId(lists[0]?.id || ""); setAddTaskOpen(true); }} disabled={lists.length === 0}>
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Task
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {view === "board" && (
            <BoardView
              lists={lists}
              tasks={tasks}
              onStatusChange={handleStatusChange}
              onDelete={handleDeleteTask}
              onAddTask={openAddTask}
              onAddList={() => setAddListOpen(true)}
              onDeleteList={handleDeleteList}
            />
          )}
          {view === "list" && (
            <ListView tasks={tasks} onStatusChange={handleStatusChange} onDelete={handleDeleteTask} />
          )}
          {view === "calendar" && <CalendarView tasks={tasks} />}
        </div>
      </div>

      {/* Add Task Dialog */}
      <Dialog open={addTaskOpen} onOpenChange={setAddTaskOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>New Task</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Input
                placeholder="Task title"
                value={newTaskTitle}
                onChange={e => setNewTaskTitle(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleAddTask()}
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Select value={addTaskListId} onValueChange={setAddTaskListId}>
                <SelectTrigger><SelectValue placeholder="Select list" /></SelectTrigger>
                <SelectContent>
                  {lists.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Select value={newTaskPriority} onValueChange={setNewTaskPriority}>
                <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                <SelectContent>
                  {["none", "low", "medium", "high", "urgent"].map(p => (
                    <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddTaskOpen(false)}>Cancel</Button>
            <Button onClick={handleAddTask} disabled={savingTask}>
              {savingTask && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add List Dialog */}
      <Dialog open={addListOpen} onOpenChange={setAddListOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>New List</DialogTitle></DialogHeader>
          <div className="py-2">
            <Input
              placeholder="List name (e.g. To Do)"
              value={newListName}
              onChange={e => setNewListName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddList()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddListOpen(false)}>Cancel</Button>
            <Button onClick={handleAddList} disabled={savingList}>
              {savingList && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PermissionGuard>
  );
}
