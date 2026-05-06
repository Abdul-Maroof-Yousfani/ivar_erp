"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { createProject } from "@/lib/actions/tasks";

const COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"];
const ICONS = ["📁", "🚀", "💡", "🔧", "📊", "🎯", "⚡", "🌟", "🔥", "💼"];

export default function CreateProjectPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", code: "", color: COLORS[0], icon: ICONS[0],
    status: "active", visibility: "public", ownerId: "",
    startDate: "", dueDate: "",
  });

  function set(key: string, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Name is required");
    if (!form.code.trim()) return toast.error("Code is required");
    if (!form.ownerId.trim()) return toast.error("Owner ID is required");

    setSaving(true);
    const res = await createProject({
      ...form,
      startDate: form.startDate || undefined,
      dueDate: form.dueDate || undefined,
    });
    setSaving(false);

    if (res.status) {
      toast.success("Project created");
      router.push("/hr/tasks/projects");
    } else {
      toast.error((res as any).message || "Failed to create project");
    }
  }

  return (
    <PermissionGuard permissions="task.project.create">
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">New Project</h1>
            <p className="text-muted-foreground text-sm">Create a new task project</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 bg-card border rounded-xl p-6">
          {/* Name + Code */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Project Name *</Label>
              <Input value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Q2 Onboarding" />
            </div>
            <div className="space-y-1">
              <Label>Code *</Label>
              <Input value={form.code} onChange={e => set("code", e.target.value.toUpperCase())} placeholder="e.g. PROJ-001" />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => set("description", e.target.value)} placeholder="Optional project description" rows={3} />
          </div>

          {/* Owner */}
          <div className="space-y-1">
            <Label>Owner Employee ID *</Label>
            <Input value={form.ownerId} onChange={e => set("ownerId", e.target.value)} placeholder="Employee UUID" />
          </div>

          {/* Status + Visibility */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Visibility</Label>
              <Select value={form.visibility} onValueChange={v => set("visibility", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="department">Department</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Start Date</Label>
              <Input type="date" value={form.startDate} onChange={e => set("startDate", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Due Date</Label>
              <Input type="date" value={form.dueDate} onChange={e => set("dueDate", e.target.value)} />
            </div>
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${form.color === c ? "border-foreground scale-110" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                  onClick={() => set("color", c)}
                />
              ))}
            </div>
          </div>

          {/* Icon */}
          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="flex gap-2 flex-wrap">
              {ICONS.map(icon => (
                <button
                  key={icon}
                  type="button"
                  className={`w-9 h-9 rounded-lg border text-lg flex items-center justify-center transition-colors ${form.icon === icon ? "border-primary bg-primary/10" : "border-border hover:bg-muted"}`}
                  onClick={() => set("icon", icon)}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Project
            </Button>
          </div>
        </form>
      </div>
    </PermissionGuard>
  );
}
