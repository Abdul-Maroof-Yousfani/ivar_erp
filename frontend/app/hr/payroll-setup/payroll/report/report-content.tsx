"use client";

import { useState, useTransition, useMemo } from "react";
import DataTable from "@/components/common/data-table";
import { columns, type PayrollReportRow } from "./columns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import { Printer, Download, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { getPayrollReport } from "@/lib/actions/payroll";
import { Department, SubDepartment, getSubDepartmentsByDepartment } from "@/lib/actions/department";
import { EmployeeDropdownOption } from "@/lib/actions/employee";
import { Autocomplete } from "@/components/ui/autocomplete";
import { useAuth } from "@/components/providers/auth-provider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface ReportContentProps {
    initialDepartments: Department[];
    initialEmployees: EmployeeDropdownOption[];
}

export function ReportContent({ initialDepartments, initialEmployees }: ReportContentProps) {
    const { user, isAdmin, hasPermission } = useAuth();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [data, setData] = useState<PayrollReportRow[]>([]);
    const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([]);
    const [loadingSubDepartments, setLoadingSubDepartments] = useState(false);

    // If user is not admin and doesn't have create permission, redirect or restrict view
    const canViewAll = isAdmin() || hasPermission("payroll.create");

    useEffect(() => {
        // Double protection: If user shouldn't be here, redirect them to Payslips
        if (user && !canViewAll) {
            router.push("/hr/payroll-setup/payroll/payslips");
        }
    }, [user, canViewAll, router]);

    const [filters, setFilters] = useState({
        departmentId: "all",
        subDepartmentId: "all",
        monthYear: format(new Date(), "yyyy-MM"),
        employeeId: "all",
    });

    const filteredEmployees = useMemo(() => {
        let result = initialEmployees;
        
        // Strict filtering for non-privileged users
        if (!canViewAll && user?.employeeId) {
            return result.filter(e => e.id === user.employeeId);
        }

        if (filters.departmentId !== "all") {
            result = result.filter(e => e.departmentId === filters.departmentId);
        }
        if (filters.subDepartmentId !== "all") {
            result = result.filter(e => e.subDepartmentId === filters.subDepartmentId);
        }
        return result;
    }, [filters.departmentId, filters.subDepartmentId, initialEmployees, user, canViewAll]);

    const handleDepartmentChange = async (val: string) => {
        setFilters(prev => ({ ...prev, departmentId: val, subDepartmentId: "all", employeeId: "all" }));
        if (val !== "all") {
            setLoadingSubDepartments(true);
            try {
                const result = await getSubDepartmentsByDepartment(val);
                if (result.status && result.data) {
                    setSubDepartments(result.data);
                }
            } catch (error) {
                console.error(error);
            } finally {
                setLoadingSubDepartments(false);
            }
        } else {
            setSubDepartments([]);
        }
    };

    const handleSearch = () => {
        startTransition(async () => {
            const [year, month] = filters.monthYear.split("-");
            // Enforce employee restriction in search
            const effectiveEmployeeId = !canViewAll && user?.employeeId ? user.employeeId : filters.employeeId;
            
            const result = await getPayrollReport({
                month,
                year,
                departmentId: filters.departmentId,
                subDepartmentId: filters.subDepartmentId,
                employeeId: effectiveEmployeeId,
            });

            if (result.status && result.data) {
                // Double check data filtering on client side
                const filteredData = !canViewAll && user?.employeeId
                    ? result.data.filter(row => row.employee?.id === user.employeeId || row.employeeId === user.employeeId)
                    : result.data;
                
                setData(filteredData);
                if (filteredData.length === 0) {
                    toast.info("No records found for the selected filters.");
                }
            } else {
                toast.error(result.message || "Failed to fetch report");
            }
        });
    };

    const totals = useMemo(() => {
        return data.reduce((acc, curr) => {
            const rowGross = Number(curr.grossSalary || 0);
            const deductionBreakupTotal = (curr.deductionBreakup || []).reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);
            const rowDeductions =
                Number(curr.attendanceDeduction || 0) +
                Number(curr.loanDeduction || 0) +
                Number(curr.advanceSalaryDeduction || 0) +
                Number(curr.eobiDeduction || 0) +
                Number(curr.providentFundDeduction || 0) +
                Number(curr.taxDeduction || 0) +
                deductionBreakupTotal;

            return {
                grossSalary: acc.grossSalary + rowGross,
                netSalary: acc.netSalary + Number(curr.netSalary || 0),
                totalDeductions: acc.totalDeductions + rowDeductions,
                taxDeduction: acc.taxDeduction + Number(curr.taxDeduction || 0),
                socialSecurityContributionAmount: acc.socialSecurityContributionAmount + Number(curr.socialSecurityContributionAmount || 0),
            };
        }, { grossSalary: 0, netSalary: 0, totalDeductions: 0, taxDeduction: 0, socialSecurityContributionAmount: 0 });
    }, [data]);

    const handlePrint = () => {
        if (data.length === 0) {
            toast.error("No data to print");
            return;
        }
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const printContent = `
      <html>
        <head>
          <title>Payroll Report - ${filters.monthYear}</title>
          <style>
            body { font-family: Arial, sans-serif; font-size: 9px; margin: 10px; }
            h1 { text-align: center; font-size: 14px; margin-bottom: 10px; }
            .header-info { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 8px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ccc; padding: 4px; text-align: left; vertical-align: top; font-size: 8px; }
            th { background-color: #4f46e5; color: white; font-weight: bold; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .bg-gray { background-color: #f3f4f6; }
            .bg-green { background-color: #dcfce7; }
            .section-header { background-color: #e5e7eb; font-weight: bold; }
            .breakup-item { display: flex; justify-content: space-between; border-bottom: 1px solid #eee; padding: 2px 0; }
            .breakup-label { font-weight: 500; }
            .breakup-value { text-align: right; }
            .total-row { background-color: #fef3c7; font-weight: bold; }
            .net-salary { color: #16a34a; font-weight: bold; font-size: 10px; }
            .deduction { color: #dc2626; }
            @media print {
              body { margin: 0; }
              @page { size: landscape; margin: 5mm; }
            }
          </style>
        </head>
        <body>
          <div class="header-info">
            <span>${new Date().toLocaleDateString()}</span>
            <span>Payroll Report - ${filters.monthYear}</span>
          </div>
          <h1>Payroll Report - ${filters.monthYear}</h1>
          <table>
            <thead>
              <tr>
                <th style="width: 3%">S.No</th>
                <th style="width: 12%">Employee</th>
                <th style="width: 15%">Emp Details</th>
                <th style="width: 18%">Salary/Allowances</th>
                <th style="width: 12%">Tax</th>
                <th style="width: 15%">Deductions</th>
                <th style="width: 10%">Social Security</th>
                <th style="width: 8%">Net Salary</th>
                <th style="width: 10%">Account No</th>
                <th style="width: 7%">Payment Mode</th>
              </tr>
            </thead>
            <tbody>
              ${data.map((row, i) => {
            const salaryBreakup = row.salaryBreakup || [];
            const allowanceBreakup = row.allowanceBreakup || [];
            const deductionBreakup = row.deductionBreakup || [];
            const deductionBreakupTotal = deductionBreakup.reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);
            const totalGross = Number(row.grossSalary || 0);
            const totalDed = Number(row.attendanceDeduction || 0) +
                Number(row.loanDeduction || 0) + Number(row.advanceSalaryDeduction || 0) +
                Number(row.eobiDeduction || 0) + Number(row.providentFundDeduction || 0) +
                Number(row.taxDeduction || 0) + deductionBreakupTotal;

            return `
                <tr>
                  <td>${i + 1}</td>
                  <td><b>(${row.employee.employeeId}) ${row.employee.employeeName}</b></td>
                  <td>
                    <div><b>Country:</b> ${row.employee.country?.name || '-'}</div>
                    <div><b>Province:</b> ${row.employee.state?.name || '-'}</div>
                    <div><b>City:</b> ${row.employee.city?.name || '-'}</div>
                    <div><b>Station:</b> ${row.employee.branch?.name || '-'}</div>
                    <div><b>Dept:</b> ${row.employee.department?.name || '-'}</div>
                    <div><b>Sub-Dept:</b> ${row.employee.subDepartment?.name || '-'}</div>
                    <div><b>Designation:</b> ${row.employee.designation?.name || '-'}</div>
                  </td>
                  <td>
                    ${salaryBreakup.map((b: any) => `<div class="breakup-item"><span class="breakup-label">${b.name}:</span><span class="breakup-value">${Math.round(Number(b.amount || 0)).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span></div>`).join('')}
                    ${allowanceBreakup.map((a: any) => `<div class="breakup-item"><span class="breakup-label">${a.name}:</span><span class="breakup-value">${Math.round(Number(a.amount || 0)).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span></div>`).join('')}
                    ${Number(row.leaveEncashmentAmount || 0) > 0 ? `<div class="breakup-item"><span class="breakup-label">Leave Encashment:</span><span class="breakup-value">${Math.round(Number(row.leaveEncashmentAmount || 0)).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span></div>` : ''}
                    <div class="total-row" style="margin-top: 4px; border-top: 2px solid #333;"><b>Gross:</b> ${Math.round(totalGross).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                  </td>
                  <td>
                    <div><b>Taxable:</b> ${Math.round(Number(row.taxBreakup?.taxableIncome || 0)).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                    ${row.taxBreakup?.fixedAmountTax > 0 ? `<div><b>Fixed Tax:</b> ${Math.round(Number(row.taxBreakup?.fixedAmountTax || 0)).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>` : ''}
                    ${row.taxBreakup?.percentageTax > 0 ? `<div><b>% Tax:</b> ${Math.round(Number(row.taxBreakup?.percentageTax || 0)).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>` : ''}
                    <div><b>Annual Tax:</b> ${Math.round(Number(row.taxDeduction || 0) * 12).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                    <div class="section-header" style="margin-top: 4px; border-top: 1px solid #999;"><b>Monthly Tax:</b> ${Math.round(Number(row.taxDeduction || 0)).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                  </td>
                  <td>
                    <div><b>PF:</b> ${Math.round(Number(row.providentFundDeduction || 0)).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                    <div><b>Advance:</b> ${Math.round(Number(row.advanceSalaryDeduction || 0)).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                    <div><b>EOBI:</b> ${Math.round(Number(row.eobiDeduction || 0)).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                    <div><b>Loan:</b> ${Math.round(Number(row.loanDeduction || 0)).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                    ${deductionBreakup.map((d: any) => `<div><b>${d.name}:</b> ${Math.round(Number(d.amount || 0)).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>`).join('')}
                    <div><b>Attendance:</b> ${Math.round(Number(row.attendanceDeduction || 0)).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                    <div class="total-row deduction" style="margin-top: 4px; border-top: 1px solid #999;"><b>Total:</b> ${Math.round(totalDed).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                  </td>
                  <td>
                    ${Number(row.socialSecurityContributionAmount || 0) > 0 ? `<div><b>Contribution:</b> ${Math.round(Number(row.socialSecurityContributionAmount || 0)).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>` : '<div>-</div>'}
                  </td>
                  <td class="net-salary">${Math.round(Number(row.netSalary || 0)).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                  <td>${row.accountNumber || '-'}</td>
                  <td>${row.paymentMode || 'Bank Transfer'}</td>
                </tr>
              `}).join('')}
              <tr class="font-bold bg-green">
                <td colspan="3" class="text-right"><b>Grand Total:</b></td>
                <td><b>${Math.round(totals.grossSalary).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</b></td>
                <td><b>${Math.round(totals.taxDeduction).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</b></td>
                <td><b>${Math.round(totals.totalDeductions).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</b></td>
                <td><b>${Math.round(totals.socialSecurityContributionAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</b></td>
                <td class="net-salary"><b>${Math.round(totals.netSalary).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</b></td>
                <td colspan="2"></td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `;
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.print();
    };

    const handleExportCSV = async () => {
        if (data.length === 0) {
            toast.error("No data to export");
            return;
        }

        try {
            toast.info("Fetching all records for export...");

            // Fetch ALL records matching current filters
            const [year, month] = filters.monthYear.split("-");
            const result = await getPayrollReport({
                month,
                year,
                departmentId: filters.departmentId !== "all" ? filters.departmentId : undefined,
                subDepartmentId: filters.subDepartmentId !== "all" ? filters.subDepartmentId : undefined,
                employeeId: filters.employeeId !== "all" ? filters.employeeId : undefined,
            });

            if (!result.status || !result.data || result.data.length === 0) {
                toast.error("No records found to export");
                return;
            }

            const exportData = result.data as PayrollReportRow[];

            // 1. Identify all dynamic columns
            const salaryHeads = new Set<string>();
            const allowanceHeads = new Set<string>();
            const bonusHeads = new Set<string>();
            const deductionHeads = new Set<string>();

            exportData.forEach(row => {
                (row.salaryBreakup || []).forEach(b => salaryHeads.add(b.name));
                (row.allowanceBreakup || []).forEach(a => allowanceHeads.add(a.name));
                (row.bonusBreakup || []).forEach(b => bonusHeads.add(b.name));
                (row.deductionBreakup || []).forEach(d => deductionHeads.add(d.name));
            });

            const sortedSalaryHeads = Array.from(salaryHeads).sort();
            const sortedAllowanceHeads = Array.from(allowanceHeads).sort();
            const sortedBonusHeads = Array.from(bonusHeads).sort();
            const sortedDeductionHeads = Array.from(deductionHeads).sort();

            // 2. Generate Headers
            const staticHeadersPre = [
                "S.No", "Employee ID", "Employee Name", "Department", "Sub-Department", "Designation",
                "Country", "Province", "City", "Station"
            ];

            const staticHeadersPost = [
                "Leave Encashment",
                "Gross Salary",
                "Taxable Income",
                "Tax Deduction",
                "PF Deduction",
                "EOBI Deduction",
                "Loan Deduction",
                "Advance Salary Deduction",
                "Attendance Deduction",
                "Social Security Contribution",
                "Net Salary",
                "Bank Name",
                "Account No",
                "Payment Mode"
            ];

            const headers = [
                ...staticHeadersPre,
                ...sortedSalaryHeads.map(h => `Salary: ${h}`),
                ...sortedAllowanceHeads.map(h => `Allowance: ${h}`),
                ...sortedBonusHeads.map(h => `Bonus: ${h}`),
                ...sortedDeductionHeads.map(h => `Deduction: ${h}`),
                ...staticHeadersPost
            ];

            // 3. Generate Rows
            const rows = exportData.map((row, i) => {
                const emp = row.employee;

                // Helper to get component amount
                const getAmount = (list: any[], name: string) => {
                    const found = list.find(item => item.name === name);
                    return found ? Number(found.amount || 0) : 0;
                };

                const dynamicValues = [
                    ...sortedSalaryHeads.map(h => getAmount(row.salaryBreakup || [], h)),
                    ...sortedAllowanceHeads.map(h => getAmount(row.allowanceBreakup || [], h)),
                    ...sortedBonusHeads.map(h => getAmount(row.bonusBreakup || [], h)),
                    ...sortedDeductionHeads.map(h => getAmount(row.deductionBreakup || [], h))
                ];

                return [
                    i + 1,
                    `"${emp.employeeId}"`,
                    `"${emp.employeeName}"`,
                    `"${emp.department?.name || ""}"`,
                    `"${emp.subDepartment?.name || ""}"`,
                    `"${emp.designation?.name || ""}"`,
                    `"${emp.country?.name || ""}"`,
                    `"${emp.state?.name || ""}"`,
                    `"${emp.city?.name || ""}"`,
                    `"${emp.branch?.name || ""}"`,
                    ...dynamicValues,
                    Number(row.leaveEncashmentAmount || 0),
                    Number(row.grossSalary || 0),
                    Number(row.taxBreakup?.taxableIncome || 0),
                    Number(row.taxDeduction || 0),
                    Number(row.providentFundDeduction || 0),
                    Number(row.eobiDeduction || 0),
                    Number(row.loanDeduction || 0),
                    Number(row.advanceSalaryDeduction || 0),
                    Number(row.attendanceDeduction || 0),
                    Number(row.socialSecurityContributionAmount || 0),
                    Number(row.netSalary || 0),
                    `"${row.bankName || ""}"`,
                    `"${row.accountNumber || ""}"`,
                    `"${row.paymentMode || "Bank Transfer"}"`
                ];
            });

            const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = `payroll-report-${filters.monthYear}-detailed.csv`;
            link.click();

            toast.success(`Exported ${exportData.length} records successfully`);
        } catch (error) {
            console.error("Export error:", error);
            toast.error("Failed to export records");
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>View Payroll Report</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        {canViewAll && (
                            <>
                                <div className="space-y-2">
                                    <Label>Department</Label>
                                    <Autocomplete
                                        options={initialDepartments.map(d => ({ value: d.id, label: d.name }))}
                                        value={filters.departmentId}
                                        onValueChange={handleDepartmentChange}
                                        placeholder="All Departments"
                                        searchPlaceholder="Search department..."
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Sub Department</Label>
                                    <Autocomplete
                                        options={subDepartments.map(d => ({ value: d.id, label: d.name }))}
                                        value={filters.subDepartmentId}
                                        onValueChange={(val) => setFilters(p => ({ ...p, subDepartmentId: val || "all", employeeId: "all" }))}
                                        disabled={filters.departmentId === "all" || loadingSubDepartments}
                                        placeholder="All Sub Departments"
                                        searchPlaceholder="Search sub department..."
                                        isLoading={loadingSubDepartments}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label>Employee</Label>
                                    <Autocomplete
                                        options={filteredEmployees.map(e => ({ value: e.id, label: `(${e.employeeId}) ${e.employeeName}` }))}
                                        value={filters.employeeId}
                                        onValueChange={(val) => setFilters(p => ({ ...p, employeeId: val || "all" }))}
                                        placeholder="All Employees"
                                        searchPlaceholder="Search employee..."
                                    />
                                </div>
                            </>
                        )}

                        <div className="space-y-2">
                            <Label>Month/Year</Label>
                            <MonthYearPicker
                                value={filters.monthYear}
                                onChange={(val) => setFilters(p => ({ ...p, monthYear: Array.isArray(val) ? val[0] : val }))}
                            />
                        </div>

                        <div className="flex items-end gap-2">
                            <Button onClick={handleSearch} disabled={isPending} className="w-full">
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                                Search
                            </Button>
                        </div>
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={handlePrint}>
                            <Printer className="w-4 h-4 mr-2" /> Print
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleExportCSV}>
                            <Download className="w-4 h-4 mr-2" /> Export CSV
                        </Button>
                    </div>

                    <div className="">
                        <DataTable
                            columns={columns}
                            data={data}
                            searchFields={[{ key: "employee.employeeName", label: "Employee Name" }]}
                            tableId="report-content"
                        />
                    </div>

                    {data.length > 0 && (
                        <div className="mt-4 p-4 bg-gray-50 border rounded-md grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <p className="text-sm text-muted-foreground">Total Gross</p>
                                <p className="text-xl font-bold">
                                    {Math.round(totals.grossSalary).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Total Tax</p>
                                <p className="text-xl font-bold text-destructive">
                                    {Math.round(totals.taxDeduction).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Total Deductions</p>
                                <p className="text-xl font-bold text-destructive">
                                    {Math.round(totals.totalDeductions).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Total Net Payout</p>
                                <p className="text-xl font-bold text-green-600">
                                    {Math.round(totals.netSalary).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
