"use client";

import { ColumnDef, Row } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { EllipsisIcon, Eye, Loader2, Pencil, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { format } from "date-fns";
import { deleteLeaveEncashment, approveLeaveEncashment, rejectLeaveEncashment } from "@/lib/actions/leave-encashment";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/components/providers/auth-provider";

export type LeaveEncashmentRow = {
  id: string;
  sNo: number;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  encashmentDate: string;
  encashmentDays: number;
  encashmentAmount: number;
  approvalStatus: string;
  status: string;
  createdAt: string;
  createdById?: string;
};

const approvalStatusVariant = (status: string) => {
  if (status === "approved") return "default";
  if (status === "rejected") return "destructive";
  return "secondary";
};

export const columns: ColumnDef<LeaveEncashmentRow>[] = [
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
    header: "S.No",
    accessorKey: "sNo",
    size: 60,
    enableSorting: false,
    cell: ({ row }) => <HighlightText text={row.original.sNo.toString()} />,
  },
  {
    header: "Employee Name",
    accessorKey: "employeeName",
    size: 200,
    enableSorting: true,
    cell: ({ row }) => <HighlightText text={row.original.employeeName} />,
  },
  {
    header: "Encashment Date",
    accessorKey: "encashmentDate",
    size: 150,
    enableSorting: true,
    cell: ({ row }) => {
      const date = row.original.encashmentDate;
      if (!date) return "—";
      try {
        return format(new Date(date), "dd-MMM-yyyy");
      } catch {
        return date;
      }
    },
  },
  {
    header: "Encashment Days",
    accessorKey: "encashmentDays",
    size: 150,
    enableSorting: true,
    cell: ({ row }) => row.original.encashmentDays.toFixed(1),
  },
  {
    header: "Encashment Amount",
    accessorKey: "encashmentAmount",
    size: 180,
    enableSorting: true,
    cell: ({ row }) =>
      row.original.encashmentAmount.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
  },
  {
    header: "Approval 1",
    accessorKey: "approvalStatus",
    size: 130,
    enableSorting: true,
    cell: ({ row }) => (
      <Badge variant={approvalStatusVariant(row.original.approvalStatus)}>
        {row.original.approvalStatus.charAt(0).toUpperCase() + row.original.approvalStatus.slice(1)}
      </Badge>
    ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => <RowActions row={row} />,
    size: 60,
    enableHiding: false,
  },
];

type RowActionsProps = {
  row: Row<LeaveEncashmentRow>;
};

function RowActions({ row }: RowActionsProps) {
  const record = row.original;
  const router = useRouter();
  const { user } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [approveDialog, setApproveDialog] = useState(false);
  const [rejectDialog, setRejectDialog] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  // Check if current user created this request
  const isCreatedByCurrentUser = record.createdById === user?.id;

  const handleDeleteConfirm = async () => {
    startTransition(async () => {
      const result = await deleteLeaveEncashment(record.id);
      if (result.status) {
        toast.success(result.message || "Record deleted successfully");
        setDeleteDialog(false);
        router.refresh();
      } else {
        toast.error(result.message || "Failed to delete record");
      }
    });
  };

  const handleApproveConfirm = async () => {
    startTransition(async () => {
      const result = await approveLeaveEncashment(record.id);
      if (result.status) {
        toast.success(result.message || "Leave encashment approved successfully");
        setApproveDialog(false);
        router.refresh();
      } else {
        toast.error(result.message || "Failed to approve leave encashment");
      }
    });
  };

  const handleRejectConfirm = async () => {
    startTransition(async () => {
      const result = await rejectLeaveEncashment(record.id, rejectionReason || undefined);
      if (result.status) {
        toast.success(result.message || "Leave encashment rejected successfully");
        setRejectDialog(false);
        setRejectionReason("");
        router.refresh();
      } else {
        toast.error(result.message || "Failed to reject leave encashment");
      }
    });
  };

  const isPendingStatus = record.approvalStatus === "pending";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="flex justify-end">
            <Button size="icon" variant="ghost" className="shadow-none" aria-label="Actions">
              <EllipsisIcon size={16} />
            </Button>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/hr/payroll-setup/leave-encashment/view/${record.id}`}>
              <Eye className="h-4 w-4 mr-2" />
              View
            </Link>
          </DropdownMenuItem>
          {isPendingStatus && (
            <DropdownMenuItem asChild>
              <Link href={`/hr/payroll-setup/leave-encashment/edit/${record.id}`}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Link>
            </DropdownMenuItem>
          )}
          {isPendingStatus && (
            <>
              <DropdownMenuItem
                onClick={() => setApproveDialog(true)}
                disabled={isCreatedByCurrentUser}
                className="text-green-600 focus:text-green-600"
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Approve
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setRejectDialog(true)}
                disabled={isCreatedByCurrentUser}
                className="text-destructive focus:text-destructive"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem
            onClick={() => setDeleteDialog(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete leave encashment for &quot;{record.employeeName}&quot;?
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

      <AlertDialog open={approveDialog} onOpenChange={setApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Leave Encashment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to approve leave encashment for &quot;{record.employeeName}&quot;?
              <br />
              <span className="font-semibold mt-2 block">
                Amount: {record.encashmentAmount.toLocaleString("en-US")} PKR
              </span>
              <span className="font-semibold">
                Days: {record.encashmentDays}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleApproveConfirm}
              disabled={isPending}
              className="bg-green-600 text-white hover:bg-green-700"
            >
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Approve
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={rejectDialog} onOpenChange={setRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Leave Encashment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reject leave encashment for &quot;{record.employeeName}&quot;?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Label htmlFor="rejectionReason">Rejection Reason (Optional)</Label>
            <Input
              id="rejectionReason"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter reason for rejection..."
              className="mt-2"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRejectionReason("")}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRejectConfirm}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reject
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

