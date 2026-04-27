"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, Download, Building2, Search, Calendar } from "lucide-react";
import { type Allowance } from "@/lib/actions/allowance";
import { type Bank } from "@/lib/actions/bank";
import { toast } from "sonner";
import { format } from "date-fns";
import { Label } from "@/components/ui/label";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BankReportListProps {
  initialAllowances?: Allowance[];
  banks?: Bank[];
}

interface BankReportRow {
  sNo: number;
  employeeId: string;
  employeeName: string;
  accountNumber: string;
  accountTitle: string;
  allowanceAmount: number;
}

const formatMonthYear = (monthYear: string) => {
  if (!monthYear) return "—";
  const [year, month] = monthYear.split("-");
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const monthIndex = parseInt(month) - 1;
  return `${monthNames[monthIndex] || month} ${year}`;
};

export function BankReportList({ initialAllowances = [], banks = [] }: BankReportListProps) {
  const [monthYear, setMonthYear] = useState<string>("");
  const [chequeDate, setChequeDate] = useState<string>("");
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  const [showReport, setShowReport] = useState(false);

  // Get selected bank (ignore "all" value)
  const selectedBank = selectedBankId && selectedBankId !== "all" ? banks.find((b) => b.id === selectedBankId) : undefined;

  // Generate report data
  const reportData = useMemo(() => {
    if (!showReport || !monthYear) return [];

    const [year, month] = monthYear.split("-");

    // Filter allowances by month and year only (no bank restriction)
    const filteredAllowances = initialAllowances.filter((allowance) => {
      // Month-Year filter
      if (allowance.month !== month || allowance.year !== year) {
        return false;
      }

      // Skip if employee data is incomplete
      if (!allowance.employee?.employeeId || !allowance.employee?.employeeName) {
        return false;
      }

      return true;
    });

    // Group by employee and sum allowances
    const employeeMap = new Map<string, BankReportRow>();

    filteredAllowances.forEach((allowance) => {
      const employeeId = allowance.employeeId;

      if (!employeeMap.has(employeeId)) {
        employeeMap.set(employeeId, {
          sNo: employeeMap.size + 1,
          employeeId: allowance.employee?.employeeId || "",
          employeeName: allowance.employee?.employeeName || "",
          accountNumber: allowance.employee?.accountNumber || "",
          accountTitle: allowance.employee?.accountTitle || "",
          allowanceAmount: 0,
        });
      }

      const row = employeeMap.get(employeeId)!;
      row.allowanceAmount += Number(allowance.amount);
    });

    // Sort by employee ID
    return Array.from(employeeMap.values()).sort((a, b) =>
      a.employeeId.localeCompare(b.employeeId)
    );
  }, [initialAllowances, monthYear, showReport]);

  const totalAmount = reportData.reduce((sum, row) => sum + row.allowanceAmount, 0);

  const handleSearch = () => {
    if (!monthYear) {
      toast.error("Please select month-year");
      return;
    }
    if (!chequeDate) {
      toast.error("Please select cheque date");
      return;
    }

    setShowReport(true);
  };

  const handlePrint = () => {
    if (reportData.length === 0) {
      toast.error("No data to print");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("Please allow popups to print");
      return;
    }

    const currentDate = new Date();
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const printDay = dayNames[currentDate.getDay()];
    const printDate = format(currentDate, "dd-MMM-yyyy hh:mm:ss a");
    const formattedChequeDate = chequeDate ? format(new Date(chequeDate), "dd-MMM-yyyy") : "";

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bank Allowance Transfer Report - ${format(new Date(), "MMMM dd, yyyy")}</title>
          <meta charset="UTF-8">
          <style>
            @media print {
              @page {
                margin: 10mm 15mm;
                size: A4 portrait;
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
              margin-bottom: 20px;
              border-bottom: 3px solid #1f2937;
              padding-bottom: 12px;
            }
            .header-top {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 15px;
            }
            .header-info {
              font-size: 10px;
              color: #6b7280;
              text-decoration: underline;
            }
            .header-title {
              text-align: center;
              margin-top: 10px;
            }
            .header-title h1 {
              font-size: 24px;
              font-weight: 700;
              color: #4b5563;
              margin: 0;
              letter-spacing: 1px;
            }
            .header-details {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 12px;
              margin-top: 15px;
              padding: 10px;
              background: #f9fafb;
              border-radius: 4px;
            }
            .detail-item {
              display: flex;
              justify-content: space-between;
            }
            .detail-label {
              font-weight: 600;
              color: #6b7280;
            }
            .detail-value {
              color: #1f2937;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            thead {
              background: #374151;
              color: white;
            }
            th {
              padding: 10px 8px;
              text-align: left;
              font-weight: 600;
              font-size: 10px;
              text-transform: uppercase;
              border: 1px solid #374151;
            }
            td {
              padding: 7px 8px;
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
            .total-row {
              background: #1f2937 !important;
              color: white;
              font-weight: 700;
            }
            .total-row td {
              border-color: #374151 !important;
            }
            .footer {
              margin-top: 30px;
              padding-top: 15px;
              border-top: 2px solid #e5e7eb;
              text-align: center;
              font-size: 9px;
              color: #6b7280;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-top">
              <div class="header-info">Printed On Date : ${printDate}</div>
              <div class="header-info">Printed On Day : ${printDay}</div>
            </div>
            <div class="header-title">
              <h1>Bank Allowance Transfer Report</h1>
            </div>
            <div class="header-details">
              <div class="detail-item">
                <span class="detail-label">Bank Name:</span>
                <span class="detail-value">${selectedBank?.name || "—"}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Bank Code:</span>
                <span class="detail-value">${selectedBank?.code || "—"}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Month-Year:</span>
                <span class="detail-value">${formatMonthYear(monthYear)}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Cheque Date:</span>
                <span class="detail-value">${formattedChequeDate}</span>
              </div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>S.No</th>
                <th>Employee ID</th>
                <th>Employee Name</th>
                <th>Account Number</th>
                <th>Account Title</th>
                <th class="text-right">Allowance Amount</th>
              </tr>
            </thead>
            <tbody>
              ${reportData.map((row) => `
                <tr>
                  <td>${row.sNo}</td>
                  <td>${row.employeeId}</td>
                  <td>${row.employeeName}</td>
                  <td>${row.accountNumber}</td>
                  <td>${row.accountTitle}</td>
                  <td class="text-right">${new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(row.allowanceAmount)}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="5" class="text-right">Total</td>
                <td class="text-right">${new Intl.NumberFormat("en-PK", { style: "currency", currency: "PKR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalAmount)}</td>
              </tr>
            </tbody>
          </table>

          <div class="footer">
            <p><strong>This is a system-generated document for bank transfer. Please credit the above amounts to the respective accounts.</strong></p>
            <p>Generated by Speed Limit HR System | ${format(new Date(), "dd MMMM yyyy 'at' hh:mm a")}</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
    }, 300);

    toast.success("Print dialog opened");
  };

  const handleExportCSV = () => {
    if (reportData.length === 0) {
      toast.error("No data to export");
      return;
    }

    const headers = [
      "S.No",
      "Employee ID",
      "Employee Name",
      "Account Number",
      "Account Title",
      "Allowance Amount",
    ];

    const rows = reportData.map((row) => [
      row.sNo,
      row.employeeId,
      row.employeeName,
      row.accountNumber,
      row.accountTitle,
      row.allowanceAmount.toString(),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `bank_allowance_transfer_${selectedBank?.name?.replace(/\s+/g, "_")}_${monthYear}_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    toast.success("Data exported successfully");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Bank Allowance Transfer Report
          </CardTitle>
          <CardDescription>
            Generate bank transfer report for allowance payments
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search Form */}
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Month-Year
                </Label>
                <MonthYearPicker
                  value={monthYear}
                  onChange={(value) => setMonthYear(typeof value === 'string' ? value : value[0] || '')}
                  placeholder="Select month and year"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Cheque Date
                </Label>
                <DatePicker
                  value={chequeDate}
                  onChange={(value) => setChequeDate(typeof value === 'string' ? value : value || '')}
                  placeholder="Select cheque date"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Select Bank (Optional)
                </Label>
                <Select value={selectedBankId || undefined} onValueChange={(value) => setSelectedBankId(value || "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select bank (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Banks</SelectItem>
                    {banks.map((bank) => (
                      <SelectItem key={bank.id} value={bank.id}>
                        {bank.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSearch} className="min-w-[120px]">
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>
          </div>

          {/* Report Display */}
          {showReport && reportData.length > 0 && (
            <>
              <div className="mt-8 pt-6 border-t">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-lg font-semibold">Report Details</h3>
                    <p className="text-sm text-muted-foreground">
                      Bank: <strong>{selectedBank?.name}</strong> | Month-Year: {formatMonthYear(monthYear)} | Cheque Date: {chequeDate ? format(new Date(chequeDate), "dd-MMM-yyyy") : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Showing {reportData.length} employee(s)
                      {selectedBank && ` | Selected Bank: ${selectedBank.name}`}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handlePrint} variant="outline">
                      <Printer className="h-4 w-4 mr-2" />
                      Print
                    </Button>
                    <Button onClick={handleExportCSV} variant="outline">
                      <Download className="h-4 w-4 mr-2" />
                      Export CSV
                    </Button>
                  </div>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="p-3 text-left text-sm font-semibold">S.No</th>
                        <th className="p-3 text-left text-sm font-semibold">Employee ID</th>
                        <th className="p-3 text-left text-sm font-semibold">Employee Name</th>
                        <th className="p-3 text-left text-sm font-semibold">Account Number</th>
                        <th className="p-3 text-left text-sm font-semibold">Account Title</th>
                        <th className="p-3 text-right text-sm font-semibold">Allowance Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.map((row) => (
                        <tr key={row.employeeId} className="border-b hover:bg-muted/50">
                          <td className="p-3">{row.sNo}</td>
                          <td className="p-3 font-medium">{row.employeeId}</td>
                          <td className="p-3">{row.employeeName}</td>
                          <td className="p-3 font-mono">{row.accountNumber}</td>
                          <td className="p-3">{row.accountTitle}</td>
                          <td className="p-3 text-right font-semibold">
                            {new Intl.NumberFormat("en-PK", {
                              style: "currency",
                              currency: "PKR",
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            }).format(row.allowanceAmount)}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-muted font-bold">
                        <td colSpan={5} className="p-3 text-right">Total</td>
                        <td className="p-3 text-right">
                          {new Intl.NumberFormat("en-PK", {
                            style: "currency",
                            currency: "PKR",
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          }).format(totalAmount)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {showReport && reportData.length === 0 && (
            <div className="mt-8 pt-6 border-t">
              <div className="text-center py-12 text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No data found</p>
                <p className="text-sm">No allowances found for the selected criteria</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

