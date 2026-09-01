"use client";

import { ColumnDef } from "@tanstack/react-table";
import { EOBIEmployee } from "@/lib/actions/eobi-employee";
import { Badge } from "@/components/ui/badge";

const formatPKR = (amount: number) =>
    new Intl.NumberFormat("en-PK", {
        style: "currency",
        currency: "PKR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);

export const columns: ColumnDef<EOBIEmployee>[] = [
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
        accessorKey: "totalEOBIBalance",
        header: "Total EOBI Balance",
        cell: ({ row }) => (
            <div className="font-medium">{formatPKR(row.original.totalEOBIBalance)}</div>
        ),
    },
    {
        accessorKey: "totalWithdrawn",
        header: "Total Withdrawn",
        cell: ({ row }) => {
            const amount = row.original.totalWithdrawn;
            return (
                <div className={`font-medium ${amount > 0 ? "text-red-600" : "text-muted-foreground"}`}>
                    {amount > 0 ? `-${formatPKR(amount)}` : formatPKR(0)}
                </div>
            );
        },
    },
    {
        accessorKey: "availableBalance",
        header: "Available Balance",
        cell: ({ row }) => {
            const amount = row.original.availableBalance;
            return (
                <div className={`font-bold ${amount <= 0 ? "text-red-600" : "text-green-600"}`}>
                    {formatPKR(amount)}
                </div>
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
