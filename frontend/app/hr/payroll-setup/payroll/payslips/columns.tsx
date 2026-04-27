"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Eye, Download } from "lucide-react";

export type PayslipRow = {
    id: string;
    payrollId: string;
    employeeId: string;
    employee: {
        employeeId: string;
        employeeName: string;
        officialEmail: string;
    };
};

export const getColumns = (
    onView: (id: string) => void,
    onDownload: (id: string) => void
): ColumnDef<PayslipRow>[] => [
        {
            header: "S.no",
            cell: ({ row }) => row.index + 1,
            size: 60,
        },
        {
            accessorKey: "employee.employeeId",
            header: "Emp ID",
            cell: ({ row }) => <span className="font-mono">{row.original.employee.employeeId}</span>,
        },
        {
            accessorKey: "employee.employeeName",
            header: "Emp Name",
            cell: ({ row }) => <span className="font-medium uppercase">{row.original.employee.employeeName}</span>,
        },
        {
            accessorKey: "employee.officialEmail",
            header: "Emp Email",
        },
        {
            id: "actions",
            header: "View",
            cell: ({ row }) => (
                <Button variant="ghost" size="sm" onClick={() => onView(row.original.id)}>
                    <Eye className="h-4 w-4 text-indigo-600 mr-1" />
                    <span className="text-xs underline text-indigo-600">View</span>
                </Button>
            ),
            size: 100,
        },
        {
            id: "download",
            header: "Download",
            cell: ({ row }) => (
                <Button variant="ghost" size="sm" onClick={() => onDownload(row.original.id)}>
                    <Download className="h-4 w-4 text-red-500" />
                </Button>
            ),
            size: 100,
        },
    ];
