"use client";

import DataTable from "@/components/common/data-table";
import { getColumns, type LoanRequestRow } from "./columns";
import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useAuth } from "@/components/providers/auth-provider";

interface LoanRequestListContentProps {
  initialData?: LoanRequestRow[];
  canSearch?: boolean;
}

export function LoanRequestListContent({ initialData = [], canSearch = true }: LoanRequestListContentProps) {
  const data: LoanRequestRow[] = initialData;
  const { isAdmin } = useAuth();

  const columns = getColumns(isAdmin());

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

    // Calculate summary statistics
    const totalAmount = data.reduce((sum, row) => sum + row.amount, 0);
    const approvedCount = data.filter(row => row.approvalStatus === 'Approved').length;
    const pendingCount = data.filter(row => row.approvalStatus === 'Pending').length;
    const rejectedCount = data.filter(row => row.approvalStatus === 'Rejected').length;
    const disbursedCount = data.filter(row => row.status === 'Disbursed').length;
    const completedCount = data.filter(row => row.status === 'Completed').length;

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Loan Requests List - ${format(new Date(), "MMMM dd, yyyy")}</title>
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
              thead {
                display: table-header-group;
              }
              tbody {
                display: table-row-group;
              }
              tr {
                page-break-inside: avoid;
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
            .header p {
              font-size: 12px;
              color: #6b7280;
            }
            .info-bar {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 15px;
              padding: 8px 12px;
              background: #f3f4f6;
              border-radius: 4px;
              border: 1px solid #e5e7eb;
            }
            .info-bar span {
              font-weight: 600;
              font-size: 11px;
              color: #374151;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
              background: white;
            }
            thead {
              background: #1f2937;
              color: white;
              position: sticky;
              top: 0;
            }
            th {
              padding: 10px 6px;
              text-align: left;
              font-weight: 600;
              font-size: 10px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              border: 1px solid #374151;
              white-space: nowrap;
            }
            th.text-right {
              text-align: right;
            }
            th.text-center {
              text-align: center;
            }
            td {
              padding: 7px 6px;
              border: 1px solid #e5e7eb;
              font-size: 10px;
              vertical-align: middle;
            }
            tbody tr {
              border-bottom: 1px solid #f3f4f6;
            }
            tbody tr:nth-child(even) {
              background: #f9fafb;
            }
            tbody tr:hover {
              background: #f3f4f6;
            }
            .badge {
              display: inline-block;
              padding: 3px 8px;
              border-radius: 3px;
              font-size: 9px;
              font-weight: 600;
              text-transform: uppercase;
            }
            .badge-approved {
              background: #10b981;
              color: white;
            }
            .badge-pending {
              background: #f59e0b;
              color: white;
            }
            .badge-rejected {
              background: #ef4444;
              color: white;
            }
            .badge-disbursed {
              background: #3b82f6;
              color: white;
            }
            .badge-completed {
              background: #10b981;
              color: white;
            }
            .text-right {
              text-align: right;
            }
            .text-center {
              text-align: center;
            }
            .summary {
              margin-top: 20px;
              padding: 15px;
              background: #f9fafb;
              border-radius: 4px;
              border: 1px solid #e5e7eb;
            }
            .summary h3 {
              font-size: 14px;
              margin-bottom: 10px;
              color: #1f2937;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
              gap: 10px;
            }
            .summary-item {
              padding: 8px;
              background: white;
              border-radius: 3px;
              border: 1px solid #e5e7eb;
            }
            .summary-label {
              font-size: 9px;
              color: #6b7280;
              text-transform: uppercase;
              margin-bottom: 4px;
            }
            .summary-value {
              font-size: 12px;
              font-weight: 700;
              color: #1f2937;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Loan Requests List</h1>
            <p>Generated on ${format(new Date(), "MMMM dd, yyyy 'at' hh:mm a")}</p>
          </div>

          <div class="info-bar">
            <span>Total Records: ${data.length}</span>
            <span>Total Amount: ${new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      minimumFractionDigits: 0,
    }).format(totalAmount)}</span>
          </div>

          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Employee ID</th>
                <th>Employee Name</th>
                <th>Department</th>
                <th>Loan Type</th>
                <th class="text-right">Amount</th>
                <th>Requested Date</th>
                <th>Repayment Start</th>
                <th>Installments</th>
                <th class="text-center">Approval Status</th>
                <th class="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              ${data.map((row, idx) => `
                <tr>
                  <td>${row.sNo}</td>
                  <td>${row.empId}</td>
                  <td>${row.empName}</td>
                  <td>${row.department}</td>
                  <td>${row.loanType}</td>
                  <td class="text-right">${new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      minimumFractionDigits: 0,
    }).format(row.amount)}</td>
                  <td>${row.requestedDate}</td>
                  <td>${row.repaymentStartMonthYear}</td>
                  <td class="text-center">${row.numberOfInstallments}</td>
                  <td class="text-center">
                    <span class="badge badge-${row.approvalStatus.toLowerCase()}">${row.approvalStatus}</span>
                  </td>
                  <td class="text-center">
                    <span class="badge badge-${row.status.toLowerCase()}">${row.status}</span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="summary">
            <h3>Summary Statistics</h3>
            <div class="summary-grid">
              <div class="summary-item">
                <div class="summary-label">Total Requests</div>
                <div class="summary-value">${data.length}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Total Amount</div>
                <div class="summary-value">${new Intl.NumberFormat("en-PK", {
      style: "currency",
      currency: "PKR",
      minimumFractionDigits: 0,
    }).format(totalAmount)}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Approved</div>
                <div class="summary-value">${approvedCount}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Pending</div>
                <div class="summary-value">${pendingCount}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Rejected</div>
                <div class="summary-value">${rejectedCount}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Disbursed</div>
                <div class="summary-value">${disbursedCount}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Completed</div>
                <div class="summary-value">${completedCount}</div>
              </div>
            </div>
          </div>
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
      "Loan Type",
      "Amount",
      "Requested Date",
      "Repayment Start",
      "Installments",
      "Approval Status",
      "Status"
    ];

    const csvRows = [
      headers.join(","),
      ...data.map((row) =>
        [
          row.sNo,
          `"${row.empId}"`,
          `"${row.empName}"`,
          `"${row.department}"`,
          `"${row.loanType}"`,
          row.amount,
          `"${row.requestedDate}"`,
          `"${row.repaymentStartMonthYear}"`,
          row.numberOfInstallments === "—" ? "" : row.numberOfInstallments,
          `"${row.approvalStatus}"`,
          `"${row.status}"`,
        ].join(",")
      ),
    ];

    const csvContent = csvRows.join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `loan-requests-${format(new Date(), "yyyy-MM-dd")}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV exported successfully");
  };

  return (
    <div className="space-y-4">
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
          columns={getColumns(isAdmin())}
          data={data}
          searchFields={canSearch ? [
            { key: "empName", label: "Employee Name" },
            { key: "empId", label: "Employee ID" },
            { key: "department", label: "Department" },
            { key: "loanType", label: "Loan Type" },
          ] : undefined}
          tableId="loan-request-list-content"
        />
      </div>
    </div>
  );
}
