"use client";

import { ColumnDef } from "@tanstack/react-table";
import { EOBIReportItem } from "@/lib/actions/eobi-report";

export const columns: ColumnDef<EOBIReportItem>[] = [
    {
        id: "serialNumber",
        header: "S.No",
        cell: ({ row }) => row.index + 1,
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
        accessorKey: "totalEOBIBalance",
        header: "Total EOBI",
        cell: ({ row }) => {
            const amount = parseFloat(row.getValue("totalEOBIBalance"));
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
        accessorKey: "totalWithdrawal",
        header: "EOBI Withdrawal",
        cell: ({ row }) => {
            const amount = parseFloat(row.getValue("totalWithdrawal"));
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
        accessorKey: "closingBalance",
        header: "EOBI Closing Amount",
        cell: ({ row }) => {
            const amount = parseFloat(row.getValue("closingBalance"));
            const formatted = new Intl.NumberFormat("en-PK", {
                style: "currency",
                currency: "PKR",
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
            }).format(amount);
            return <div className="font-bold text-green-600">{formatted}</div>;
        },
    },
];
