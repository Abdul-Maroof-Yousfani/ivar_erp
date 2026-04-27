"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Folder, MoreHorizontal, Archive, Trash2, Users, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { getProjects, deleteProject, updateProject, type TaskProject } from "@/lib/actions/tasks";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  archived: "bg-gray-100 text-gray-600",
  on_hold: "bg-yellow-100 text-yellow-700",
};

export default function TaskProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<TaskProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<TaskProject | null>(null);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    load();
  }, []);

  async function load() {
    setLoading(true);
    const res = await getProjects();
    if (res.status) setProjects((res as any).data || []);
    else toast.error((res as any).message || "Failed to load projects");
    setLoading(false);
  }

  async function handleArchive(p: TaskProject) {
    const res = await updateProject(p.id, { status: p.status === "archived" ? "active" : "archived" });
    if (res.status) { toast.success("Project updated"); load(); }
    else toast.error((res as any).message || "Failed");
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const res = await deleteProject(deleteTarget.id);
    if (res.status) { toast.success("Project deleted"); setProjects(prev => prev.filter(p => p.id !== deleteTarget.id)); }
    else toast.error((res as any).message || "Failed");
    setDeleteTarget(null);
  }

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <PermissionGuard permissions="task.project.read">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Task Projects</h1>
            <p className="text-muted-foreground text-sm">Manage and track all task projects</p>
          </div>
          <PermissionGuard permissions="task.project.create">
            <Button onClick={() => router.push("/hr/tasks/projects/create")}>
              <Plus className="mr-2 h-4 w-4" /> New Project
            </Button>
          </PermissionGuard>
        </div>

        {/* Search */}
        <Input
          placeholder="Search projects..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-sm"
        />

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-44 rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
            <Folder className="h-12 w-12 opacity-30" />
            <p className="text-sm">No projects found</p>
            <Button variant="outline" size="sm" onClick={() => router.push("/hr/tasks/projects/create")}>
              Create your first project
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(project => (
              <div
                key={project.id}
                className="group relative rounded-xl border bg-card p-5 hover:shadow-md transition-shadow cursor-pointer"
                style={{ borderLeftColor: project.color || "#6366f1", borderLeftWidth: 4 }}
                onClick={() => router.push(`/hr/tasks/projects/${project.id}`)}
              >
                {/* Actions */}
                <div className="absolute top-3 right-3" onClick={e => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => router.push(`/hr/tasks/projects/${project.id}`)}>
                        Open
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleArchive(project)}>
                        <Archive className="mr-2 h-4 w-4" />
                        {project.status === "archived" ? "Unarchive" : "Archive"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => setDeleteTarget(project)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Content */}
                <div className="space-y-3">
                  <div className="flex items-start gap-2">
                    <span className="text-xl">{project.icon || "📁"}</span>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{project.name}</p>
                      <p className="text-xs text-muted-foreground font-mono">{project.code}</p>
                    </div>
                  </div>

                  {project.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{project.description}</p>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge className={`text-xs ${STATUS_COLORS[project.status] || ""}`} variant="outline">
                      {project.status.replace("_", " ")}
                    </Badge>
                    <Badge variant="outline" className="text-xs capitalize">{project.visibility}</Badge>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {project.members?.length ?? 0} members
                    </span>
                    {project.dueDate && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(project.dueDate), "MMM d, yyyy")}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <strong>{deleteTarget?.name}</strong>? All tasks, lists, and data will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PermissionGuard>
  );
}
