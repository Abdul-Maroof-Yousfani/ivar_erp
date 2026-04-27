"use client";

import { ColumnDef } from "@tanstack/react-table";
import { PFEmployee } from "@/lib/actions/pf-employee";
import { Badge } from "@/components/ui/badge";

export const columns: ColumnDef<PFEmployee>[] = [
    {
        id: "serialNumber",
        header: "S.No",
        cell: ({ row }) => <div className="text-center">{row.index + 1}</div>,
    },
    {
        id: "employeeDetails",
        accessorFn: (row) => `${row.employeeName} ${row.employeeId} ${row.department} ${row.subDepartment || ''} ${row.designation || ''}`,
        header: "Employee Details",
        cell: ({ row }) => (
            <div className="space-y-1">
                <div className="font-medium">{row.original.employeeName}</div>
                <div className="text-xs text-muted-foreground">
                    {row.original.employeeId}
                </div>
                <div className="text-xs text-muted-foreground">
                    {row.original.department}
                    {row.original.subDepartment ? ` • ${row.original.subDepartment}` : ""}
                </div>
            </div>
        ),
    },
    {
        accessorKey: "designation",
        header: "Designation",
    },
    {
        accessorKey: "employeeContribution",
        header: "Employee Contribution",
        cell: ({ row }) => {
            const amount = parseFloat(row.getValue("employeeContribution"));
            const formatted = new Intl.NumberFormat("en-PK", {
                style: "currency",
                currency: "PKR",
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
            }).format(amount);
            return <div className="font-medium">{formatted}</div>;
        },
    },
    {
        accessorKey: "employerContribution",
        header: "Employer Contribution",
        cell: ({ row }) => {
            const amount = parseFloat(row.getValue("employerContribution"));
            const formatted = new Intl.NumberFormat("en-PK", {
                style: "currency",
                currency: "PKR",
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
            }).format(amount);
            return <div className="font-medium">{formatted}</div>;
        },
    },
    {
        accessorKey: "totalPFBalance",
        header: "Total PF Balance",
        cell: ({ row }) => {
            const amount = parseFloat(row.getValue("totalPFBalance"));
            const formatted = new Intl.NumberFormat("en-PK", {
                style: "currency",
                currency: "PKR",
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
            }).format(amount);
            return (
                <div className="font-bold text-green-600">{formatted}</div>
            );
        },
    },
    {
        accessorKey: "lastContributionMonth",
        header: "Last Contribution",
        cell: ({ row }) => (
            <Badge variant="outline">{row.getValue("lastContributionMonth")}</Badge>
        ),
    },
    {
        accessorKey: "totalMonths",
        header: "Total Months",
        cell: ({ row }) => (
            <div className="text-center">
                <Badge variant="secondary">{row.getValue("totalMonths")}</Badge>
            </div>
        ),
    },
];
