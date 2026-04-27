"use client";

import DataTable from "@/components/common/data-table";
import { columns, type AdvanceSalaryRow } from "./columns";
import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";

interface AdvanceSalaryListProps {
  initialData?: AdvanceSalaryRow[];
}

export function AdvanceSalaryList({ initialData = [] }: AdvanceSalaryListProps) {
  const data: AdvanceSalaryRow[] = initialData;
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("hr.advance-salary.create");
  
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
    const totalAmount = data.reduce((sum, row) => sum + row.amountNeeded, 0);
    const approvedCount = data.filter(row => row.approval1 === 'Approved').length;
    const pendingCount = data.filter(row => row.approval1 === 'Pending').length;
    const rejectedCount = data.filter(row => row.approval1 === 'Rejected').length;
    const activeCount = data.filter(row => row.status === 'Active').length;
    const completedCount = data.filter(row => row.status === 'Completed').length;

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Advance Salary List - ${format(new Date(), "MMMM dd, yyyy")}</title>
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
            .text-right {
              text-align: right;
            }
            .text-center {
              text-align: center;
            }
            .badge {
              display: inline-block;
              padding: 3px 8px;
              border-radius: 3px;
              font-size: 9px;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.3px;
            }
            .badge-approved {
              background: #10b981;
              color: white;
            }
            .badge-pending {
              background: #6b7280;
              color: white;
            }
            .badge-rejected {
              background: #ef4444;
              color: white;
            }
            .badge-active {
              background: #10b981;
              color: white;
            }
            .badge-completed {
              background: #3b82f6;
              color: white;
            }
            .badge-cancelled {
              background: #ef4444;
              color: white;
            }
            .footer {
              margin-top: 25px;
              padding-top: 12px;
              border-top: 2px solid #e5e7eb;
              text-align: center;
              font-size: 9px;
              color: #6b7280;
            }
            .summary {
              margin-top: 20px;
              padding: 12px;
              background: #f9fafb;
              border-radius: 4px;
              border: 1px solid #e5e7eb;
            }
            .summary h3 {
              font-size: 13px;
              margin-bottom: 12px;
              color: #1f2937;
              font-weight: 600;
              border-bottom: 1px solid #e5e7eb;
              padding-bottom: 6px;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: repeat(6, 1fr);
              gap: 12px;
            }
            .summary-item {
              text-align: center;
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
              font-weight: 500;
            }
            .summary-value {
              font-size: 14px;
              font-weight: 700;
              color: #1f2937;
            }
            .amount-value {
              font-size: 12px;
            }
            @media print {
              .summary-item {
                break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Advance Salary Request List</h1>
            <p>Generated on ${format(new Date(), "MMMM dd, yyyy 'at' hh:mm a")}</p>
          </div>

          <div class="info-bar">
            <span>Total Records: ${data.length}</span>
            <span>Report Date: ${format(new Date(), "dd-MMM-yyyy")}</span>
          </div>

          <table>
            <thead>
              <tr>
                <th style="width: 40px;">S.No</th>
                <th style="width: 90px;">EMP ID</th>
                <th style="width: 160px;">Employee Name</th>
                <th style="width: 110px;" class="text-right">Amount Needed</th>
                <th style="width: 110px;">Salary Need On</th>
                <th style="width: 130px;">Deduction Month/Year</th>
                <th style="width: 90px;" class="text-center">Approval</th>
                <th style="width: 90px;" class="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              ${data.map((row) => `
                <tr>
                  <td class="text-center">${row.sNo}</td>
                  <td>${row.empId}</td>
                  <td>${row.empName}</td>
                  <td class="text-right">${new Intl.NumberFormat("en-PK", {
                    style: "currency",
                    currency: "PKR",
                    minimumFractionDigits: 0,
                  }).format(row.amountNeeded)}</td>
                  <td>${row.salaryNeedOn}</td>
                  <td>${row.deductionMonthYear}</td>
                  <td class="text-center">
                    <span class="badge badge-${row.approval1 === 'Approved' ? 'approved' : row.approval1 === 'Pending' ? 'pending' : 'rejected'}">
                      ${row.approval1}
                    </span>
                  </td>
                  <td class="text-center">
                    <span class="badge badge-${row.status === 'Active' ? 'active' : row.status === 'Completed' ? 'completed' : row.status === 'Cancelled' ? 'cancelled' : 'pending'}">
                      ${row.status}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="summary">
            <h3>Summary Statistics</h3>
            <div class="summary-grid">
              <div class="summary-item">
                <div class="summary-label">Total Records</div>
                <div class="summary-value">${data.length}</div>
              </div>
              <div class="summary-item">
                <div class="summary-label">Total Amount</div>
                <div class="summary-value amount-value">${new Intl.NumberFormat("en-PK", {
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
                <div class="summary-label">Active</div>
                <div class="summary-value">${activeCount}</div>
              </div>
            </div>
          </div>

          <div class="footer">
            <p><strong>This is a system-generated document. Confidential and for internal use only.</strong></p>
            <p>Generated by Speed Limit HR System | ${format(new Date(), "dd MMMM yyyy 'at' hh:mm a")}</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    
    // Wait for content to load, then print
    setTimeout(() => {
      printWindow.print();
    }, 300);
    
    toast.success("Print dialog opened");
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
      "Amount Needed",
      "Salary Need On",
      "Deduction Month/year",
      "Approval 1",
      "Status",
    ];

    const rows = data.map((row) => [
      row.sNo,
      row.empId,
      row.empName,
      row.amountNeeded.toString(),
      row.salaryNeedOn,
      row.deductionMonthYear,
      row.approval1,
      row.status,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `advance_salary_list_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    toast.success("Data exported successfully");
  };

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            View Advance Salary List
          </h2>
          <p className="text-muted-foreground">
            View advance salary requests
          </p>
        </div>
        <div className="flex gap-2">
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
          ]}
          actionText={canCreate ? "Create Advance Salary" : undefined}
          toggleAction={canCreate ? () => router.push("/hr/payroll-setup/advance-salary/create") : undefined}
          tableId="advance-salary-list"
        />
      </div>
    </div>
  );
}

