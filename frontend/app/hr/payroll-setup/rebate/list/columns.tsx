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
import { EllipsisIcon, Eye, FileText, Loader2, Pencil, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteRebate } from "@/lib/actions/rebate";
import Link from "next/link";

export type RebateRow = {
  id: string;
  sNo: number;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department: string;
  departmentId?: string;
  subDepartment: string;
  subDepartmentId?: string;
  month: string;
  year: string;
  monthYear: string;
  rebateType: string;
  rebateNature: string;
  actualInvestment: number | null;
  rebateAmount: number;
  documentUrl: string | null;
  status: string;
  createdAt: string;
};

const statusVariant = (status: string) => {
  if (status === "approved") return "default";
  if (status === "pending") return "secondary";
  if (status === "rejected") return "destructive";
  return "secondary";
};

export const columns: ColumnDef<RebateRow>[] = [
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
    header: "S No.",
    accessorKey: "sNo",
    size: 60,
    enableSorting: false,
    cell: ({ row }) => <HighlightText text={row.original.sNo.toString()} />,
  },
  {
    header: "Emp Code",
    accessorKey: "employeeCode",
    size: 120,
    enableSorting: true,
    cell: ({ row }) => <HighlightText text={row.original.employeeCode} />,
  },
  {
    header: "Employee Name",
    accessorKey: "employeeName",
    size: 200,
    enableSorting: true,
    cell: ({ row }) => <HighlightText text={row.original.employeeName} />,
  },
  {
    header: "Month - Year",
    accessorKey: "monthYear",
    size: 130,
    enableSorting: true,
    cell: ({ row }) => <HighlightText text={row.original.monthYear} />,
  },
  {
    header: "Type",
    accessorKey: "rebateType",
    size: 120,
    enableSorting: true,
    cell: ({ row }) => <HighlightText text={row.original.rebateType} />,
  },
  {
    header: "Nature",
    accessorKey: "rebateNature",
    size: 150,
    enableSorting: true,
    cell: ({ row }) => <HighlightText text={row.original.rebateNature} />,
  },
  {
    header: "Actual Investment",
    accessorKey: "actualInvestment",
    size: 150,
    enableSorting: true,
    cell: ({ row }) => {
      const investment = row.original.actualInvestment;
      return investment !== null && investment !== undefined
        ? investment.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
        : "—";
    },
  },
  {
    header: "Rebate Amount",
    accessorKey: "rebateAmount",
    size: 150,
    enableSorting: true,
    cell: ({ row }) =>
      row.original.rebateAmount.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
  },
  {
    header: "Documents",
    accessorKey: "documentUrl",
    size: 100,
    enableSorting: false,
    cell: ({ row }) => {
      const documentUrl = row.original.documentUrl;
      if (!documentUrl) {
        return <span className="text-muted-foreground">—</span>;
      }
      return (
        <a
          href={documentUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          <FileText className="h-4 w-4" />
        </a>
      );
    },
  },
  {
    header: "Status",
    accessorKey: "status",
    size: 100,
    enableSorting: true,
    cell: ({ row }) => (
      <Badge variant={statusVariant(row.original.status)}>
        {row.original.status}
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
  row: Row<RebateRow>;
};

function RowActions({ row }: RowActionsProps) {
  const record = row.original;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteDialog, setDeleteDialog] = useState(false);

  const handleDeleteConfirm = async () => {
    startTransition(async () => {
      const result = await deleteRebate(record.id);
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
            <Link href={`/hr/payroll-setup/rebate/view/${record.id}`}>
              <Eye className="h-4 w-4 mr-2" />
              View
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/hr/payroll-setup/rebate/edit/${record.id}`}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </Link>
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

      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete rebate for &quot;{record.employeeName}&quot;?
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

