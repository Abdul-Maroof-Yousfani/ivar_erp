"use client";

import { useState } from "react";
import DataTable from "@/components/common/data-table";
import { columns } from "./columns";
import { PFReportItem } from "@/lib/actions/pf-report";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, FileDown } from "lucide-react";
import { toast } from "sonner";

interface PFReportListProps {
    initialData: PFReportItem[];
}

export function PFReportList({ initialData }: PFReportListProps) {
    const [data] = useState<PFReportItem[]>(initialData);

    const handlePrint = () => {
        if (data.length === 0) {
            toast.error("No data to print");
            return;
        }

        const printWindow = window.open("", "_blank");
        if (!printWindow) return;

        const tableRows = data
            .map((item, index) => {
                const department =
                    item.subDepartment && item.subDepartment.length > 0
                        ? `${item.department} - ${item.subDepartment}`
                        : item.department || "";
                const totalPFBalance = Number(item.totalPFBalance || 0).toLocaleString();
                const totalWithdrawal = Number(item.totalWithdrawal || 0).toLocaleString();
                const closingBalance = Number(item.closingBalance || 0).toLocaleString();

                return `
      <tr>
        <td>${index + 1}</td>
        <td>${item.employeeId}</td>
        <td>${item.employeeName}</td>
        <td>${department}</td>
        <td>${item.designation || ""}</td>
        <td class="text-right">${totalPFBalance}</td>
        <td class="text-right">${totalWithdrawal}</td>
        <td class="text-right">${closingBalance}</td>
      </tr>
    `;
            })
            .join("");

        const today = new Date();
        const generatedOn = today.toLocaleString();

        printWindow.document.write(`
      <html>
        <head>
          <title>Employee PF Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; font-size: 11px; color: #111827; }
            h1 { text-align: center; margin-bottom: 4px; font-size: 18px; }
            .subtitle { text-align: center; font-size: 11px; color: #6b7280; margin-bottom: 16px; }
            .meta { font-size: 10px; color: #6b7280; margin-bottom: 12px; display: flex; justify-content: space-between; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; margin-top: 8px; }
            th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; }
            th { background: #f3f4f6; font-weight: 600; }
            .text-right { text-align: right; }
            @media print {
              @page { margin: 15mm; }
            }
          </style>
        </head>
        <body>
          <h1>Employee PF Report</h1>
          <div class="subtitle">Provident Fund balances and withdrawals</div>
          <div class="meta">
            <div>Generated On: ${generatedOn}</div>
            <div>Total Employees: ${data.length}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Emp ID</th>
                <th>Name</th>
                <th>Department</th>
                <th>Designation</th>
                <th>Total PF</th>
                <th>PF Withdrawal</th>
                <th>PF Closing Amount</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </body>
      </html>
    `);

        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    };

    const handleExportCSV = () => {
        const headers = [
            "S.No",
            "Emp ID",
            "Name",
            "Department",
            "Designation",
            "Total PF",
            "PF Withdrawal",
            "PF Closing Amount"
        ];

        const rows = data.map((item, index) => [
            index + 1,
            item.employeeId,
            item.employeeName,
            item.department,
            item.designation,
            item.totalPFBalance,
            item.totalWithdrawal,
            item.closingBalance
        ]);

        const csvContent = [
            headers.join(","),
            ...rows.map(r => r.join(","))
        ].join("\n");

        const blob = new Blob([csvContent], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `pf_report_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success("Report exported successfully");
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between no-print">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">View Employee PF Report</h2>
                    <p className="text-muted-foreground">
                        Detailed report of Provident Fund balances and withdrawals
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="default" onClick={handlePrint} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                        <Printer className="h-4 w-4 mr-2" />
                        Print
                    </Button>
                    <Button variant="default" onClick={handleExportCSV} className="bg-orange-400 hover:bg-orange-500 text-white">
                        <FileDown className="h-4 w-4 mr-2" />
                        Export CSV
                    </Button>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Employee PF Report</CardTitle>
                </CardHeader>
                <CardContent>
                    <DataTable<PFReportItem>
                        columns={columns}
                        data={data}
                        searchFields={[
                            { key: "employeeDetails", label: "Employee" },
                        ]}
                        tableId="pf-report-list"
                    />
                </CardContent>
            </Card>
        </div>
    );
}
