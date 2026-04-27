"use client";

import { ColumnDef } from "@tanstack/react-table";
import { PFWithdrawal } from "@/lib/actions/pf-withdrawal";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export const columns: ColumnDef<PFWithdrawal>[] = [
    {
        id: "serialNumber",
        header: "S.No",
        cell: ({ row }) => <div className="text-center">{row.index + 1}</div>,
    },
    {
        id: "employeeDetails",
        accessorFn: (row) => `${row.employee.employeeName} ${row.employee.employeeId} ${row.employee.department.name} ${row.employee.subDepartment?.name || ''}`,
        header: "Employee Details",
        cell: ({ row }) => (
            <div className="space-y-1">
                <div className="font-medium">{row.original.employee.employeeName}</div>
                <div className="text-xs text-muted-foreground">
                    {row.original.employee.employeeId}
                </div>
                <div className="text-xs text-muted-foreground">
                    {row.original.employee.department.name}
                    {row.original.employee.subDepartment?.name ? ` • ${row.original.employee.subDepartment.name}` : ""}
                </div>
            </div>
        ),
    },
    {
        accessorKey: "withdrawalAmount",
        header: "Withdrawal Amount",
        cell: ({ row }) => {
            const amount = parseFloat(row.getValue("withdrawalAmount"));
            const formatted = new Intl.NumberFormat("en-PK", {
                style: "currency",
                currency: "PKR",
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
            }).format(amount);
            return <div className="text-right font-bold">{formatted}</div>;
        },
    },
    {
        accessorKey: "monthYear",
        header: "Month/Year",
        cell: ({ row }) => {
            const [year, month] = row.getValue<string>("monthYear").split("-");
            const monthNames = [
                "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
            ];
            return `${monthNames[parseInt(month) - 1]} ${year}`;
        },
    },
    {
        accessorKey: "withdrawalDate",
        header: "Withdrawal Date",
        cell: ({ row }) => {
            const date = new Date(row.getValue("withdrawalDate"));
            return format(date, "dd MMM yyyy");
        },
    },
    {
        accessorKey: "approvalStatus",
        header: "Approval Status",
        cell: ({ row }) => {
            const status = row.getValue<string>("approvalStatus");
            const variant =
                status === "approved"
                    ? "default"
                    : status === "rejected"
                        ? "destructive"
                        : "secondary";
            return (
                <Badge variant={variant} className="capitalize">
                    {status}
                </Badge>
            );
        },
    },
    {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
            const status = row.getValue<string>("status");
            const variant =
                status === "processed"
                    ? "default"
                    : status === "cancelled"
                        ? "destructive"
                        : "secondary";
            return (
                <Badge variant={variant} className="capitalize">
                    {status}
                </Badge>
            );
        },
    },
];
