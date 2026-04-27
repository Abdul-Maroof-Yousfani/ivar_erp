"use client";

import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, MoreHorizontal, CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import DataTable, { type FilterConfig } from "@/components/common/data-table";
import { ColumnDef } from "@tanstack/react-table";
import {
  getKpiReviews, createKpiReview, updateKpiReview, deleteKpiReview,
  submitKpiReview, getKpiTemplates, type KpiReview, type KpiTemplate,
} from "@/lib/actions/kpi";
import { getEmployeesForDropdown, type EmployeeDropdownOption } from "@/lib/actions/employee";

const PERIOD_TYPES = ["monthly", "quarterly", "yearly"];
const STATUS_OPTIONS = ["pending", "submitted", "approved"];

const emptyForm = {
  employeeId: "", kpiTemplateId: "", period: "", periodType: "quarterly",
  targetValue: 100, actualValue: "", notes: "",
};

function statusVariant(s: string): "default" | "secondary" | "outline" {
  if (s === "approved") return "default";
  if (s === "submitted") return "secondary";
  return "outline";
}

export default function KpiReviewsPage() {
  const [reviews, setReviews] = useState<KpiReview[]>([]);
  const [templates, setTemplates] = useState<KpiTemplate[]>([]);
  const [employees, setEmployees] = useState<EmployeeDropdownOption[]>([]);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<KpiReview | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState<KpiReview | null>(null);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    Promise.all([fetchReviews(), fetchDropdowns()]);
  }, []);

  async function fetchReviews() {
    setLoading(true);
    const res = await getKpiReviews();
    if (res.status) setReviews(res.data || []);
    else toast.error(res.message || "Failed to load reviews");
    setLoading(false);
  }

  async function fetchDropdowns() {
    const [tRes, eRes] = await Promise.all([
      getKpiTemplates({ status: "active" }),
      getEmployeesForDropdown(),
    ]);
    if (tRes.status) setTemplates(tRes.data || []);
    if (eRes.status) setEmployees(eRes.data || []);
  }

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(r: KpiReview) {
    setEditing(r);
    setForm({
      employeeId: r.employeeId,
      kpiTemplateId: r.kpiTemplateId,
      period: r.period,
      periodType: r.periodType,
      targetValue: Number(r.targetValue),
      actualValue: r.actualValue != null ? String(r.actualValue) : "",
      notes: r.notes || "",
    });
    setFormOpen(true);
  }

  async function handleSave() {
    if (!form.employeeId || !form.kpiTemplateId || !form.period) {
      return toast.error("Employee, template, and period are required");
    }
    setSaving(true);
    const payload = {
      employeeId: form.employeeId,
      kpiTemplateId: form.kpiTemplateId,
      period: form.period,
      periodType: form.periodType,
      targetValue: form.targetValue,
      actualValue: form.actualValue !== "" ? Number(form.actualValue) : undefined,
      notes: form.notes || undefined,
    };
    const res = editing
      ? await updateKpiReview(editing.id, { actualValue: payload.actualValue, targetValue: payload.targetValue, notes: payload.notes })
      : await createKpiReview(payload);
    setSaving(false);
    if (res.status) {
      toast.success(editing ? "Review updated" : "Review created");
      setFormOpen(false);
      fetchReviews();
    } else {
      toast.error(res.message || "Failed to save review");
    }
  }

  async function handleApprove(r: KpiReview) {
    const res = await updateKpiReview(r.id, { status: "approved" });
    if (res.status) {
      toast.success("Review approved");
      fetchReviews();
    } else {
      toast.error(res.message || "Failed to approve review");
    }
  }

  async function handleSubmit(r: KpiReview) {
    const res = await submitKpiReview(r.id);
    if (res.status) {
      toast.success("Review submitted for approval");
      fetchReviews();
    } else {
      toast.error(res.message || "Failed to submit review");
    }
  }
  async function handleDelete() {
    if (!deleting) return;
    const res = await deleteKpiReview(deleting.id);
    if (res.status) {
      toast.success("Review deleted");
      setReviews((prev) => prev.filter((r) => r.id !== deleting.id));
    } else {
      toast.error(res.message || "Failed to delete review");
    }
    setDeleteDialog(false);
    setDeleting(null);
  }

  const columns: ColumnDef<KpiReview>[] = [
    {
      accessorKey: "employee",
      header: "Employee",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.employee?.employeeName || "—"}</div>
          <div className="text-xs text-muted-foreground">{row.original.employee?.department?.name || ""}</div>
        </div>
      ),
    },
    {
      accessorKey: "kpiTemplate",
      header: "KPI",
      cell: ({ row }) => row.original.kpiTemplate?.name || "—",
    },
    { accessorKey: "period", header: "Period" },
    {
      accessorKey: "periodType",
      header: "Type",
      cell: ({ row }) => <Badge variant="outline" className="capitalize">{row.original.periodType}</Badge>,
    },
    {
      accessorKey: "score",
      header: "Score",
      cell: ({ row }) => {
        const score = row.original.score != null ? Number(row.original.score) : null;
        if (score == null) return <span className="text-muted-foreground">—</span>;
        return (
          <div className="flex items-center gap-2 min-w-25">
            <Progress value={score} className="h-2 flex-1" />
            <span className="text-xs font-medium">{score.toFixed(0)}%</span>
          </div>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={statusVariant(row.original.status)} className="capitalize">
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
            {row.original.status === "pending" && (
              <DropdownMenuItem onClick={() => handleSubmit(row.original)}>
                <Send className="mr-2 h-4 w-4 text-blue-600" /> Submit for Approval
              </DropdownMenuItem>
            )}
            {row.original.status !== "approved" && (
              <DropdownMenuItem onClick={() => handleApprove(row.original)}>
                <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
              </DropdownMenuItem>
            )}
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
    { key: "periodType", label: "Period Type", type: "select", options: PERIOD_TYPES.map((p) => ({ label: p, value: p })) },
    { key: "status", label: "Status", type: "select", options: STATUS_OPTIONS.map((s) => ({ label: s, value: s })) },
  ];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">KPI Reviews</h1>
          <p className="text-muted-foreground text-sm">Track and manage employee KPI review records</p>
        </div>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> New Review</Button>
      </div>

      <DataTable columns={columns} data={reviews} loading={loading} filters={filters} searchKey="period" />

      {/* Create / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Review" : "New KPI Review"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1">
              <Label>Employee *</Label>
              <Select value={form.employeeId} onValueChange={(v) => setForm({ ...form, employeeId: v })} disabled={!!editing}>
                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.employeeName} ({e.employeeId})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>KPI Template *</Label>
              <Select value={form.kpiTemplateId} onValueChange={(v) => setForm({ ...form, kpiTemplateId: v })} disabled={!!editing}>
                <SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Period *</Label>
                <Input value={form.period} onChange={(e) => setForm({ ...form, period: e.target.value })} placeholder="e.g. 2026-Q1 or 2026-04" disabled={!!editing} />
              </div>
              <div className="space-y-1">
                <Label>Period Type *</Label>
                <Select value={form.periodType} onValueChange={(v) => setForm({ ...form, periodType: v })} disabled={!!editing}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PERIOD_TYPES.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Target Value</Label>
                <Input type="number" value={form.targetValue} onChange={(e) => setForm({ ...form, targetValue: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label>Actual Value</Label>
                <Input type="number" value={form.actualValue} onChange={(e) => setForm({ ...form, actualValue: e.target.value })} placeholder="Leave blank if not yet measured" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional notes" rows={3} />
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
            <AlertDialogTitle>Delete Review</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this KPI review? This cannot be undone.
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
