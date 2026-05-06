"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, Loader2, MoreHorizontal, CheckCheck, MessageSquare,
} from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  listPendingKpiApprovals, approveKpiReview, rejectKpiReview, bulkApproveKpiReviews,
  type KpiReview,
} from "@/lib/actions/kpi";

function buildPeriodOptions(): string[] {
  const year = new Date().getFullYear();
  return [
    `${year}-Q1`, `${year}-Q2`, `${year}-Q3`, `${year}-Q4`,
    `${year - 1}-Q1`, `${year - 1}-Q2`, `${year - 1}-Q3`, `${year - 1}-Q4`,
  ];
}

export default function KpiApprovalsPage() {
  const [reviews, setReviews] = useState<KpiReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("all");
  const hasFetched = useRef(false);

  // Selection for bulk approve
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Approve dialog
  const [approveDialog, setApproveDialog] = useState(false);
  const [approvingReview, setApprovingReview] = useState<KpiReview | null>(null);
  const [approveNotes, setApproveNotes] = useState("");

  // Reject dialog
  const [rejectDialog, setRejectDialog] = useState(false);
  const [rejectingReview, setRejectingReview] = useState<KpiReview | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Bulk approve confirm
  const [bulkDialog, setBulkDialog] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;
    fetchReviews();
  }, []);

  async function fetchReviews(p?: string) {
    setLoading(true);
    setSelected(new Set());
    const res = await listPendingKpiApprovals(p ? { period: p } : undefined);
    if (res.status) setReviews(res.data || []);
    else toast.error(res.message || "Failed to load pending approvals");
    setLoading(false);
  }

  function handlePeriodChange(p: string) {
    setPeriod(p);
    hasFetched.current = true;
    fetchReviews(p === "all" ? undefined : p);
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === reviews.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(reviews.map((r) => r.id)));
    }
  }

  async function handleApprove() {
    if (!approvingReview) return;
    startTransition(async () => {
      const res = await approveKpiReview(approvingReview.id, approveNotes || undefined);
      if (res.status) {
        toast.success("Review approved");
        setApproveDialog(false);
        setApproveNotes("");
        fetchReviews(period || undefined);
      } else {
        toast.error(res.message || "Failed to approve");
      }
    });
  }

  async function handleReject() {
    if (!rejectingReview || !rejectReason.trim()) {
      return toast.error("Rejection reason is required");
    }
    startTransition(async () => {
      const res = await rejectKpiReview(rejectingReview.id, rejectReason);
      if (res.status) {
        toast.success("Review rejected");
        setRejectDialog(false);
        setRejectReason("");
        fetchReviews(period || undefined);
      } else {
        toast.error(res.message || "Failed to reject");
      }
    });
  }

  async function handleBulkApprove() {
    startTransition(async () => {
      const ids = selected.size > 0 ? [...selected] : undefined;
      const empIds = ids
        ? reviews.filter((r) => ids.includes(r.id)).map((r) => r.employeeId)
        : undefined;
      const res = await bulkApproveKpiReviews(period || "", empIds);
      if (res.status) {
        toast.success(res.message || `${res.data?.approved} review(s) approved`);
        setBulkDialog(false);
        fetchReviews(period || undefined);
      } else {
        toast.error(res.message || "Bulk approve failed");
      }
    });
  }

  const columns: ColumnDef<KpiReview>[] = [
    {
      id: "select",
      header: () => (
        <Checkbox
          checked={selected.size === reviews.length && reviews.length > 0}
          onCheckedChange={toggleAll}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={selected.has(row.original.id)}
          onCheckedChange={() => toggleSelect(row.original.id)}
          aria-label="Select row"
        />
      ),
      size: 40,
    },
    {
      accessorKey: "employee",
      header: "Employee",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{(row.original.employee as any)?.employeeName || "—"}</div>
          <div className="text-xs text-muted-foreground">{(row.original.employee as any)?.departmentName || ""}</div>
        </div>
      ),
    },
    {
      accessorKey: "kpiTemplate",
      header: "KPI",
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.kpiTemplate?.name || "—"}</div>
          <div className="text-xs text-muted-foreground capitalize">{row.original.kpiTemplate?.category}</div>
        </div>
      ),
    },
    { accessorKey: "period", header: "Period" },
    {
      accessorKey: "score",
      header: "Score",
      cell: ({ row }) => {
        const score = row.original.score != null ? Number(row.original.score) : null;
        if (score == null) return <span className="text-muted-foreground text-sm">—</span>;
        return (
          <div className="flex items-center gap-2 min-w-24">
            <Progress value={score} className="h-1.5 flex-1" />
            <span className="text-xs font-medium tabular-nums">{score.toFixed(0)}%</span>
          </div>
        );
      },
    },
    {
      accessorKey: "actualValue",
      header: "Actual / Target",
      cell: ({ row }) => (
        <span className="text-sm tabular-nums">
          {row.original.actualValue != null ? Number(row.original.actualValue).toFixed(1) : "—"}
          {" / "}
          {Number(row.original.targetValue).toFixed(1)}
          {" "}{row.original.kpiTemplate?.unit || ""}
        </span>
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
            <DropdownMenuItem
              onClick={() => { setApprovingReview(row.original); setApproveNotes(""); setApproveDialog(true); }}
            >
              <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" /> Approve
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => { setRejectingReview(row.original); setRejectReason(""); setRejectDialog(true); }}
            >
              <XCircle className="mr-2 h-4 w-4" /> Reject
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const filters: FilterConfig[] = [
    {
      key: "periodType",
      label: "Period Type",
      type: "select",
      options: ["monthly", "quarterly", "yearly"].map((p) => ({ label: p, value: p })),
    },
  ];

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">KPI Approvals</h1>
          <p className="text-muted-foreground text-sm">
            {reviews.length} review{reviews.length !== 1 ? "s" : ""} awaiting approval
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={period} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All periods" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All periods</SelectItem>
              {buildPeriodOptions().map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          {(selected.size > 0 || reviews.length > 0) && (
            <Button
              onClick={() => setBulkDialog(true)}
              disabled={isPending}
              variant="default"
            >
              {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCheck className="mr-2 h-4 w-4" />}
              {selected.size > 0 ? `Approve Selected (${selected.size})` : `Approve All (${reviews.length})`}
            </Button>
          )}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={reviews}
        loading={loading}
        filters={filters}
        searchKey="period"
      />

      {/* Approve Dialog */}
      <Dialog open={approveDialog} onOpenChange={setApproveDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" /> Approve KPI Review
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
              <div><span className="text-muted-foreground">Employee:</span> {(approvingReview?.employee as any)?.employeeName}</div>
              <div><span className="text-muted-foreground">KPI:</span> {approvingReview?.kpiTemplate?.name}</div>
              <div><span className="text-muted-foreground">Period:</span> {approvingReview?.period}</div>
              {approvingReview?.score != null && (
                <div><span className="text-muted-foreground">Score:</span> {Number(approvingReview.score).toFixed(1)}%</div>
              )}
            </div>
            <div className="space-y-1">
              <Label>Notes (optional)</Label>
              <Textarea
                value={approveNotes}
                onChange={(e) => setApproveNotes(e.target.value)}
                placeholder="Add any approval notes..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialog(false)}>Cancel</Button>
            <Button onClick={handleApprove} disabled={isPending} className="bg-green-600 hover:bg-green-700">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialog} onOpenChange={setRejectDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" /> Reject KPI Review
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
              <div><span className="text-muted-foreground">Employee:</span> {(rejectingReview?.employee as any)?.employeeName}</div>
              <div><span className="text-muted-foreground">KPI:</span> {rejectingReview?.kpiTemplate?.name}</div>
              <div><span className="text-muted-foreground">Period:</span> {rejectingReview?.period}</div>
            </div>
            <div className="space-y-1">
              <Label>Rejection Reason *</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this review is being rejected..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog(false)}>Cancel</Button>
            <Button
              onClick={handleReject}
              disabled={isPending || !rejectReason.trim()}
              variant="destructive"
            >
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Approve Confirm */}
      <AlertDialog open={bulkDialog} onOpenChange={setBulkDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Bulk Approve Reviews</AlertDialogTitle>
            <AlertDialogDescription>
              {selected.size > 0
                ? `Approve ${selected.size} selected review(s)?`
                : `Approve all ${reviews.length} pending review(s)${period ? ` for ${period}` : ""}?`}
              {" "}This will notify each employee.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkApprove} disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
