"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, Eye } from "lucide-react";

export interface HrLetterRow {
  id: string;
  sNo: number;
  empId: string;
  empName: string;
  department: string;
  subDepartment: string;
  letterType: string;
  createdAt: string;
  status: string;
}

export const columns: ColumnDef<HrLetterRow>[] = [
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
    accessorKey: "employee",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Emp ID
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
        Emp Name
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm">{row.original.empName}</div>
    ),
    size: 150,
  },
  {
    accessorKey: "departmentInfo",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Dept / Subdept
      </div>
    ),
    cell: ({ row }) => (
      <div className="space-y-1">
        <div className="text-sm">{row.original.department || "-"}</div>
        <div className="text-sm text-muted-foreground">{row.original.subDepartment || "-"}</div>
      </div>
    ),
    size: 200,
  },
  {
    accessorKey: "letterType",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Letter Type
      </div>
    ),
    cell: ({ row }) => (
      <Badge variant="outline" className="font-medium">
        {row.original.letterType}
      </Badge>
    ),
    size: 180,
  },
  {
    accessorKey: "createdAt",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Created Date
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm">{row.original.createdAt}</div>
    ),
    size: 120,
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
    id: "view",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        View
      </div>
    ),
    cell: ({ row }) => (
      <Button
        variant="link"
        size="sm"
        onClick={() => {
          // Handle view
          console.log("View", row.original.id);
        }}
      >
        <Eye className="h-4 w-4 mr-1" />
        View
      </Button>
    ),
    size: 100,
  },
  {
    id: "actions",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Action
      </div>
    ),
    cell: ({ row }) => (
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            // Handle action dropdown
            console.log("Action", row.original.id);
          }}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>
    ),
    size: 100,
  },
];

