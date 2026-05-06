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
import { EllipsisIcon, Eye, Loader2, Pencil, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { ExitClearance, deleteExitClearance } from "@/lib/actions/exit-clearance";
import { useAuth } from "@/components/providers/auth-provider";

export type ExitClearanceRow = ExitClearance & { id: string };

const statusVariant = (status: string) => {
  if (status === "approved") return "default";
  if (status === "rejected") return "destructive";
  return "secondary";
};

export const columns: ColumnDef<ExitClearanceRow>[] = [
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
    header: "Employee Name",
    accessorKey: "employeeName",
    size: 200,
    enableSorting: true,
    cell: ({ row }) => <HighlightText text={row.original.employeeName} />,
  },
  {
    header: "Dep/Sub Dep",
    accessorKey: "department",
    size: 200,
    enableSorting: true,
    cell: ({ row }) => {
      const dept = row.original.department;
      const subDept = row.original.subDepartment;
      return dept && subDept ? `${dept} / ${subDept}` : dept || "—";
    },
  },
  {
    header: "Designation",
    accessorKey: "designation",
    size: 150,
    enableSorting: true,
    cell: ({ row }) => row.original.designation || "—",
  },
  {
    header: "Last Working Date",
    accessorKey: "lastWorkingDate",
    size: 150,
    enableSorting: true,
    cell: ({ row }) => new Date(row.original.lastWorkingDate).toLocaleDateString(),
  },
  {
    header: "Approval Status",
    accessorKey: "approvalStatus",
    size: 130,
    enableSorting: true,
    cell: ({ row }) => (
      <Badge variant={statusVariant(row.original.approvalStatus)}>
        {row.original.approvalStatus}
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
  row: Row<ExitClearanceRow>;
};

function RowActions({ row }: RowActionsProps) {
  const record = row.original;
  const { hasPermission } = useAuth();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteDialog, setDeleteDialog] = useState(false);

  const handleDeleteConfirm = async () => {
    startTransition(async () => {
      const result = await deleteExitClearance(record.id);
      if (result.status) {
        toast.success(result.message || "Record deleted successfully");
        setDeleteDialog(false);
        router.refresh();
      } else {
        toast.error(result.message || "Failed to delete record");
      }
    });
  };

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
            <Link href={`/hr/exit-clearance/list/${record.id}`}>
              <Eye className="h-4 w-4 mr-2" />
              View
            </Link>
          </DropdownMenuItem>
          {hasPermission("hr.exit-clearance.update") && (
            <DropdownMenuItem asChild>
              <Link href={`/hr/exit-clearance/edit/${record.id}`}>
                <Pencil className="h-4 w-4 mr-2" />
                Edit
              </Link>
            </DropdownMenuItem>
          )}
          {hasPermission("hr.exit-clearance.delete") && (
            <DropdownMenuItem
              onClick={() => setDeleteDialog(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete clearance for &quot;{record.employeeName}&quot;?
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

