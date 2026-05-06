"use client";

import { ColumnDef, Row } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { HighlightText } from "@/components/common/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  EllipsisIcon,
  Loader2,
  Pencil,
  Trash2,
  Eye,
  CalendarIcon,
  Plus,
  Star,
} from "lucide-react";
import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  LeavesPolicy,
  deleteLeavesPolicy,
  getLeavesPolicyById,
  updateLeavesPolicy,
  setDefaultLeavesPolicy,
} from "@/lib/actions/leaves-policy";
import { Badge } from "@/components/ui/badge";
import { getLeaveTypes, LeaveType } from "@/lib/actions/leave-type";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";

interface LeaveTypeRow {
  id: number;
  leaveTypeId: string;
  numberOfLeaves: string;
}

export type LeavesPolicyRow = LeavesPolicy & { id: string };

export const columns: ColumnDef<LeavesPolicyRow>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
    size: 28,
  },
  {
    header: "Name",
    accessorKey: "name",
    size: 250,
    enableSorting: true,
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <HighlightText text={row.original.name} />
        {row.original.isDefault && (
          <Badge variant="default" className="bg-green-600 hover:bg-green-700">
            Default
          </Badge>
        )}
      </div>
    ),
  },
  {
    header: "Policy Date From",
    accessorKey: "policyDateFrom",
    size: 150,
    cell: ({ row }) =>
      row.original.policyDateFrom
        ? new Date(row.original.policyDateFrom).toLocaleDateString()
        : "—",
    enableSorting: true,
  },
  {
    header: "Policy Date Till",
    accessorKey: "policyDateTill",
    size: 150,
    cell: ({ row }) =>
      row.original.policyDateTill
        ? new Date(row.original.policyDateTill).toLocaleDateString()
        : "—",
    enableSorting: true,
  },
  {
    header: "Details",
    accessorKey: "details",
    size: 200,
    cell: ({ row }) => row.original.details || "—",
  },
  {
    header: "Created By",
    accessorKey: "createdBy",
    size: 150,
    enableSorting: true,
    cell: ({ row }) => row.original.createdBy || "—",
  },
  {
    header: "Created At",
    accessorKey: "createdAt",
    size: 150,
    cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
    enableSorting: true,
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => <RowActions row={row} />,
    size: 60,
    enableHiding: false,
  },
];

function RowActions({ row }: { row: Row<LeavesPolicyRow> }) {
  const lp = row.original;
  const router = useRouter();
  const { hasPermission, isAdmin } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [deleteDialog, setDeleteDialog] = useState(false);

  const canEdit = isAdmin() || hasPermission("leaves-policy.update");
  const canDelete = isAdmin() || hasPermission("leaves-policy.delete");
  // Assuming view is generally allowed, or maybe reuse read permission if strict, but ignoring for now or using 'leaves-policy.read' implicitly via page access.
  // Actually, let's keep View always visible or based on read permission if we want. But usually list access implies read.
  // The prompt asked for Add, Edit, Delete.

  // If we wanted to hide the whole menu if no actions:
  // if (!canEdit && !canDelete) { ... }
  // But here we might have View or Set Default as well.
  // 'Set as Default' probably falls under update.

  const canUpdate = canEdit; // Reuse update for Set Default
  const [viewDialog, setViewDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [policyDetails, setPolicyDetails] = useState<LeavesPolicy | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Edit form state
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [name, setName] = useState("");
  const [details, setDetails] = useState("");
  const [policyDateFrom, setPolicyDateFrom] = useState<Date | undefined>();
  const [policyDateTill, setPolicyDateTill] = useState<Date | undefined>();
  const [fullDayDeductionRate, setFullDayDeductionRate] = useState("1");
  const [halfDayDeductionRate, setHalfDayDeductionRate] = useState("0.5");
  const [shortLeaveDeductionRate, setShortLeaveDeductionRate] =
    useState("0.25");
  const [leaveTypeRows, setLeaveTypeRows] = useState<LeaveTypeRow[]>([
    { id: 1, leaveTypeId: "", numberOfLeaves: "" },
  ]);

  // Load leave types
  useEffect(() => {
    getLeaveTypes().then((res) => {
      if (res.status && res.data) {
        setLeaveTypes(res.data);
      }
    });
  }, []);

  // Load policy details for view
  useEffect(() => {
    if (viewDialog && !policyDetails) {
      setLoadingDetails(true);
      getLeavesPolicyById(lp.id).then((res) => {
        if (res.status && res.data) {
          setPolicyDetails(res.data);
        } else {
          toast.error("Failed to load policy details");
          setViewDialog(false);
        }
        setLoadingDetails(false);
      });
    }
  }, [viewDialog, lp.id, policyDetails]);

  // Load policy details for edit
  useEffect(() => {
    if (editDialog) {
      getLeavesPolicyById(lp.id).then((res) => {
        if (res.status && res.data) {
          const policy = res.data;
          setName(policy.name);
          setDetails(policy.details || "");
          if (policy.policyDateFrom) {
            setPolicyDateFrom(new Date(policy.policyDateFrom));
          }
          if (policy.policyDateTill) {
            setPolicyDateTill(new Date(policy.policyDateTill));
          }
          setFullDayDeductionRate(
            policy.fullDayDeductionRate?.toString() || "1"
          );
          setHalfDayDeductionRate(
            policy.halfDayDeductionRate?.toString() || "0.5"
          );
          setShortLeaveDeductionRate(
            policy.shortLeaveDeductionRate?.toString() || "0.25"
          );
          if (policy.leaveTypes && policy.leaveTypes.length > 0) {
            setLeaveTypeRows(
              policy.leaveTypes.map((lt, idx) => ({
                id: idx + 1,
                leaveTypeId: lt.leaveTypeId,
                numberOfLeaves: lt.numberOfLeaves.toString(),
              }))
            );
          } else {
            setLeaveTypeRows([{ id: 1, leaveTypeId: "", numberOfLeaves: "" }]);
          }
        } else {
          toast.error("Failed to load policy details");
          setEditDialog(false);
        }
      });
    }
  }, [editDialog, lp.id]);

  const handleViewClose = () => {
    setViewDialog(false);
    setPolicyDetails(null);
  };

  const handleEditClose = () => {
    setEditDialog(false);
    setName("");
    setDetails("");
    setPolicyDateFrom(undefined);
    setPolicyDateTill(undefined);
    setFullDayDeductionRate("1");
    setHalfDayDeductionRate("0.5");
    setShortLeaveDeductionRate("0.25");
    setLeaveTypeRows([{ id: 1, leaveTypeId: "", numberOfLeaves: "" }]);
  };

  const addLeaveTypeRow = () => {
    setLeaveTypeRows([
      ...leaveTypeRows,
      { id: Date.now(), leaveTypeId: "", numberOfLeaves: "" },
    ]);
  };

  const removeLeaveTypeRow = (id: number) => {
    if (leaveTypeRows.length > 1) {
      setLeaveTypeRows(leaveTypeRows.filter((r) => r.id !== id));
    }
  };

  const updateLeaveTypeRow = (
    id: number,
    field: "leaveTypeId" | "numberOfLeaves",
    value: string
  ) => {
    setLeaveTypeRows(
      leaveTypeRows.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Leaves Policy Name is required");
      return;
    }

    if (!policyDateFrom) {
      toast.error("Policy Date from is required");
      return;
    }

    if (!policyDateTill) {
      toast.error("Policy Date till is required");
      return;
    }

    const validLeaveTypes = leaveTypeRows.filter(
      (r) => r.leaveTypeId && r.numberOfLeaves
    );

    if (validLeaveTypes.length === 0) {
      toast.error("Please add at least one leave type");
      return;
    }

    startTransition(async () => {
      const result = await updateLeavesPolicy(lp.id, {
        name: name.trim(),
        details: details.trim() || undefined,
        policyDateFrom: policyDateFrom.toISOString(),
        policyDateTill: policyDateTill.toISOString(),
        fullDayDeductionRate: parseFloat(fullDayDeductionRate),
        halfDayDeductionRate: parseFloat(halfDayDeductionRate),
        shortLeaveDeductionRate: parseFloat(shortLeaveDeductionRate),
        leaveTypes: validLeaveTypes.map((r) => ({
          leaveTypeId: r.leaveTypeId,
          numberOfLeaves: parseInt(r.numberOfLeaves) || 0,
        })),
      });

      if (result.status) {
        toast.success(result.message);
        handleEditClose();
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };

  const deductionRateOptions = [
    { value: "0.25", label: "0.25 (Day)" },
    { value: "0.5", label: "0.5 (Day)" },
    { value: "1", label: "1 (Day)" },
    { value: "1.5", label: "1.5 (Day)" },
    { value: "2", label: "2 (Day)" },
  ];

  const handleDeleteConfirm = async () => {
    startTransition(async () => {
      const result = await deleteLeavesPolicy(lp.id);
      if (result.status) {
        toast.success(result.message);
        setDeleteDialog(false);
        router.refresh();
      } else toast.error(result.message);
    });
  };

  const handleSetDefault = () => {
    startTransition(async () => {
      const result = await setDefaultLeavesPolicy(lp.id);
      if (result.status) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  };
  console.log(policyDetails);
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="flex justify-end">
            <Button
              size="icon"
              variant="ghost"
              className="shadow-none"
              aria-label="Actions"
            >
              <EllipsisIcon size={16} />
            </Button>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setViewDialog(true)}>
            <Eye className="h-4 w-4 mr-2" />
            View
          </DropdownMenuItem>
          {canEdit && <DropdownMenuItem onClick={() => setEditDialog(true)}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </DropdownMenuItem>}
          {canUpdate && !lp.isDefault && (
            <DropdownMenuItem onClick={handleSetDefault}>
              <Star className="h-4 w-4 mr-2" />
              Set as Default
            </DropdownMenuItem>
          )}
          {canDelete && <DropdownMenuItem
            onClick={() => setDeleteDialog(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* View Dialog */}
      <Dialog open={viewDialog} onOpenChange={handleViewClose}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>View Leaves Policy Detail</DialogTitle>
            <DialogDescription>
              View complete details of the leave policy
            </DialogDescription>
          </DialogHeader>
          {loadingDetails ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : policyDetails ? (
            <div className="space-y-6 py-4">
              {/* Policy Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Leaves Policy Name
                  </label>
                  <p className="text-base">{policyDetails.name}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Policy Date From
                  </label>
                  <p className="text-base">
                    {policyDetails.policyDateFrom
                      ? format(
                        new Date(policyDetails.policyDateFrom),
                        "MM/dd/yyyy"
                      )
                      : "—"}
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Policy Date Till
                  </label>
                  <p className="text-base">
                    {policyDetails.policyDateTill
                      ? format(
                        new Date(policyDetails.policyDateTill),
                        "MM/dd/yyyy"
                      )
                      : "—"}
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Full Day Deduction Rate
                  </label>
                  <p className="text-base">
                    {policyDetails.fullDayDeductionRate ?? "—"} (Day)
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Half Day Deduction Rate
                  </label>
                  <p className="text-base">
                    {policyDetails.halfDayDeductionRate ?? "—"} (Day)
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">
                    Short Leave Deduction Rate
                  </label>
                  <p className="text-base">
                    {policyDetails.shortLeaveDeductionRate ?? "—"} (Day)
                  </p>
                </div>
                {policyDetails.details && (
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-muted-foreground">
                      Details
                    </label>
                    <p className="text-base">{policyDetails.details}</p>
                  </div>
                )}
              </div>

              {/* Leave Types Table */}
              {policyDetails.leaveTypes &&
                policyDetails.leaveTypes.length > 0 && (
                  <div className="space-y-4">
                    <label className="text-sm font-medium">Leaves Type</label>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Leaves Type</TableHead>
                          <TableHead>No. of Leaves</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {policyDetails.leaveTypes.map((lt, index) => (
                          <TableRow key={index}>
                            <TableCell>{lt.leaveTypeName}</TableCell>
                            <TableCell>{lt.numberOfLeaves}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={handleEditClose}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Leaves Policy Edit Detail Form</DialogTitle>
            <DialogDescription>
              Update leave policy with dates, deduction rates, and leave types
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-6">
            {/* Policy Name and Dates */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Leaves Policy Name *</Label>
                <Input
                  placeholder="Policy name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={isPending}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Policy Date from *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !policyDateFrom && "text-muted-foreground"
                      )}
                      disabled={isPending}
                      type="button"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {policyDateFrom ? (
                        format(policyDateFrom, "MM/dd/yyyy")
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={policyDateFrom}
                      onSelect={setPolicyDateFrom}
                      disabled={isPending}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Policy Date till *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !policyDateTill && "text-muted-foreground"
                      )}
                      disabled={isPending}
                      type="button"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {policyDateTill ? (
                        format(policyDateTill, "MM/dd/yyyy")
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={policyDateTill}
                      onSelect={setPolicyDateTill}
                      disabled={isPending}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Deduction Rates */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Full Day Deduction Rate *</Label>
                <Select
                  value={fullDayDeductionRate}
                  onValueChange={setFullDayDeductionRate}
                  disabled={isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select rate" />
                  </SelectTrigger>
                  <SelectContent>
                    {deductionRateOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Half Day Deduction Rate *</Label>
                <Select
                  value={halfDayDeductionRate}
                  onValueChange={setHalfDayDeductionRate}
                  disabled={isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select rate" />
                  </SelectTrigger>
                  <SelectContent>
                    {deductionRateOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Short Leave Deduction Rate *</Label>
                <Select
                  value={shortLeaveDeductionRate}
                  onValueChange={setShortLeaveDeductionRate}
                  disabled={isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select rate" />
                  </SelectTrigger>
                  <SelectContent>
                    {deductionRateOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Leave Types */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <Label className="text-base font-medium">Leave Types *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addLeaveTypeRow}
                  disabled={isPending}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add More
                </Button>
              </div>
              <div className="space-y-3">
                {leaveTypeRows.map((row, index) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-12 gap-4 items-start"
                  >
                    <div className="col-span-5 space-y-2">
                      <Label>Leaves Type *</Label>
                      <Select
                        value={row.leaveTypeId}
                        onValueChange={(value) =>
                          updateLeaveTypeRow(row.id, "leaveTypeId", value)
                        }
                        disabled={isPending}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select leave type" />
                        </SelectTrigger>
                        <SelectContent>
                          {leaveTypes.map((lt) => (
                            <SelectItem key={lt.id} value={lt.id}>
                              {lt.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-5 space-y-2">
                      <Label>No. of Leaves *</Label>
                      <Input
                        type="number"
                        min="0"
                        placeholder="Number of leaves"
                        value={row.numberOfLeaves}
                        onChange={(e) =>
                          updateLeaveTypeRow(
                            row.id,
                            "numberOfLeaves",
                            e.target.value
                          )
                        }
                        disabled={isPending}
                        required
                      />
                    </div>
                    <div className="flex pt-5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLeaveTypeRow(row.id)}
                        disabled={leaveTypeRows.length === 1 || isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Details (Optional) */}
            <div className="space-y-2">
              <Label>Details (Optional)</Label>
              <Input
                placeholder="Additional details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                disabled={isPending}
              />
            </div>

            {/* Total */}
            <div className="space-y-2">
              <Label className="font-semibold">Total</Label>
              <Input
                type="number"
                value={leaveTypeRows.reduce((sum, row) => {
                  const num = parseInt(row.numberOfLeaves) || 0;
                  return sum + num;
                }, 0)}
                disabled
                className="font-semibold bg-muted"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 justify-end pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleEditClose}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Update
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Leave Policy</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{lp.name}&quot;? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
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
