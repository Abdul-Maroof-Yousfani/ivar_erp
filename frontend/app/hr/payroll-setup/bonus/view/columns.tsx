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
import { Edit2, Trash2, MoreHorizontal, Loader2, Wallet, DollarSign, CalendarDays, Minus } from "lucide-react";
import { toast } from "sonner";
import { updateBonus, deleteBonus } from "@/lib/actions/bonus";
import { getBonusTypes, type BonusType } from "@/lib/actions/bonus-type";
import { useAuth } from "@/components/providers/auth-provider";

export interface BonusRow {
  id: string;
  sNo: number;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  departmentId?: string;
  subDepartment: string;
  subDepartmentId?: string;
  bonusTypeId: string;
  bonusTypeName: string;
  amount: number;
  percentage?: number | null;
  calculationType: string;
  bonusMonth: string;
  bonusYear: string;
  bonusMonthYear: string;
  paymentMethod: string;
  adjustmentMethod: string;
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

export const columns: ColumnDef<BonusRow>[] = [
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
    accessorKey: "bonusTypeName",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
        Bonus Type
      </div>
    ),
    cell: ({ row }) => (
      <Badge variant="outline" className="font-medium">
        {row.original.bonusTypeName}
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
    accessorKey: "percentage",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
        Percentage
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm">
        {row.original.percentage !== null && row.original.percentage !== undefined
          ? `${Number(row.original.percentage).toFixed(2)}%`
          : "—"}
      </div>
    ),
    size: 100,
    enableSorting: true,
  },
  {
    accessorKey: "paymentMethod",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
        Payment Method
      </div>
    ),
    cell: ({ row }) => {
      const method = row.original.paymentMethod;
      return (
        <Badge variant={method === "with_salary" ? "default" : "secondary"} className="text-xs">
          {method === "with_salary" ? "With Salary" : "Separately"}
        </Badge>
      );
    },
    size: 130,
    enableSorting: true,
  },
  {
    accessorKey: "adjustmentMethod",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
        Adjustment Method
      </div>
    ),
    cell: ({ row }) => {
      const method = row.original.adjustmentMethod;
      return (
        <Badge variant="outline" className="text-xs">
          {method === "distributed-remaining-months"
            ? "Distributed"
            : method === "deduct-current-month"
            ? "Deduct Current"
            : method}
        </Badge>
      );
    },
    size: 140,
    enableSorting: true,
  },
  {
    accessorKey: "bonusMonthYear",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
        Month-Year
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm font-medium">
        {formatMonthYear(row.original.bonusMonth, row.original.bonusYear)}
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

function RowActions({ row }: { row: Row<BonusRow> }) {
  const item = row.original;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("hr.bonus.update");
  const canDelete = hasPermission("hr.bonus.delete");

  const [editDialog, setEditDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [bonusTypes, setBonusTypes] = useState<BonusType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(false);
  
  const [formData, setFormData] = useState({
    bonusTypeId: item.bonusTypeId || "",
    amount: item.amount?.toString() || "",
    percentage: item.percentage?.toString() || "",
    paymentMethod: item.paymentMethod || "with_salary",
    adjustmentMethod: item.adjustmentMethod || "distributed-remaining-months",
    notes: item.notes || "",
    status: item.status || "active",
  });

  // Fetch bonus types when edit dialog opens
  useEffect(() => {
    if (editDialog && bonusTypes.length === 0) {
      setLoadingTypes(true);
      getBonusTypes()
        .then((result) => {
          if (result.status && result.data) {
            setBonusTypes(result.data.filter((bt) => bt.status === "active"));
          }
        })
        .catch((error) => {
          console.error("Failed to fetch bonus types:", error);
        })
        .finally(() => {
          setLoadingTypes(false);
        });
    }
  }, [editDialog, bonusTypes.length]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.bonusTypeId || !formData.amount) {
      toast.error("Please fill all required fields");
      return;
    }

    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (formData.percentage) {
      const percentage = parseFloat(formData.percentage);
      if (isNaN(percentage) || percentage < 0 || percentage > 100) {
        toast.error("Percentage must be between 0 and 100");
        return;
      }
    }

    startTransition(async () => {
      const result = await updateBonus(item.id, {
        bonusTypeId: formData.bonusTypeId,
        amount: amount,
        percentage: formData.percentage ? parseFloat(formData.percentage) : undefined,
        paymentMethod: formData.paymentMethod,
        adjustmentMethod: formData.adjustmentMethod,
        notes: formData.notes || undefined,
        status: formData.status,
      });

      if (result.status) {
        toast.success(result.message || "Bonus updated successfully");
        setEditDialog(false);
        router.refresh();
      } else {
        toast.error(result.message || "Failed to update bonus");
      }
    });
  };

  const handleDeleteConfirm = async () => {
    startTransition(async () => {
      const result = await deleteBonus(item.id);
      if (result.status) {
        toast.success(result.message || "Bonus deleted successfully");
        setDeleteDialog(false);
        router.refresh();
      } else {
        toast.error(result.message || "Failed to delete bonus");
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
                  bonusTypeId: item.bonusTypeId || "",
                  amount: item.amount?.toString() || "",
                  percentage: item.percentage?.toString() || "",
                  paymentMethod: item.paymentMethod || "with_salary",
                  adjustmentMethod: item.adjustmentMethod || "distributed-remaining-months",
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
            <DialogTitle>Edit Bonus</DialogTitle>
            <DialogDescription>
              Update the bonus details for {item.employeeName}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit}>
            <div className="space-y-4 p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Bonus Type */}
                <div className="space-y-2">
                  <Label htmlFor="edit-bonus-type">
                    Bonus Type <span className="text-destructive">*</span>
                  </Label>
                  {loadingTypes ? (
                    <div className="h-10 bg-muted rounded-md animate-pulse" />
                  ) : (
                    <Select
                      value={formData.bonusTypeId}
                      onValueChange={(value) =>
                        setFormData({ ...formData, bonusTypeId: value })
                      }
                      disabled={isPending}
                    >
                      <SelectTrigger id="edit-bonus-type">
                        <SelectValue placeholder="Select bonus type" />
                      </SelectTrigger>
                      <SelectContent>
                        {bonusTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
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

                {/* Percentage */}
                <div className="space-y-2">
                  <Label htmlFor="edit-percentage">Percentage</Label>
                  <Input
                    id="edit-percentage"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.percentage}
                    onChange={(e) =>
                      setFormData({ ...formData, percentage: e.target.value })
                    }
                    placeholder="0.00"
                    disabled={isPending}
                  />
                </div>

                {/* Payment Method */}
                <div className="space-y-2">
                  <Label htmlFor="edit-payment-method">
                    Payment Method <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.paymentMethod}
                    onValueChange={(value) =>
                      setFormData({ ...formData, paymentMethod: value })
                    }
                    disabled={isPending}
                  >
                    <SelectTrigger id="edit-payment-method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="with_salary">Pay with Salary</SelectItem>
                      <SelectItem value="separately">Separately</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Adjustment Method */}
                <div className="space-y-2">
                  <Label htmlFor="edit-adjustment-method">
                    Adjustment Method <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.adjustmentMethod}
                    onValueChange={(value) =>
                      setFormData({ ...formData, adjustmentMethod: value })
                    }
                    disabled={isPending}
                  >
                    <SelectTrigger id="edit-adjustment-method">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="distributed-remaining-months">
                        Distributed in Remaining Months
                      </SelectItem>
                      <SelectItem value="deduct-current-month">
                        Deduct from Current Month
                      </SelectItem>
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
            <AlertDialogTitle>Delete Bonus</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the bonus for{" "}
              <strong>{item.employeeName}</strong> ({item.bonusTypeName})? This
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

