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
import { format } from "date-fns";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteOvertimeRequest } from "@/lib/actions/overtime";
import { toast } from "sonner";

export interface OvertimeRow {
  id: string;
  sNo: number;
  employeeName: string;
  overtimeType: string;
  weekdayOvertimeHours: number;
  holidayOvertimeHours: number;
  date: string;
  approval1: string;
}

export const columns: ColumnDef<OvertimeRow>[] = [
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
    accessorKey: "employeeName",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Employee Name
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm font-medium">{row.original.employeeName}</div>
    ),
    size: 180,
  },
  {
    accessorKey: "overtimeType",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Overtime Type
      </div>
    ),
    cell: ({ row }) => (
      <Badge variant="outline" className="font-medium">
        {row.original.overtimeType}
      </Badge>
    ),
    size: 130,
  },
  {
    accessorKey: "weekdayOvertimeHours",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Weekday Overtime Hours
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm font-medium">
        {row.original.weekdayOvertimeHours.toFixed(2)}
      </div>
    ),
    size: 180,
  },
  {
    accessorKey: "holidayOvertimeHours",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Holiday Overtime Hours
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm font-medium">
        {row.original.holidayOvertimeHours.toFixed(2)}
      </div>
    ),
    size: 180,
  },
  {
    accessorKey: "date",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Date
      </div>
    ),
    cell: ({ row }) => {
      try {
        const date = new Date(row.original.date);
        return (
          <div className="text-sm">
            {format(date, "dd-MMM-yyyy")}
          </div>
        );
      } catch {
        return <div className="text-sm">{row.original.date}</div>;
      }
    },
    size: 120,
  },
  // {
  //   accessorKey: "approval1",
  //   header: () => (
  //     <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
  //       Approval 1
  //     </div>
  //   ),
  //   cell: ({ row }) => {
  //     const status = row.original.approval1;
  //     const variant =
  //       status === "Approved"
  //         ? "default"
  //         : status === "Pending"
  //         ? "secondary"
  //         : "destructive";
  //     return (
  //       <Badge variant={variant} className="font-medium">
  //         {status}
  //       </Badge>
  //     );
  //   },
  //   size: 120,
  // },
  {
    id: "actions",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right">
        Action
      </div>
    ),
    cell: ({ row }) => {
      const [deleteDialog, setDeleteDialog] = useState(false);
      const [isPending, startTransition] = useTransition();
      const router = useRouter();

      const handleDelete = () => {
        startTransition(async () => {
          try {
            const result = await deleteOvertimeRequest(row.original.id);
            if (result.status) {
              toast.success(result.message || "Overtime request deleted successfully");
              router.refresh();
              setDeleteDialog(false);
            } else {
              toast.error(result.message || "Failed to delete overtime request");
            }
          } catch (error) {
            console.error("Error deleting overtime request:", error);
            toast.error("Failed to delete overtime request");
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
                  <Link href={`/hr/payroll-setup/overtime/view/${row.original.id}`}>
                    <Eye className="h-4 w-4 mr-2" />
                    View
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/hr/payroll-setup/overtime/edit/${row.original.id}`}>
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
                <AlertDialogTitle>Delete Overtime Request</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this overtime request for{" "}
                  <strong>{row.original.employeeName}</strong>? This action cannot be undone.
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

