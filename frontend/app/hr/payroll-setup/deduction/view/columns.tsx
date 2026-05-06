/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ColumnDef, Row } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Edit2, Trash2, MoreHorizontal, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateDeduction, deleteDeduction, getDeductionHeads, type DeductionHead } from "@/lib/actions/deduction";

export interface DeductionRow {
  id: string;
  sNo: number;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  departmentId?: string;
  subDepartment: string;
  subDepartmentId?: string;
  deductionHeadId: string;
  deductionHeadName: string;
  amount: number;
  month: string;
  year: string;
  monthYear: string;
  notes: string | null;
  status: string;
  createdAt: string;
}

const formatMonthYear = (month: string, year: string) => {
  if (!month || !year) return "—";
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  const monthIndex = parseInt(month) - 1;
  return `${monthNames[monthIndex] || month} ${year}`;
};

export const columns: ColumnDef<DeductionRow>[] = [
  {
    accessorKey: "sNo",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
        S.No
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm font-medium text-muted-foreground w-12 text-center">
        {row.original.sNo}
      </div>
    ),
    size: 60,
    enableHiding: false,
  },
  {
    accessorKey: "employee",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
        Employee
      </div>
    ),
    cell: ({ row }) => (
      <div className="space-y-0.5 min-w-[180px]">
        <div className="text-sm font-semibold">{row.original.employeeName}</div>
        <div className="text-xs text-muted-foreground">ID: {row.original.employeeCode}</div>
      </div>
    ),
    size: 200,
    enableSorting: true,
  },
  {
    accessorKey: "departmentInfo",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
        Department
      </div>
    ),
    cell: ({ row }) => (
      <div className="space-y-0.5 min-w-[160px]">
        <div className="text-sm">{row.original.department || "—"}</div>
        {row.original.subDepartment && (
          <div className="text-xs text-muted-foreground">{row.original.subDepartment}</div>
        )}
      </div>
    ),
    size: 180,
    enableSorting: true,
  },
  {
    accessorKey: "deductionHeadName",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
        Deduction Type
      </div>
    ),
    cell: ({ row }) => (
      <Badge variant="outline" className="font-medium">
        {row.original.deductionHeadName}
      </Badge>
    ),
    size: 150,
    enableSorting: true,
  },
  {
    accessorKey: "amount",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap text-right">
        Amount
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm font-semibold text-right text-destructive">
        {new Intl.NumberFormat("en-PK", {
          style: "currency",
          currency: "PKR",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(Number(row.original.amount))}
      </div>
    ),
    size: 130,
    enableSorting: true,
  },
  {
    accessorKey: "monthYear",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
        Month-Year
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm font-medium">
        {formatMonthYear(row.original.month, row.original.year)}
      </div>
    ),
    size: 120,
    enableSorting: true,
  },
  {
    accessorKey: "status",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
        Status
      </div>
    ),
    cell: ({ row }) => {
      const status = row.original.status?.toLowerCase() || "active";
      const variant =
        status === "active"
          ? "default"
          : status === "inactive"
            ? "secondary"
            : "destructive";
      return (
        <Badge variant={variant} className="font-medium capitalize">
          {row.original.status || "Active"}
        </Badge>
      );
    },
    size: 100,
    enableSorting: true,
  },
  {
    accessorKey: "notes",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
        Notes
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm text-muted-foreground max-w-[200px] truncate" title={row.original.notes || ""}>
        {row.original.notes || "—"}
      </div>
    ),
    size: 200,
  },
  {
    id: "actions",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
        Actions
      </div>
    ),
    cell: ({ row }) => <RowActions row={row} />,
    size: 80,
    enableHiding: false,
  },
];

function RowActions({ row }: { row: Row<DeductionRow> }) {
  const item = row.original;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editDialog, setEditDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deductionHeads, setDeductionHeads] = useState<DeductionHead[]>([]);
  const [loadingHeads, setLoadingHeads] = useState(false);

  const [formData, setFormData] = useState({
    deductionHeadId: item.deductionHeadId || "",
    amount: item.amount?.toString() || "",
    notes: item.notes || "",
    status: item.status || "active",
  });

  // Fetch deduction heads when edit dialog opens
  useEffect(() => {
    if (editDialog && deductionHeads.length === 0) {
      setLoadingHeads(true);
      getDeductionHeads()
        .then((result) => {
          if (result.status && result.data) {
            setDeductionHeads(result.data.filter((h) => h.status === "active"));
          }
        })
        .catch((error) => {
          console.error("Failed to fetch deduction heads:", error);
        })
        .finally(() => {
          setLoadingHeads(false);
        });
    }
  }, [editDialog, deductionHeads.length]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.deductionHeadId || !formData.amount) {
      toast.error("Please fill all required fields");
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    startTransition(async () => {
      const result = await updateDeduction(item.id, {
        deductionHeadId: formData.deductionHeadId,
        amount: amount,
        notes: formData.notes || undefined,
        status: formData.status,
      });

      if (result.status) {
        toast.success(result.message || "Deduction updated successfully");
        setEditDialog(false);
        router.refresh();
      } else {
        toast.error(result.message || "Failed to update deduction");
      }
    });
  };

  const handleDeleteConfirm = async () => {
    startTransition(async () => {
      const result = await deleteDeduction(item.id);
      if (result.status) {
        toast.success(result.message || "Deduction deleted successfully");
        setDeleteDialog(false);
        router.refresh();
      } else {
        toast.error(result.message || "Failed to delete deduction");
      }
    });
  };

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                setFormData({
                  deductionHeadId: item.deductionHeadId || "",
                  amount: item.amount?.toString() || "",
                  notes: item.notes || "",
                  status: item.status || "active",
                });
                setEditDialog(true);
              }}
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDeleteDialog(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Deduction</DialogTitle>
            <DialogDescription>
              Update the deduction details for {item.employeeName}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit}>
            <div className="space-y-4 p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Deduction Head */}
                <div className="space-y-2">
                  <Label htmlFor="edit-deduction-head">
                    Deduction Type <span className="text-destructive">*</span>
                  </Label>
                  {loadingHeads ? (
                    <div className="h-10 bg-muted rounded-md animate-pulse" />
                  ) : (
                    <Select
                      value={formData.deductionHeadId}
                      onValueChange={(value) =>
                        setFormData({ ...formData, deductionHeadId: value })
                      }
                      disabled={isPending}
                    >
                      <SelectTrigger id="edit-deduction-head">
                        <SelectValue placeholder="Select deduction type" />
                      </SelectTrigger>
                      <SelectContent>
                        {deductionHeads.map((head) => (
                          <SelectItem key={head.id} value={head.id}>
                            {head.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Amount */}
                <div className="space-y-2">
                  <Label htmlFor="edit-amount">
                    Amount <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="edit-amount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                    placeholder="0.00"
                    disabled={isPending}
                    required
                  />
                </div>

                {/* Status */}
                <div className="space-y-2">
                  <Label htmlFor="edit-status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData({ ...formData, status: value })
                    }
                    disabled={isPending}
                  >
                    <SelectTrigger id="edit-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="edit-notes">Notes</Label>
                <Textarea
                  id="edit-notes"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  placeholder="Enter notes"
                  disabled={isPending}
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditDialog(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Deduction</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the deduction for{" "}
              <strong>{item.employeeName}</strong> ({item.deductionHeadName})? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
