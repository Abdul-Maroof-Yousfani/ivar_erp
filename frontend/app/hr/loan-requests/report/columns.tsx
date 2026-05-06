"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";

export interface LoanReportRow {
  id: string;
  sNo: number;
  empId: string;
  empName: string;
  department: string;
  subDepartment: string;
  loanType: string;
  loanAmount: number;
  requestedDate: string;
  repaymentStartMonthYear: string;
  numberOfInstallments: number;
  installmentAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paidInstallments: number;
  totalInstallments: number;
  progressPercentage: number;
  status: string;
  approvalStatus: string;
}

export const columns: ColumnDef<LoanReportRow>[] = [
  {
    accessorKey: "sNo",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap text-center">
        S.No
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm font-medium text-muted-foreground w-12 text-center">
        {row.original.sNo}
      </div>
    ),
    size: 60,
    enableHiding: false,
    enableSorting: false,
  },
  {
    accessorKey: "employee",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
        Employee
      </div>
    ),
    cell: ({ row }) => (
      <div className="space-y-0.5 min-w-[180px]">
        <div className="text-sm font-semibold text-foreground">{row.original.empName}</div>
        <div className="text-xs text-muted-foreground font-mono">ID: {row.original.empId}</div>
      </div>
    ),
    size: 200,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      const nameA = rowA.original.empName?.toLowerCase() || "";
      const nameB = rowB.original.empName?.toLowerCase() || "";
      return nameA.localeCompare(nameB);
    },
  },
  {
    accessorKey: "department",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
        Department
      </div>
    ),
    cell: ({ row }) => (
      <div className="space-y-0.5 min-w-[160px]">
        <div className="text-sm font-medium">{row.original.department || "—"}</div>
        {row.original.subDepartment && (
          <div className="text-xs text-muted-foreground">{row.original.subDepartment}</div>
        )}
      </div>
    ),
    size: 180,
    enableSorting: true,
  },
  {
    accessorKey: "loanType",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
        Loan Type
      </div>
    ),
    cell: ({ row }) => (
      <Badge variant="outline" className="font-medium">
        {row.original.loanType}
      </Badge>
    ),
    size: 140,
    enableSorting: true,
  },
  {
    accessorKey: "loanAmount",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap text-right">
        Loan Amount
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm font-semibold text-right">
        {new Intl.NumberFormat("en-PK", {
          style: "currency",
          currency: "PKR",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(row.original.loanAmount)}
      </div>
    ),
    size: 130,
    enableSorting: true,
  },
  {
    accessorKey: "paidAmount",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap text-right">
        Paid Amount
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm font-semibold text-right text-green-600">
        {new Intl.NumberFormat("en-PK", {
          style: "currency",
          currency: "PKR",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(row.original.paidAmount)}
      </div>
    ),
    size: 130,
    enableSorting: true,
  },
  {
    accessorKey: "remainingAmount",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap text-right">
        Remaining
      </div>
    ),
    cell: ({ row }) => (
      <div className={
        `text-sm font-semibold text-right ${
          row.original.remainingAmount > 0 ? "text-orange-600" : "text-green-600"
        }`
      }>
        {new Intl.NumberFormat("en-PK", {
          style: "currency",
          currency: "PKR",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(row.original.remainingAmount)}
      </div>
    ),
    size: 130,
    enableSorting: true,
  },
  {
    accessorKey: "progress",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap text-center">
        Progress
      </div>
    ),
    cell: ({ row }) => {
      const progress = row.original.progressPercentage;
      return (
        <div className="space-y-1.5 min-w-[120px]">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-muted-foreground">Payment</span>
            <span className={
              progress === 100 ? "font-semibold text-green-600" : 
              progress > 50 ? "font-semibold text-blue-600" : 
              "font-semibold text-orange-600"
            }>
              {progress}%
            </span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className={
                `h-full transition-all duration-300 rounded-full ${
                  progress === 100 ? "bg-green-500" : 
                  progress > 50 ? "bg-blue-500" : 
                  "bg-orange-500"
                }`
              }
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="text-xs text-muted-foreground text-center">
            {row.original.paidInstallments} / {row.original.totalInstallments} installments
          </div>
        </div>
      );
    },
    size: 150,
    enableSorting: true,
    sortingFn: (rowA, rowB) => {
      return rowA.original.progressPercentage - rowB.original.progressPercentage;
    },
  },
  {
    accessorKey: "installmentAmount",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap text-right">
        Per Installment
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm text-right text-muted-foreground">
        {row.original.totalInstallments > 0 ? (
          new Intl.NumberFormat("en-PK", {
            style: "currency",
            currency: "PKR",
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          }).format(row.original.installmentAmount)
        ) : (
          "—"
        )}
      </div>
    ),
    size: 130,
    enableSorting: true,
  },
  {
    accessorKey: "repaymentStartMonthYear",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
        Repayment Start
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm text-muted-foreground">
        {row.original.repaymentStartMonthYear || "—"}
      </div>
    ),
    size: 140,
    enableSorting: true,
  },
  {
    accessorKey: "status",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap text-center">
        Status
      </div>
    ),
    cell: ({ row }) => {
      const status = row.original.status;
      const getVariant = () => {
        if (status === "Completed") return "default";
        if (status === "Disbursed") return "default";
        if (status === "Approved") return "secondary";
        if (status === "Pending") return "secondary";
        return "destructive";
      };
      
      const getColor = () => {
        if (status === "Completed") return "bg-green-500 hover:bg-green-600";
        if (status === "Disbursed") return "bg-blue-500 hover:bg-blue-600";
        if (status === "Approved") return "bg-yellow-500 hover:bg-yellow-600";
        if (status === "Pending") return "bg-gray-500 hover:bg-gray-600";
        return "bg-red-500 hover:bg-red-600";
      };

      return (
        <div className="flex justify-center">
          <Badge 
            variant={getVariant()}
            className={`text-white font-medium ${getColor()}`}
          >
            {status}
          </Badge>
        </div>
      );
    },
    size: 120,
    enableSorting: true,
  },
  {
    accessorKey: "approvalStatus",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap text-center">
        Approval
      </div>
    ),
    cell: ({ row }) => {
      const status = row.original.approvalStatus;
      return (
        <div className="flex justify-center">
          <Badge
            variant={
              status === "Approved"
                ? "default"
                : status === "Pending"
                ? "secondary"
                : "destructive"
            }
            className={
              `font-medium ${
                status === "Approved" ? "bg-green-500 hover:bg-green-600 text-white" :
                status === "Pending" ? "bg-yellow-500 hover:bg-yellow-600 text-white" :
                "bg-red-500 hover:bg-red-600 text-white"
              }`
            }
          >
            {status}
          </Badge>
        </div>
      );
    },
    size: 110,
    enableSorting: true,
  },
];
