"use client";

import DataTable from "@/components/common/data-table";
import { columns, type LoanRequestRow } from "./columns";
import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import Link from "next/link";
import { Plus } from "lucide-react";

interface LoanRequestListProps {
  initialData?: LoanRequestRow[];
}

export function LoanRequestList({ initialData = [] }: LoanRequestListProps) {
  const data: LoanRequestRow[] = initialData;

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (data.length === 0) {
      toast.error("No data to export");
      return;
    }

    const headers = [
      "S.No",
      "EMP ID",
      "Employee Name",
      "Department",
      "Month",
      "Year",
      "Loan Amount",
      "Top Up Amount",
      "Total Loan",
      "Loan Adjustment",
      "Description",
      "Overall PF",
      "Paid Loan Amount",
      "Remaining Amount",
      "Approval Remarks 1",
      "Status",
    ];

    const rows = data.map((row) => [
      row.sNo,
      row.empId,
      row.empName,
      row.department || "-",
      row.month,
      row.year,
      row.loanAmount,
      row.topUpAmount,
      row.totalLoan,
      row.loanAdjustment,
      row.description,
      row.overallPF,
      row.paidLoanAmount,
      row.remainingAmount,
      row.approvalRemarks1,
      row.status,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `loan_request_list_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    toast.success("Data exported successfully");
  };

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            View Loan Request List
          </h2>
          <p className="text-muted-foreground">
            View employee loan request records
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/hr/payroll-setup/loan-requests/create">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Loan Request
            </Button>
          </Link>
          <Button variant="secondary" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button variant="secondary" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="w-full max-w-full overflow-x-hidden">
        <DataTable
          columns={columns}
          data={data}
          searchFields={[
            { key: "empName", label: "Employee Name" },
            { key: "empId", label: "Employee ID" },
            { key: "department", label: "Department" },
          ]}
        tableId="loan-request-list"/>
      </div>
    </div>
  );
}

