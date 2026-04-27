"use client";

import { useMemo } from "react";
import DataTable from "@/components/common/data-table";
import { columns as reportColumns, type LoanReportRow } from "../report/columns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Printer, Download, TrendingUp, DollarSign, CreditCard, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface LoanReportContentProps {
  initialData?: LoanReportRow[];
  summary: {
    totalLoans: number;
    totalLoanAmount: number;
    totalPaidAmount: number;
    totalRemainingAmount: number;
    activeLoans: number;
    completedLoans: number;
    pendingLoans: number;
    overallProgress: number;
  };
}

export function LoanReportContent({ initialData = [], summary }: LoanReportContentProps) {
  const data: LoanReportRow[] = initialData;

  const handlePrint = () => {
    if (data.length === 0) {
      toast.error("No data to print");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("Please allow popups to print");
      return;
    }

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Loan Report - ${format(new Date(), "MMMM dd, yyyy")}</title>
          <meta charset="UTF-8">
          <style>
            @media print {
              @page { 
                margin: 10mm 15mm;
                size: A4 landscape;
              }
              body { 
                margin: 0;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              padding: 15px;
              font-size: 11px;
              color: #1f2937;
              background: white;
            }
            .header {
              text-align: center;
              margin-bottom: 20px;
              border-bottom: 3px solid #1f2937;
              padding-bottom: 12px;
            }
            .header h1 {
              font-size: 22px;
              margin-bottom: 4px;
              font-weight: 700;
              color: #1f2937;
            }
            .summary {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 15px;
              margin-bottom: 20px;
              padding: 15px;
              background: #f9fafb;
              border-radius: 8px;
            }
            .summary-item {
              text-align: center;
            }
            .summary-label {
              font-size: 10px;
              color: #6b7280;
              text-transform: uppercase;
              margin-bottom: 5px;
            }
            .summary-value {
              font-size: 18px;
              font-weight: 700;
              color: #1f2937;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            thead {
              background: #1f2937;
              color: white;
            }
            th {
              padding: 10px 6px;
              text-align: left;
              font-weight: 600;
              font-size: 10px;
              text-transform: uppercase;
              border: 1px solid #374151;
            }
            td {
              padding: 7px 6px;
              border: 1px solid #e5e7eb;
              font-size: 10px;
            }
            tbody tr:nth-child(even) {
              background: #f9fafb;
            }
            .text-right {
              text-align: right;
            }
            .text-center {
              text-align: center;
            }
            .progress-bar {
              width: 100%;
              height: 8px;
              background: #e5e7eb;
              border-radius: 4px;
              overflow: hidden;
            }
            .progress-fill {
              height: 100%;
              background: #10b981;
              transition: width 0.3s;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Loan Report</h1>
            <p>Generated on ${format(new Date(), "MMMM dd, yyyy 'at' hh:mm a")}</p>
          </div>

          <div class="summary">
            <div class="summary-item">
              <div class="summary-label">Total Loans</div>
              <div class="summary-value">${summary.totalLoans}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Loan Amount</div>
              <div class="summary-value">${new Intl.NumberFormat("en-PK", {
                style: "currency",
                currency: "PKR",
                minimumFractionDigits: 0,
              }).format(summary.totalLoanAmount)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Paid</div>
              <div class="summary-value">${new Intl.NumberFormat("en-PK", {
                style: "currency",
                currency: "PKR",
                minimumFractionDigits: 0,
              }).format(summary.totalPaidAmount)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Remaining</div>
              <div class="summary-value">${new Intl.NumberFormat("en-PK", {
                style: "currency",
                currency: "PKR",
                minimumFractionDigits: 0,
              }).format(summary.totalRemainingAmount)}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Employee</th>
                <th>Department</th>
                <th>Loan Type</th>
                <th class="text-right">Loan Amount</th>
                <th class="text-right">Paid Amount</th>
                <th class="text-right">Remaining</th>
                <th class="text-center">Progress</th>
                <th class="text-center">Installments</th>
                <th class="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              ${data.map((row) => `
                <tr>
                  <td>${row.sNo}</td>
                  <td>
                    <div><strong>${row.empName}</strong></div>
                    <div style="font-size: 9px; color: #6b7280;">${row.empId}</div>
                  </td>
                  <td>${row.department}</td>
                  <td>${row.loanType}</td>
                  <td class="text-right"><strong>${new Intl.NumberFormat("en-PK", {
                    style: "currency",
                    currency: "PKR",
                    minimumFractionDigits: 0,
                  }).format(row.loanAmount)}</strong></td>
                  <td class="text-right" style="color: #10b981;">${new Intl.NumberFormat("en-PK", {
                    style: "currency",
                    currency: "PKR",
                    minimumFractionDigits: 0,
                  }).format(row.paidAmount)}</td>
                  <td class="text-right" style="color: #ef4444;">${new Intl.NumberFormat("en-PK", {
                    style: "currency",
                    currency: "PKR",
                    minimumFractionDigits: 0,
                  }).format(row.remainingAmount)}</td>
                  <td class="text-center">
                    <div style="margin-bottom: 4px;">${row.progressPercentage}%</div>
                    <div class="progress-bar">
                      <div class="progress-fill" style="width: ${row.progressPercentage}%"></div>
                    </div>
                  </td>
                  <td class="text-center">${row.paidInstallments}/${row.totalInstallments}</td>
                  <td class="text-center">${row.status}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const handleExportCSV = () => {
    if (data.length === 0) {
      toast.error("No data to export");
      return;
    }

    const headers = [
      "S.No",
      "Employee ID",
      "Employee Name",
      "Department",
      "Sub Department",
      "Loan Type",
      "Loan Amount",
      "Paid Amount",
      "Remaining Amount",
      "Progress %",
      "Paid Installments",
      "Total Installments",
      "Installment Amount",
      "Status",
      "Repayment Start"
    ];

    const csvRows = [
      headers.join(","),
      ...data.map((row) =>
        [
          row.sNo,
          `"${row.empId}"`,
          `"${row.empName}"`,
          `"${row.department}"`,
          `"${row.subDepartment}"`,
          `"${row.loanType}"`,
          row.loanAmount,
          row.paidAmount,
          row.remainingAmount,
          row.progressPercentage,
          row.paidInstallments,
          row.totalInstallments,
          row.installmentAmount,
          `"${row.status}"`,
          `"${row.repaymentStartMonthYear}"`,
        ].join(",")
      ),
    ];

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `loan-report-${format(new Date(), "yyyy-MM-dd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV exported successfully");
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Loans</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalLoans}</div>
            <p className="text-xs text-muted-foreground">
              {summary.activeLoans} active, {summary.completedLoans} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Loan Amount</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat("en-PK", {
                style: "currency",
                currency: "PKR",
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }).format(summary.totalLoanAmount)}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all loan requests
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Paid</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {new Intl.NumberFormat("en-PK", {
                style: "currency",
                currency: "PKR",
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }).format(summary.totalPaidAmount)}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary.overallProgress}% of total amount
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Remaining</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {new Intl.NumberFormat("en-PK", {
                style: "currency",
                currency: "PKR",
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }).format(summary.totalRemainingAmount)}
            </div>
            <p className="text-xs text-muted-foreground">
              Outstanding balance
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-end gap-2">
        <Button variant="secondary" onClick={handlePrint} size="sm">
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
        <Button variant="secondary" onClick={handleExportCSV} size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Data Table */}
      <div className="w-full max-w-full overflow-x-hidden">
        <DataTable
          columns={reportColumns}
          data={data}
          searchFields={[
            { key: "empName", label: "Employee Name" },
            { key: "empId", label: "Employee ID" },
            { key: "department", label: "Department" },
            { key: "loanType", label: "Loan Type" },
          ]}
          tableId="loan-report-content"
        />
      </div>
    </div>
  );
}
