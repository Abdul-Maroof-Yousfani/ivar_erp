"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { MoreHorizontal, Eye, Pencil, Trash2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteLoanRequest } from "@/lib/actions/loan-request";
import { toast } from "sonner";

export interface LoanRequestRow {
  id: string;
  sNo: number;
  empId: string;
  empName: string;
  department: string;
  subDepartment: string;
  month: string;
  year: string;
  loanAmount: string;
  topUpAmount: string;
  totalLoan: string;
  loanAdjustment: string;
  description: string;
  overallPF: string;
  paidLoanAmount: string;
  remainingAmount: string;
  approvalRemarks1: string;
  status: string;
}

export const columns: ColumnDef<LoanRequestRow>[] = [
  {
    accessorKey: "sNo",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        S.No
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm font-medium text-muted-foreground w-8">
        {row.original.sNo}
      </div>
    ),
    size: 60,
  },
  {
    accessorKey: "empId",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        EMP ID
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm font-medium">{row.original.empId}</div>
    ),
    size: 100,
  },
  {
    accessorKey: "empName",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Employee Name
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm">{row.original.empName}</div>
    ),
    size: 150,
  },
  {
    accessorKey: "department",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Department
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm">{row.original.department || "-"}</div>
    ),
    size: 150,
  },
  {
    accessorKey: "month",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Month
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm">{row.original.month}</div>
    ),
    size: 100,
  },
  {
    accessorKey: "year",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Year
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm">{row.original.year}</div>
    ),
    size: 100,
  },
  {
    accessorKey: "loanAmount",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Loan Amount
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm font-medium">{row.original.loanAmount}</div>
    ),
    size: 120,
  },
  {
    accessorKey: "topUpAmount",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Top Up Amount
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm font-medium">{row.original.topUpAmount}</div>
    ),
    size: 120,
  },
  {
    accessorKey: "totalLoan",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Total Loan
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm font-medium">{row.original.totalLoan}</div>
    ),
    size: 120,
  },
  {
    accessorKey: "loanAdjustment",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Loan Adjustment
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm font-medium">{row.original.loanAdjustment}</div>
    ),
    size: 120,
  },
  {
    accessorKey: "description",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Description
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm max-w-[200px] truncate" title={row.original.description}>
        {row.original.description}
      </div>
    ),
    size: 200,
  },
  {
    accessorKey: "overallPF",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Overall PF
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm font-medium">{row.original.overallPF}</div>
    ),
    size: 100,
  },
  {
    accessorKey: "paidLoanAmount",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Paid Loan Amount
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm font-medium">{row.original.paidLoanAmount}</div>
    ),
    size: 120,
  },
  {
    accessorKey: "remainingAmount",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Remaining Amount
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm font-medium">{row.original.remainingAmount}</div>
    ),
    size: 120,
  },
  {
    accessorKey: "approvalRemarks1",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Approval Remarks 1
      </div>
    ),
    cell: ({ row }) => {
      const remarks = row.original.approvalRemarks1;
      if (!remarks || remarks === "-") {
        return <div className="text-sm text-muted-foreground">-</div>;
      }
      return (
        <div className="flex gap-2 flex-wrap">
          {remarks.split(",").map((remark, idx) => (
            <Badge key={idx} variant="secondary" className="text-xs">
              {remark.trim()}
            </Badge>
          ))}
        </div>
      );
    },
    size: 150,
  },
  {
    accessorKey: "status",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Status
      </div>
    ),
    cell: ({ row }) => {
      const status = row.original.status;
      const variant =
        status === "Active" || status === "Approved"
          ? "default"
          : status === "Pending"
          ? "secondary"
          : "destructive";
      return (
        <Badge variant={variant} className="font-medium">
          {status}
        </Badge>
      );
    },
    size: 100,
  },
  {
    id: "actions",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
        Actions
      </div>
    ),
    cell: ({ row }) => {
      const [deleteDialog, setDeleteDialog] = useState(false);
      const [isPending, startTransition] = useTransition();
      const router = useRouter();

      const handleDelete = () => {
        startTransition(async () => {
          try {
            const result = await deleteLoanRequest(row.original.id);
            if (result.status) {
              toast.success(result.message || "Loan request deleted successfully");
              router.refresh();
              setDeleteDialog(false);
            } else {
              toast.error(result.message || "Failed to delete loan request");
            }
          } catch (error) {
            console.error("Error deleting loan request:", error);
            toast.error("Failed to delete loan request");
          }
        });
      };

      return (
        <>
          <div className="flex items-center justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/hr/payroll-setup/loan-requests/view/${row.original.id}`}>
                    <Eye className="h-4 w-4 mr-2" />
                    View
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/hr/payroll-setup/loan-requests/edit/${row.original.id}`}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setDeleteDialog(true)}
                  className="text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Loan Request</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this loan request for{" "}
                  <strong>{row.original.empName}</strong>? This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
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
    },
    size: 100,
  },
];

