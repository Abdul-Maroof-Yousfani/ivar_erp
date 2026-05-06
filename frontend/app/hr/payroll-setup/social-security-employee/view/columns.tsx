"use client";

import { ColumnDef } from "@tanstack/react-table";
import { SocialSecurityEmployee } from "@/lib/actions/social-security-employee";
import { Badge } from "@/components/ui/badge";

export const columns: ColumnDef<SocialSecurityEmployee>[] = [
  {
    id: "serialNumber",
    header: "S.No",
    cell: ({ row }) => <div className="text-center">{row.index + 1}</div>,
  },
  {
    id: "employeeDetails",
    accessorFn: (row) => `${row.employee.employeeName} ${row.employee.employeeId} ${row.employee.department?.name || ''}`,
    header: "Employee Details",
    cell: ({ row }) => (
      <div className="space-y-1">
        <div className="font-medium">{row.original.employee.employeeName}</div>
        <div className="text-xs text-muted-foreground">
          {row.original.employee.employeeId}
        </div>
        <div className="text-xs text-muted-foreground">
          {row.original.employee.department?.name || "N/A"}
        </div>
      </div>
    ),
  },
  {
    accessorKey: "institution.name",
    header: "Institution",
    cell: ({ row }) => (
      <div className="space-y-1">
        <div className="font-medium">{row.original.institution.code}</div>
        <div className="text-xs text-muted-foreground">
          {row.original.institution.name}
        </div>
      </div>
    ),
  },
  {
    accessorKey: "registrationNumber",
    header: "Registration No",
    cell: ({ row }) => (
        <div className="font-mono text-xs">{row.getValue("registrationNumber")}</div>
    ),
  },
  {
    accessorKey: "monthlyContribution",
    header: "Monthly Contribution",
    cell: ({ row }) => {
      const amount = Number(row.getValue("monthlyContribution"));
      const formatted = new Intl.NumberFormat("en-PK", {
        style: "currency",
        currency: "PKR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
      return <div className="font-medium text-green-600">{formatted}</div>;
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.getValue("status") as string;
      return (
        <Badge variant={status === "active" ? "default" : "secondary"}>
          {status}
        </Badge>
      );
    },
  },
];
