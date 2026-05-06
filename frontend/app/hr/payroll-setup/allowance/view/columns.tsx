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
import { updateAllowance, deleteAllowance, getAllowanceHeads, type AllowanceHead } from "@/lib/actions/allowance";
import { useAuth } from "@/components/providers/auth-provider";

export interface AllowanceRow {
  id: string;
  sNo: number;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  departmentId?: string;
  subDepartment: string;
  subDepartmentId?: string;
  allowanceHeadId: string;
  allowanceHeadName: string;
  amount: number;
  month: string;
  year: string;
  monthYear: string;
  type?: string; // "recurring" | "specific"
  paymentMethod?: string; // "with_salary" | "separately"
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

export const columns: ColumnDef<AllowanceRow>[] = [
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
    enableSorting: false,
  },
  {
    accessorKey: "employeeName",
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
    sortingFn: (rowA, rowB) => {
      const nameA = rowA.original.employeeName?.toLowerCase() || "";
      const nameB = rowB.original.employeeName?.toLowerCase() || "";
      return nameA.localeCompare(nameB);
    },
  },
  {
    accessorKey: "department",
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
    accessorKey: "allowanceHeadName",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
        Allowance Type
      </div>
    ),
    cell: ({ row }) => (
      <div className="space-y-1">
        <Badge variant="outline" className="font-medium">
          {row.original.allowanceHeadName}
        </Badge>
        {row.original.type && (
          <div className="text-xs">
            <Badge variant={row.original.type === "recurring" ? "default" : "secondary"} className="text-xs">
              {row.original.type === "recurring" ? "Recurring" : "Specific"}
            </Badge>
          </div>
        )}
      </div>
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
      <div className="text-sm font-semibold text-right">
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
    accessorKey: "paymentMethod",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
        Payment Method
      </div>
    ),
    cell: ({ row }) => (
      <Badge variant={row.original.paymentMethod === "with_salary" ? "default" : "secondary"} className="text-xs">
        {row.original.paymentMethod === "with_salary" ? "With Salary" : row.original.paymentMethod === "separately" ? "Separately" : "—"}
      </Badge>
    ),
    size: 130,
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

function RowActions({ row }: { row: Row<AllowanceRow> }) {
  const item = row.original;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("hr.allowance.update");
  const canDelete = hasPermission("hr.allowance.delete");

  const [editDialog, setEditDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [allowanceHeads, setAllowanceHeads] = useState<AllowanceHead[]>([]);
  const [loadingHeads, setLoadingHeads] = useState(false);

  const [formData, setFormData] = useState({
    allowanceHeadId: item.allowanceHeadId || "",
    amount: item.amount?.toString() || "",
    type: item.type || "specific",
    notes: item.notes || "",
    status: item.status || "active",
  });

  // Fetch allowance heads when edit dialog opens
  useEffect(() => {
    if (editDialog && allowanceHeads.length === 0) {
      setLoadingHeads(true);
      getAllowanceHeads()
        .then((result) => {
          if (result.status && result.data) {
            setAllowanceHeads(result.data.filter((h) => h.status === "active"));
          }
        })
        .catch((error) => {
          console.error("Failed to fetch allowance heads:", error);
        })
        .finally(() => {
          setLoadingHeads(false);
        });
    }
  }, [editDialog, allowanceHeads.length]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.allowanceHeadId || !formData.amount) {
      toast.error("Please fill all required fields");
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    startTransition(async () => {
      const result = await updateAllowance(item.id, {
        allowanceHeadId: formData.allowanceHeadId,
        amount: amount,
        type: formData.type,
        notes: formData.notes || undefined,
        status: formData.status,
      });

      if (result.status) {
        toast.success(result.message || "Allowance updated successfully");
        setEditDialog(false);
        router.refresh();
      } else {
        toast.error(result.message || "Failed to update allowance");
      }
    });
  };

  const handleDeleteConfirm = async () => {
    startTransition(async () => {
      const result = await deleteAllowance(item.id);
      if (result.status) {
        toast.success(result.message || "Allowance deleted successfully");
        setDeleteDialog(false);
        router.refresh();
      } else {
        toast.error(result.message || "Failed to delete allowance");
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
                  allowanceHeadId: item.allowanceHeadId || "",
                  amount: item.amount?.toString() || "",
                  type: item.type || "specific",
                  notes: item.notes || "",
                  status: item.status || "active",
                });
                setEditDialog(true);
              }}
              disabled={!canEdit}
            >
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setDeleteDialog(true)}
              className="text-destructive focus:text-destructive"
              disabled={!canDelete}
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
            <DialogTitle>Edit Allowance</DialogTitle>
            <DialogDescription>
              Update the allowance details for {item.employeeName}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit}>
            <div className="space-y-4 p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Allowance Head */}
                <div className="space-y-2">
                  <Label htmlFor="edit-allowance-head">
                    Allowance Type <span className="text-destructive">*</span>
                  </Label>
                  {loadingHeads ? (
                    <div className="h-10 bg-muted rounded-md animate-pulse" />
                  ) : (
                    <Select
                      value={formData.allowanceHeadId}
                      onValueChange={(value) =>
                        setFormData({ ...formData, allowanceHeadId: value })
                      }
                      disabled={isPending}
                    >
                      <SelectTrigger id="edit-allowance-head">
                        <SelectValue placeholder="Select allowance type" />
                      </SelectTrigger>
                      <SelectContent>
                        {allowanceHeads.map((head) => (
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

                {/* Type */}
                <div className="space-y-2">
                  <Label htmlFor="edit-type">
                    Allowance Category <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, type: value })
                    }
                    disabled={isPending}
                  >
                    <SelectTrigger id="edit-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="specific">Specific Month</SelectItem>
                      <SelectItem value="recurring">Recurring</SelectItem>
                    </SelectContent>
                  </Select>
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
            <AlertDialogTitle>Delete Allowance</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the allowance for{" "}
              <strong>{item.employeeName}</strong> ({item.allowanceHeadName})? This
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
