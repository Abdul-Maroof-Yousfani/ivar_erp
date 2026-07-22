"use client";

import { useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { PFWithdrawal } from "@/lib/actions/pf-withdrawal";
import { approvePFWithdrawal } from "@/lib/actions/pf-withdrawal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { toast } from "sonner";
import { CheckCircle, Loader2 } from "lucide-react";

function ApproveButton({ row, onApproved }: { row: PFWithdrawal; onApproved: (id: string) => void }) {
    const [loading, setLoading] = useState(false);

    if (row.approvalStatus === "approved") {
        return null;
    }

    const handleApprove = async () => {
        setLoading(true);
        try {
            const result = await approvePFWithdrawal(row.id);
            if (result.status) {
                toast.success("PF withdrawal approved successfully");
                onApproved(row.id);
            } else {
                toast.error(result.message || "Failed to approve withdrawal");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <Button
            size="sm"
            variant="outline"
            className="text-green-600 border-green-600 hover:bg-green-50 hover:text-green-700"
            onClick={handleApprove}
            disabled={loading}
        >
            {loading ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
            ) : (
                <CheckCircle className="h-3 w-3 mr-1" />
            )}
            Approve
        </Button>
    );
}

export function getColumns(onApproved: (id: string) => void): ColumnDef<PFWithdrawal>[] {
    return [
        {
            id: "serialNumber",
            header: "S.No",
            cell: ({ row }) => <div className="text-center">{row.index + 1}</div>,
        },
        {
            id: "employeeDetails",
            accessorFn: (row) => `${row.employee.employeeName} ${row.employee.employeeId} ${row.employee.department?.name || ''} ${row.employee.subDepartment?.name || ''}`,
            header: "Employee Details",
            cell: ({ row }) => (
                <div className="space-y-1">
                    <div className="font-medium">{row.original.employee.employeeName}</div>
                    <div className="text-xs text-muted-foreground">
                        {row.original.employee.employeeId}
                    </div>
                    {(row.original.employee.department?.name || row.original.employee.subDepartment?.name) && (
                        <div className="text-xs text-muted-foreground">
                            {row.original.employee.department?.name || 'N/A'}
                            {row.original.employee.subDepartment?.name ? ` • ${row.original.employee.subDepartment.name}` : ""}
                        </div>
                    )}
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
                const monthYear = row.getValue<string>("monthYear");
                return monthYear;
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
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }) => (
                <ApproveButton row={row.original} onApproved={onApproved} />
            ),
        },
    ];
}
