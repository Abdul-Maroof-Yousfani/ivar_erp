"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import DataTable, { type FilterConfig } from "@/components/common/data-table";
import { ColumnDef } from "@tanstack/react-table";
import {
  getKpiTemplates, createKpiTemplate, updateKpiTemplate, deleteKpiTemplate,
  type KpiTemplate,
} from "@/lib/actions/kpi";

const CATEGORIES = ["attendance", "performance", "productivity", "custom"];
const METRIC_TYPES = ["manual", "auto"];
const AUTO_FORMULAS = [
  { value: "attendance_rate", label: "Attendance Rate" },
  { value: "leave_utilization", label: "Leave Utilization" },
  { value: "overtime_hours", label: "Overtime Hours" },
  { value: "punctuality_score", label: "Punctuality Score" },
];

const emptyForm = {
  name: "", description: "", category: "performance", metricType: "manual",
  formula: "", unit: "%", targetValue: 100, weight: 1,
};

export default function KpiTemplatesPage() {
  const [templates, setTemplates] = useState<KpiTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<KpiTemplate | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState<KpiTemplate | null>(null);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    fetchTemplates();
  }, []);

  async function fetchTemplates() {
    setLoading(true);
    const res = await getKpiTemplates();
    if (res.status) setTemplates(res.data || []);
    else toast.error(res.message || "Failed to load templates");
    setLoading(false);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(t: KpiTemplate) {
    setEditing(t);
    setForm({
      name: t.name,
      description: t.description || "",
      category: t.category,
      metricType: t.metricType,
      formula: t.formula || "",
      unit: t.unit || "%",
      targetValue: Number(t.targetValue) || 100,
      weight: Number(t.weight) || 1,
    });
    setFormOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return toast.error("Name is required");
    setSaving(true);
    const payload = {
      ...form,
      formula: form.metricType === "auto" ? form.formula : undefined,
    };
    const res = editing
      ? await updateKpiTemplate(editing.id, payload)
      : await createKpiTemplate(payload);
    setSaving(false);
    if (res.status) {
      toast.success(editing ? "Template updated" : "Template created");
      setFormOpen(false);
      fetchTemplates();
    } else {
      toast.error(res.message || "Failed to save template");
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    const res = await deleteKpiTemplate(deleting.id);
    if (res.status) {
      toast.success("Template deleted");
      setTemplates((prev) => prev.filter((t) => t.id !== deleting.id));
    } else {
      toast.error(res.message || "Failed to delete template");
    }
    setDeleteDialog(false);
    setDeleting(null);
  }

  const columns: ColumnDef<KpiTemplate>[] = [
    { accessorKey: "name", header: "Name" },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize">{row.original.category}</Badge>
      ),
    },
    {
      accessorKey: "metricType",
      header: "Type",
      cell: ({ row }) => (
        <Badge variant={row.original.metricType === "auto" ? "default" : "secondary"} className="capitalize">
          {row.original.metricType}
        </Badge>
      ),
    },
    { accessorKey: "unit", header: "Unit" },
    {
      accessorKey: "targetValue",
      header: "Target",
      cell: ({ row }) => `${row.original.targetValue ?? "—"} ${row.original.unit || ""}`,
    },
    { accessorKey: "weight", header: "Weight" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.status === "active" ? "default" : "secondary"} className="capitalize">
          {row.original.status}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openEdit(row.original)}>
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => { setDeleting(row.original); setDeleteDialog(true); }}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const filters: FilterConfig[] = [
    { key: "category", label: "Category", type: "select", options: CATEGORIES.map((c) => ({ label: c, value: c })) },
    { key: "status", label: "Status", type: "select", options: [{ label: "Active", value: "active" }, { label: "Inactive", value: "inactive" }] },
  ];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">KPI Templates</h1>
          <p className="text-muted-foreground text-sm">Define KPI metrics to track employee performance</p>
        </div>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> New Template</Button>
      </div>

      <DataTable columns={columns} data={templates} loading={loading} filters={filters} searchKey="name" />

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Template" : "New KPI Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Attendance Rate" />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional description" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Category *</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Metric Type *</Label>
                <Select value={form.metricType} onValueChange={(v) => setForm({ ...form, metricType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METRIC_TYPES.map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {form.metricType === "auto" && (
              <div className="space-y-1">
                <Label>Formula</Label>
                <Select value={form.formula} onValueChange={(v) => setForm({ ...form, formula: v })}>
                  <SelectTrigger><SelectValue placeholder="Select formula" /></SelectTrigger>
                  <SelectContent>
                    {AUTO_FORMULAS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label>Unit</Label>
                <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="%" />
              </div>
              <div className="space-y-1">
                <Label>Target Value</Label>
                <Input type="number" value={form.targetValue} onChange={(e) => setForm({ ...form, targetValue: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label>Weight</Label>
                <Input type="number" step="0.1" value={form.weight} onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleting?.name}</strong>? This cannot be undone.
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
    </div>
  );
}
