"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Printer, Search, Wallet, Calendar, User } from "lucide-react";
import { type Allowance } from "@/lib/actions/allowance";
import { type EmployeeDropdownOption } from "@/lib/actions/employee";
import { toast } from "sonner";
import { format } from "date-fns";
import { Label } from "@/components/ui/label";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Autocomplete } from "@/components/ui/autocomplete";

interface AllowancePayslipListProps {
  initialAllowances?: Allowance[];
  employees?: EmployeeDropdownOption[];
}

interface AllowancePayslipData {
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  department?: string;
  designation?: string;
  monthYear: string;
  allowances: Array<{
    allowanceType: string;
    amount: number;
    percentage?: number | null;
    calculationType: string;
  }>;
  totalAmount: number;
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

export function AllowancePayslipList({ initialAllowances = [], employees = [] }: AllowancePayslipListProps) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [monthYear, setMonthYear] = useState<string>("");
  const [showPayslip, setShowPayslip] = useState(false);

  // Get selected employee
  const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId);

  // Generate payslip data
  const payslipData = useMemo(() => {
    if (!showPayslip || !selectedEmployeeId || !monthYear) return null;

    const [year, month] = monthYear.split("-");

    // Filter allowances by employee and month-year
    const filteredAllowances = initialAllowances.filter((allowance) => {
      if (allowance.employeeId !== selectedEmployeeId) {
        return false;
      }

      if (allowance.month !== month || allowance.year !== year) {
        return false;
      }

      return true;
    });

    if (filteredAllowances.length === 0) return null;

    const firstAllowance = filteredAllowances[0];
    const allowanceDetails = filteredAllowances.map((allowance) => ({
      allowanceType: allowance.allowanceHead?.name || allowance.allowanceHeadName || "—",
      amount: Number(allowance.amount),
      percentage: null, // Allowance doesn't store percentage in the same way
      calculationType: allowance.allowanceHead?.calculationType || "Amount",
    }));

    const totalAmount = allowanceDetails.reduce((sum, a) => sum + a.amount, 0);

    return {
      employeeId: firstAllowance.employee?.employeeId || "",
      employeeName: firstAllowance.employee?.employeeName || "",
      employeeCode: firstAllowance.employee?.employeeId || "",
      department: firstAllowance.employee?.department?.name || "",
      designation: "", // Not available in allowance data
      monthYear: formatMonthYear(monthYear),
      allowances: allowanceDetails,
      totalAmount,
    };
  }, [initialAllowances, selectedEmployeeId, monthYear, showPayslip]);

  const handleSearch = () => {
    if (!selectedEmployeeId) {
      toast.error("Please select an employee");
      return;
    }
    if (!monthYear) {
      toast.error("Please select month-year");
      return;
    }
    setShowPayslip(true);
  };

  const handlePrint = () => {
    if (!payslipData) {
      toast.error("No payslip data to print");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("Please allow popups to print");
      return;
    }

    const currentDate = new Date();
    const printDate = format(currentDate, "dd-MMM-yyyy hh:mm:ss a");

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Allowance Payslip - ${payslipData.employeeName}</title>
          <meta charset="UTF-8">
          <style>
            @media print {
              @page {
                margin: 15mm;
                size: A4 portrait;
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
              padding: 20px;
              font-size: 12px;
              color: #1f2937;
              background: white;
            }
            .payslip-container {
              max-width: 800px;
              margin: 0 auto;
              border: 3px solid #1e3a8a;
              padding: 40px;
              background: white;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 35px;
              border-bottom: 4px solid #1e3a8a;
              padding-bottom: 25px;
            }
            .company-name {
              font-size: 28px;
              font-weight: 800;
              color: #1e3a8a;
              margin-bottom: 8px;
              text-transform: uppercase;
              letter-spacing: 2px;
            }
            .payslip-title {
              font-size: 20px;
              font-weight: 700;
              color: #1e3a8a;
              margin-top: 12px;
              letter-spacing: 1px;
            }
            .employee-section {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 30px;
              margin-bottom: 30px;
              padding: 20px;
              background: #f9fafb;
              border-radius: 6px;
            }
            .employee-info {
              display: flex;
              flex-direction: column;
              gap: 8px;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              padding: 5px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .info-label {
              font-weight: 600;
              color: #6b7280;
              font-size: 11px;
              text-transform: uppercase;
            }
            .info-value {
              font-weight: 500;
              color: #1f2937;
              font-size: 12px;
            }
            .allowance-section {
              margin-bottom: 30px;
            }
            .section-title {
              font-size: 16px;
              font-weight: 800;
              color: #1e3a8a;
              margin-bottom: 18px;
              padding-bottom: 10px;
              border-bottom: 3px solid #1e3a8a;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .allowance-table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            .allowance-table th {
              background: #1e3a8a;
              color: white;
              padding: 14px 12px;
              text-align: left;
              font-weight: 700;
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              border: 1px solid #1e3a8a;
            }
            .allowance-table th:first-child {
              width: 60px;
            }
            .allowance-table th:nth-child(2) {
              width: 200px;
            }
            .allowance-table th:nth-child(3) {
              width: 150px;
            }
            .allowance-table td {
              padding: 12px;
              border: 1px solid #e5e7eb;
              font-size: 13px;
              color: #4b5563;
              background: white;
            }
            .allowance-table tbody tr:nth-child(even) td {
              background: #f9fafb;
            }
            .text-right {
              text-align: right;
            }
            .total-row {
              background: #1e3a8a !important;
              color: white !important;
              font-weight: 700;
            }
            .total-row td {
              background: #1e3a8a !important;
              color: white !important;
              border-color: #1e3a8a !important;
              padding: 16px 12px;
              font-size: 14px;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 2px solid #e5e7eb;
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 40px;
            }
            .footer-section {
              text-align: center;
            }
            .footer-label {
              font-size: 11px;
              color: #4b5563;
              margin-bottom: 50px;
              text-transform: uppercase;
              font-weight: 600;
              letter-spacing: 0.5px;
            }
            .footer-line {
              border-top: 2px solid #1e3a8a;
              margin-top: 8px;
              width: 100%;
            }
            .disclaimer {
              margin-top: 30px;
              padding: 15px;
              background: #fef3c7;
              border-left: 4px solid #f59e0b;
              font-size: 10px;
              color: #92400e;
              text-align: center;
            }
            .print-date {
              text-align: right;
              font-size: 10px;
              color: #6b7280;
              margin-bottom: 10px;
            }
          </style>
        </head>
        <body>
          <div class="payslip-container">
            <div class="print-date">Printed On: ${printDate}</div>
            
            <div class="header">
              <div class="company-name">Speed Limit HR System</div>
              <div class="payslip-title">ALLOWANCE PAYSLIP</div>
            </div>

            <div class="employee-section">
              <div class="employee-info">
                <div class="info-row">
                  <span class="info-label">Employee ID:</span>
                  <span class="info-value">${payslipData.employeeCode}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Employee Name:</span>
                  <span class="info-value">${payslipData.employeeName}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Department:</span>
                  <span class="info-value">${payslipData.department || "—"}</span>
                </div>
              </div>
              <div class="employee-info">
                <div class="info-row">
                  <span class="info-label">Allowance Period:</span>
                  <span class="info-value">${payslipData.monthYear}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Payslip Date:</span>
                  <span class="info-value">${format(new Date(), "dd-MMM-yyyy")}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Total Allowances:</span>
                  <span class="info-value">${payslipData.allowances.length}</span>
                </div>
              </div>
            </div>

            <div class="allowance-section">
              <div class="section-title">ALLOWANCE DETAILS</div>
              <table class="allowance-table">
                <thead>
                  <tr>
                    <th>S.NO</th>
                    <th>ALLOWANCE TYPE</th>
                    <th>CALCULATION</th>
                    <th class="text-right">AMOUNT</th>
                  </tr>
                </thead>
                <tbody>
                  ${payslipData.allowances.map((allowance, index) => `
                    <tr>
                      <td>${index + 1}</td>
                      <td>${allowance.allowanceType}</td>
                      <td>${allowance.calculationType === "Percentage" && allowance.percentage
        ? `${allowance.percentage}%`
        : "Fixed Amount"
      }</td>
                      <td class="text-right">Rs ${allowance.amount.toLocaleString("en-PK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}</td>
                    </tr>
                  `).join('')}
                  <tr class="total-row">
                    <td colspan="3" class="text-right"><strong>TOTAL ALLOWANCE</strong></td>
                    <td class="text-right">Rs ${payslipData.totalAmount.toLocaleString("en-PK", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="footer">
              <div class="footer-section">
                <div class="footer-label">Employee Signature</div>
                <div class="footer-line"></div>
              </div>
              <div class="footer-section">
                <div class="footer-label">Authorized Signature</div>
                <div class="footer-line"></div>
              </div>
            </div>

            <div class="disclaimer">
              <strong>Note:</strong> This is a system-generated allowance payslip. Please verify all details. 
              For any discrepancies, please contact the HR department immediately.
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
    }, 300);

    toast.success("Print dialog opened");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Allowance Payslip
          </CardTitle>
          <CardDescription>
            Generate and print allowance payslip for employees
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search Form */}
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Select Employee <span className="text-destructive">*</span>
                </Label>
                <Autocomplete
                  options={[
                    { value: "", label: "Select Employee" },
                    ...employees.map((emp) => ({
                      value: emp.id,
                      label: `${emp.employeeName} (${emp.employeeId})`,
                    })),
                  ]}
                  value={selectedEmployeeId}
                  onValueChange={(value) => {
                    setSelectedEmployeeId(value || "");
                    setShowPayslip(false);
                  }}
                  placeholder="Search and select employee"
                  searchPlaceholder="Search employee..."
                  emptyMessage="No employees found"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Month-Year <span className="text-destructive">*</span>
                </Label>
                <MonthYearPicker
                  value={monthYear}
                  onChange={(value) => {
                    setMonthYear(typeof value === 'string' ? value : value[0] || '');
                    setShowPayslip(false);
                  }}
                  placeholder="Select month and year"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSearch} className="min-w-[120px]">
                <Search className="h-4 w-4 mr-2" />
                Generate Payslip
              </Button>
            </div>
          </div>

          {/* Payslip Display */}
          {showPayslip && payslipData && (
            <div className="mt-8 pt-6 border-t">
              <div className="flex justify-end mb-4">
                <Button onClick={handlePrint} variant="outline">
                  <Printer className="h-4 w-4 mr-2" />
                  Print Payslip
                </Button>
              </div>

              <div className="border-[3px] border-blue-900 rounded-lg p-10 bg-white max-w-4xl mx-auto shadow-lg">
                {/* Header */}
                <div className="text-center mb-10 pb-8 border-b-4 border-blue-900">
                  <div className="text-3xl font-extrabold uppercase tracking-wider text-blue-900 mb-3">
                    Speed Limit HR System
                  </div>
                  <div className="text-xl font-bold text-blue-900 mt-4 tracking-wide">
                    ALLOWANCE PAYSLIP
                  </div>
                </div>

                {/* Employee Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 p-5 bg-gray-50 rounded-lg">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b border-gray-300">
                      <span className="text-xs font-semibold uppercase text-gray-600">Employee ID:</span>
                      <span className="text-sm font-medium text-gray-900">{payslipData.employeeCode}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-gray-300">
                      <span className="text-xs font-semibold uppercase text-gray-600">Employee Name:</span>
                      <span className="text-sm font-medium text-gray-900">{payslipData.employeeName}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-gray-300">
                      <span className="text-xs font-semibold uppercase text-gray-600">Department:</span>
                      <span className="text-sm font-medium text-gray-900">{payslipData.department || "—"}</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b border-gray-300">
                      <span className="text-xs font-semibold uppercase text-gray-600">Allowance Period:</span>
                      <span className="text-sm font-medium text-gray-900">{payslipData.monthYear}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-gray-300">
                      <span className="text-xs font-semibold uppercase text-gray-600">Payslip Date:</span>
                      <span className="text-sm font-medium text-gray-900">{format(new Date(), "dd-MMM-yyyy")}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-gray-300">
                      <span className="text-xs font-semibold uppercase text-gray-600">Total Allowances:</span>
                      <span className="text-sm font-medium text-gray-900">{payslipData.allowances.length}</span>
                    </div>
                  </div>
                </div>

                {/* Allowance Details */}
                <div className="mb-10">
                  <div className="text-base font-extrabold uppercase text-blue-900 mb-5 pb-3 border-b-[3px] border-blue-900 tracking-wide">
                    ALLOWANCE DETAILS
                  </div>
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-blue-900 text-white">
                        <th className="p-4 text-left text-xs font-bold uppercase border border-blue-900 tracking-wide">S.NO</th>
                        <th className="p-4 text-left text-xs font-bold uppercase border border-blue-900 tracking-wide">ALLOWANCE TYPE</th>
                        <th className="p-4 text-left text-xs font-bold uppercase border border-blue-900 tracking-wide">CALCULATION</th>
                        <th className="p-4 text-right text-xs font-bold uppercase border border-blue-900 tracking-wide">AMOUNT</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payslipData.allowances.map((allowance, index) => (
                        <tr key={index} className="border-b border-gray-300">
                          <td className="p-4 text-sm text-gray-700 bg-white">{index + 1}</td>
                          <td className="p-4 text-sm font-medium text-gray-700 bg-white">{allowance.allowanceType}</td>
                          <td className="p-4 text-sm text-gray-700 bg-white">
                            {allowance.calculationType === "Percentage" && allowance.percentage
                              ? `${allowance.percentage}%`
                              : "Fixed Amount"}
                          </td>
                          <td className="p-4 text-sm text-right font-semibold text-gray-700 bg-white">
                            Rs {allowance.amount.toLocaleString("en-PK", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      ))}
                      {payslipData.allowances.length > 0 && payslipData.allowances.length % 2 === 1 && (
                        <tr className="border-b border-gray-300">
                          <td colSpan={4} className="p-4 bg-gray-50"></td>
                        </tr>
                      )}
                      <tr className="bg-blue-900 text-white font-bold">
                        <td colSpan={3} className="p-5 text-right border border-blue-900 text-sm uppercase tracking-wide">TOTAL ALLOWANCE</td>
                        <td className="p-5 text-right border border-blue-900 text-sm">
                          Rs {payslipData.totalAmount.toLocaleString("en-PK", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Footer */}
                <div className="grid grid-cols-2 gap-12 mt-12 pt-8 border-t-2 border-gray-300">
                  <div className="text-center">
                    <div className="text-xs font-bold uppercase text-gray-700 mb-14 tracking-wide">EMPLOYEE SIGNATURE</div>
                    <div className="border-t-2 border-blue-900 w-full"></div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs font-bold uppercase text-gray-700 mb-14 tracking-wide">AUTHORIZED SIGNATURE</div>
                    <div className="border-t-2 border-blue-900 w-full"></div>
                  </div>
                </div>

                {/* Disclaimer */}
                <div className="mt-8 p-4 bg-yellow-50 border-l-4 border-yellow-500">
                  <p className="text-xs text-yellow-900 text-center">
                    <strong>Note:</strong> This is a system-generated allowance payslip. Please verify all details.
                    For any discrepancies, please contact the HR department immediately.
                  </p>
                </div>
              </div>
            </div>
          )}

          {showPayslip && !payslipData && (
            <div className="mt-8 pt-6 border-t">
              <div className="text-center py-12 text-muted-foreground">
                <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No allowance data found</p>
                <p className="text-sm">No allowances found for the selected employee and period</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

