"use client";

import { useState, useEffect, useTransition, startTransition, addTransitionType } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select";
import { PolicyTimeline } from "@/components/ui/policy-timeline";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Play, CheckCircle, Undo, Search } from "lucide-react";
import Link from "next/link";
import {
    getSubDepartmentsByDepartment,
    type Department,
    type SubDepartment,
} from "@/lib/actions/department";
import { previewPayroll, confirmPayroll } from "@/lib/actions/payroll";
import { type EmployeeDropdownOption } from "@/lib/actions/employee";

interface GeneratePayrollClientProps {
    initialDepartments: Department[];
    initialEmployees: EmployeeDropdownOption[];
    currentUserId: string;
}

export function GeneratePayrollClient({
    initialDepartments,
    initialEmployees,
    currentUserId,
}: GeneratePayrollClientProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [departments] = useState<Department[]>(initialDepartments);
    const [employees] = useState<EmployeeDropdownOption[]>(initialEmployees);
    // ...
    const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([]);
    const [loadingSubDepartments, setLoadingSubDepartments] = useState(false);
    const [step, setStep] = useState<"select" | "preview">("select");
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState("");


    const [formData, setFormData] = useState({
        department: "all",
        subDepartment: "all",
        monthYear: new Date().toISOString().split('T')[0],
    });

    const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);

    // Fetch sub-departments when department changes
    useEffect(() => {
        const fetchSubDepartments = async () => {
            if (formData.department && formData.department !== "all") {
                setLoadingSubDepartments(true);
                try {
                    const result = await getSubDepartmentsByDepartment(formData.department);
                    if (result.status && result.data) {
                        setSubDepartments(result.data);
                    } else {
                        setSubDepartments([]);
                    }
                } catch (error) {
                    console.error("Failed to fetch sub-departments:", error);
                    setSubDepartments([]);
                } finally {
                    setLoadingSubDepartments(false);
                }
            } else {
                setSubDepartments([]);
                setFormData((prev) => ({ ...prev, subDepartment: "all" }));
            }
        };

        fetchSubDepartments();
    }, [formData.department]);

    // Filter employees
    const filteredEmployees = employees.filter((emp) => {
        if (formData.department && formData.department !== "all") {
            if (emp.departmentId !== formData.department) return false;
        }
        if (formData.subDepartment && formData.subDepartment !== "all") {
            if (emp.subDepartmentId !== formData.subDepartment) return false;
        }
        return true;
    });

    const handleEmployeeSelectionChange = (selectedIds: string[]) => {
        setSelectedEmployeeIds(selectedIds);
    };

    const employeeOptions: MultiSelectOption[] = filteredEmployees.map((emp) => ({
        value: emp.id,
        label: emp.employeeName,
        description: `${emp.employeeId}${emp.departmentName ? ` • ${emp.departmentName}` : ""}`,
    }));

    const handlePreview = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.monthYear) {
            toast.error("Please select month and year");
            return;
        }

        let idsPayload: string[] | undefined = undefined;
        if (selectedEmployeeIds.length > 0) {
            idsPayload = selectedEmployeeIds;
        } else if (formData.department !== 'all') {
            idsPayload = filteredEmployees.map(e => e.id);
            if (idsPayload.length === 0) {
                toast.error("No employees found in selected department");
                return;
            }
        }

        startTransition(async () => {
            try {
                const [year, month] = formData.monthYear.split("-");
                const result = await previewPayroll({
                    month,
                    year,
                    employeeIds: idsPayload
                });

                if (result.status) {
                    setPreviewData(result.data);
                    setStep("preview");
                    toast.success("Payroll preview generated. Please review and confirm.");
                } else {
                    toast.error(result.message);
                }
            } catch (error) {
                console.error("Error:", error);
                toast.error("Failed to generate preview");
            }
        });
    };

    const handleInputChange = (index: number, field: string, value: string) => {
        const updatedData = [...previewData];
        updatedData[index][field] = parseFloat(value) || 0;

        // Recalculate Gross and Net
        // Simple logic: Gross = Basic + Allowances + Overtime + Bonus
        // Net = Gross - Deductions - Tax - Attendance - Loan - Advance - EOBI - PF
        // Note: Deductions field here is `totalDeductions` which usually means AdHoc deductions.
        // Total Deductions Sum = totalDeductions + tax + attendance + loan + advance + eobi + pf

        const row = updatedData[index];
        // Recalculate bonusAmount from bonusBreakup if it exists, otherwise use the existing value
        const calculatedBonusAmount = row.bonusBreakup && row.bonusBreakup.length > 0
            ? row.bonusBreakup.reduce((sum: number, b: any) => sum + (b.amount || 0), 0)
            : (row.bonusAmount || 0);
        row.bonusAmount = calculatedBonusAmount;
        // Recalculate overtimeAmount from overtimeBreakup if it exists, otherwise use the existing value
        const calculatedOvertimeAmount = row.overtimeBreakup && row.overtimeBreakup.length > 0
            ? row.overtimeBreakup.reduce((sum: number, ot: any) => sum + (ot.amount || 0), 0)
            : (row.overtimeAmount || 0);
        row.overtimeAmount = calculatedOvertimeAmount;
        // Calculate gross salary: Sum of salary breakup components + allowances + overtime + bonus
        const salaryBreakupTotal = row.salaryBreakup && row.salaryBreakup.length > 0
            ? row.salaryBreakup.reduce((sum: number, component: any) => sum + (component.amount || 0), 0)
            : (row.basicSalary || 0);
        row.grossSalary = salaryBreakupTotal + row.totalAllowances + calculatedOvertimeAmount + calculatedBonusAmount;

        const totalDed = row.totalDeductions + row.taxDeduction + row.attendanceDeduction + row.loanDeduction + row.advanceSalaryDeduction + row.eobiDeduction + row.providentFundDeduction;
        row.netSalary = row.grossSalary - totalDed;

        setPreviewData(updatedData);
    };

    const handleConfirm = async () => {
        startTransition(async () => {
            try {
                const [year, month] = formData.monthYear.split("-");
                const result = await confirmPayroll({
                    month,
                    year,
                    generatedBy: currentUserId,
                    details: previewData
                });

                if (result.status) {
                    toast.success(result.message);
                    startTransition(() => {
                        addTransitionType("nav-forward");
                        router.push("/hr/payroll-setup/payroll/report");
                    });
                } else {
                    toast.error(result.message);
                }
            } catch (error) {
                console.error(error);
                toast.error("Failed to confirm payroll");
            }
        });
    };

    return (
        <div className="max-w-6xl mx-auto pb-10">
            <div className="mb-6">
                <Link href="/hr/payroll" transitionTypes={["nav-back"]}>
                    <Button variant="ghost" size="sm">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Payroll
                    </Button>
                </Link>
            </div>

            {step === "select" ? (
                <form onSubmit={handlePreview} className="space-y-6">
                    <Card className="border-0 shadow-lg bg-card">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-2xl font-bold">Generate Payroll</CardTitle>
                            <CardDescription className="text-base">
                                Select month and employees to process
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">

                            {/* Month-Year */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="monthYear">
                                        Month-Year <span className="text-destructive">*</span>
                                    </Label>
                                    <MonthYearPicker
                                        value={formData.monthYear}
                                        onChange={(value) => {
                                            const actualValue = Array.isArray(value) ? (value[0] ?? "") : value;
                                            setFormData((prev) => ({ ...prev, monthYear: actualValue }));
                                        }}
                                        disabled={isPending}
                                        placeholder="Select month and year"
                                    />
                                </div>
                            </div>

                            <div className="border-t pt-4"></div>

                            {/* Filters */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Department */}
                                <div className="space-y-2">
                                    <Label htmlFor="department">Filter by Department</Label>
                                    <Select
                                        value={formData.department}
                                        onValueChange={(val) => setFormData(prev => ({ ...prev, department: val, subDepartment: 'all' }))}
                                        disabled={isPending}
                                    >
                                        <SelectTrigger id="department">
                                            <SelectValue placeholder="Select Department" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Departments</SelectItem>
                                            {departments.map((dept) => (
                                                <SelectItem key={dept.id} value={dept.id}>
                                                    {dept.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Sub Department */}
                                <div className="space-y-2">
                                    <Label htmlFor="subDepartment">Filter by Sub Department</Label>
                                    <Select
                                        value={formData.subDepartment === "all" ? undefined : formData.subDepartment}
                                        onValueChange={(val) => setFormData(prev => ({ ...prev, subDepartment: val }))}
                                        disabled={isPending || formData.department === "all" || loadingSubDepartments}
                                    >
                                        <SelectTrigger id="subDepartment">
                                            <SelectValue placeholder="Select Sub Department" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Sub Departments</SelectItem>
                                            {subDepartments.map((subDept) => (
                                                <SelectItem key={subDept.id} value={subDept.id}>
                                                    {subDept.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            {/* Employee Multi-Select */}
                            <div className="space-y-2">
                                <Label htmlFor="employee">
                                    Select Employees (Optional)
                                </Label>
                                <MultiSelect
                                    options={employeeOptions}
                                    value={selectedEmployeeIds}
                                    onValueChange={handleEmployeeSelectionChange}
                                    placeholder="Select specific employees..."
                                    disabled={isPending}
                                />
                                <p className="text-sm text-muted-foreground">
                                    {selectedEmployeeIds.length > 0
                                        ? `${selectedEmployeeIds.length} employees selected`
                                        : `All ${filteredEmployees.length} employees in filter`}
                                </p>
                            </div>

                            {/* Submit Button */}
                            <div className="flex justify-end pt-4 border-t">
                                <Button type="submit" disabled={isPending} size="lg">
                                    {isPending ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Calculating...
                                        </>
                                    ) : (
                                        <>
                                            <Play className="h-4 w-4 mr-2" />
                                            Preview Payroll
                                        </>
                                    )}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </form>
            ) : (
                <Card className="border-0 shadow-lg bg-card animate-in fade-in zoom-in-95 duration-300">
                    <CardHeader className="sticky top-24 z-20 bg-card flex flex-row items-center justify-between pb-4 border-b shadow-sm">
                        <div>
                            <CardTitle className="text-2xl font-bold">Preview Payroll</CardTitle>
                            <CardDescription>Review and edit payroll details before confirming.</CardDescription>
                        </div>
                        <div className="flex space-x-2">
                            <div className="relative w-64 mr-2">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search employee by name or code..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-8"
                                />
                            </div>
                            <Button variant="outline" onClick={() => setStep("select")} disabled={isPending}>
                                <Undo className="h-4 w-4 mr-2" />
                                Back
                            </Button>
                            <Button onClick={handleConfirm} disabled={isPending}>
                                {isPending ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                )}
                                Confirm Payroll
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="rounded-md border overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[50px]">S.No</TableHead>
                                        <TableHead className="w-[150px]">Employee</TableHead>
                                        <TableHead>Emp Details</TableHead>
                                        <TableHead>Salary/Allowances</TableHead>
                                        <TableHead>Tax</TableHead>
                                        <TableHead>Deductions</TableHead>
                                        <TableHead>Social Security</TableHead>
                                        <TableHead>Net Salary</TableHead>
                                        <TableHead>Account No</TableHead>
                                        <TableHead>Payment Mode</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {previewData
                                        .filter((row) => {
                                            if (!searchQuery) return true;
                                            const query = searchQuery.toLowerCase();
                                            return (
                                                row.employeeName?.toLowerCase().includes(query) ||
                                                row.employeeCode?.toLowerCase().includes(query)
                                            );
                                        })
                                        .map((row, index) => {
                                            const salaryBreakupTotal = row.salaryBreakup && row.salaryBreakup.length > 0
                                                ? row.salaryBreakup.reduce((sum: number, component: any) => sum + (component.amount || 0), 0)
                                                : (row.basicSalary || 0);
                                            const deductionBreakupTotal = (row.deductionBreakup || []).reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0);
                                            const annualTax = (row.taxBreakup?.monthlyTax || 0) * 12;

                                            return (
                                                <TableRow key={row.employeeId}>
                                                    <TableCell>{index + 1}</TableCell>
                                                    <TableCell className="font-medium">
                                                        <div>({row.employeeCode}) {row.employeeName}</div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="text-[10px] space-y-0.5 min-w-[200px]">
                                                            <div className="flex justify-between items-start gap-2">
                                                                <span className="font-bold shrink-0">Country:</span>
                                                                <span className="text-right">{row.employee?.country?.name}</span>
                                                            </div>
                                                            <div className="flex justify-between items-start gap-2">
                                                                <span className="font-bold shrink-0">Province:</span>
                                                                <span className="text-right">{row.employee?.state?.name}</span>
                                                            </div>
                                                            <div className="flex justify-between items-start gap-2">
                                                                <span className="font-bold shrink-0">City:</span>
                                                                <span className="text-right">{row.employee?.city?.name}</span>
                                                            </div>
                                                            <div className="flex justify-between items-start gap-2">
                                                                <span className="font-bold shrink-0">Station:</span>
                                                                <span className="text-right">{row.employee?.branch?.name}</span>
                                                            </div>
                                                            <div className="flex justify-between items-start gap-2">
                                                                <span className="font-bold shrink-0">Dept:</span>
                                                                <span className="text-right">{row.employee?.department?.name}</span>
                                                            </div>
                                                            <div className="flex justify-between items-start gap-2">
                                                                <span className="font-bold shrink-0">Sub-Dept:</span>
                                                                <span className="text-right">{row.employee?.subDepartment?.name || "-"}</span>
                                                            </div>
                                                            <div className="flex justify-between items-start gap-2">
                                                                <span className="font-bold shrink-0">Designation:</span>
                                                                <span className="text-right">{row.employee?.designation?.name}</span>
                                                            </div>
                                                            {row.policyAssignments && row.policyAssignments.length > 0 && (
                                                                <div className="mt-2 pt-2 border-t">
                                                                    <PolicyTimeline
                                                                        assignments={row.policyAssignments}
                                                                        defaultPolicy={row.workingHoursPolicy}
                                                                        monthYear={formData.monthYear}
                                                                    />
                                                                </div>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="text-[10px] space-y-0.5 min-w-[200px]">
                                                            {row.salaryBreakup?.map((b: any) => (
                                                                <div key={b.id} className="flex justify-between items-center gap-2">
                                                                    <span className="font-bold shrink-0">{b.name}:</span>
                                                                    <span className="text-right">{Math.round(Number(b.amount || 0)).toLocaleString()}</span>
                                                                </div>
                                                            ))}
                                                            {row.allowanceBreakup?.map((a: any) => (
                                                                <div key={a.id} className="flex justify-between items-center gap-2">
                                                                    <span className="font-bold shrink-0">{a.name}:</span>
                                                                    <span className="text-right">{Math.round(Number(a.amount || 0)).toLocaleString()}</span>
                                                                </div>
                                                            ))}
                                                            {row.overtimeAmount > 0 && (
                                                                <div className="flex justify-between items-center gap-2">
                                                                    <span className="font-bold shrink-0">Overtime:</span>
                                                                    <span className="text-right">{Math.round(Number(row.overtimeAmount || 0)).toLocaleString()}</span>
                                                                </div>
                                                            )}
                                                            {row.bonusAmount > 0 && (
                                                                <div className="flex justify-between items-center gap-2">
                                                                    <span className="font-bold shrink-0">Bonus:</span>
                                                                    <span className="text-right">{Math.round(Number(row.bonusAmount || 0)).toLocaleString()}</span>
                                                                </div>
                                                            )}
                                                            {row.leaveEncashmentAmount > 0 && (
                                                                <div className="flex justify-between items-center gap-2">
                                                                    <span className="font-bold shrink-0">Leave Encashment:</span>
                                                                    <span className="text-right">{Math.round(Number(row.leaveEncashmentAmount || 0)).toLocaleString()}</span>
                                                                </div>
                                                            )}
                                                            <div className="border-t border-gray-200 mt-1 pt-1 font-bold bg-gray-50 flex justify-between items-center gap-2">
                                                                <span className="shrink-0">Gross:</span>
                                                                <span className="text-right">
                                                                    {Math.round(Number(row.grossSalary || 0)).toLocaleString()}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="text-[10px] space-y-0.5 min-w-[160px]">
                                                            <div className="flex justify-between items-center gap-2">
                                                                <span className="font-bold shrink-0">Taxable:</span>
                                                                <span className="text-right">{Math.round(Number(row.taxBreakup?.taxableIncome || 0)).toLocaleString()}</span>
                                                            </div>
                                                            {row.taxBreakup?.fixedAmountTax > 0 && (
                                                                <div className="flex justify-between items-center gap-2">
                                                                    <span className="font-bold shrink-0">Fixed Tax:</span>
                                                                    <span className="text-right">{Math.round(Number(row.taxBreakup?.fixedAmountTax || 0)).toLocaleString()}</span>
                                                                </div>
                                                            )}
                                                            {row.taxBreakup?.percentageTax > 0 && (
                                                                <div className="flex justify-between items-center gap-2">
                                                                    <span className="font-bold shrink-0">% Tax:</span>
                                                                    <span className="text-right">{Math.round(Number(row.taxBreakup?.percentageTax || 0)).toLocaleString()}</span>
                                                                </div>
                                                            )}
                                                            <div className="flex justify-between items-center gap-2">
                                                                <span className="font-bold shrink-0">Annual Tax:</span>
                                                                <span className="text-right">{Math.round(Number(annualTax || 0)).toLocaleString()}</span>
                                                            </div>
                                                            <div className="flex justify-between items-center gap-2 font-bold border-t pt-1 bg-gray-50">
                                                                <span className="shrink-0">Monthly Tax:</span>
                                                                <span className="text-right">
                                                                    {Math.round(Number(row.taxDeduction || 0)).toLocaleString()}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="text-[10px] space-y-0.5 min-w-[160px]">
                                                            <div className="flex justify-between items-center gap-2">
                                                                <span className="font-bold shrink-0">PF:</span>
                                                                <span className="text-right">{Math.round(Number(row.providentFundDeduction || 0)).toLocaleString()}</span>
                                                            </div>
                                                            <div className="flex justify-between items-center gap-2">
                                                                <span className="font-bold shrink-0">Advance:</span>
                                                                <span className="text-right">{Math.round(Number(row.advanceSalaryDeduction || 0)).toLocaleString()}</span>
                                                            </div>
                                                            <div className="flex justify-between items-center gap-2">
                                                                <span className="font-bold shrink-0">EOBI:</span>
                                                                <span className="text-right">{Math.round(Number(row.eobiDeduction || 0)).toLocaleString()}</span>
                                                            </div>
                                                            <div className="flex justify-between items-center gap-2">
                                                                <span className="font-bold shrink-0">Loan:</span>
                                                                <span className="text-right">{Math.round(Number(row.loanDeduction || 0)).toLocaleString()}</span>
                                                            </div>
                                                            {row.deductionBreakup?.map((d: any) => (
                                                                <div key={d.id} className="flex justify-between items-center gap-2">
                                                                    <span className="font-bold shrink-0">{d.name}:</span>
                                                                    <span className="text-right">{Math.round(Number(d.amount || 0)).toLocaleString()}</span>
                                                                </div>
                                                            ))}
                                                            <div className="flex justify-between items-center gap-2">
                                                                <span className="font-bold shrink-0">Attendance:</span>
                                                                <span className="text-right">{Math.round(Number(row.attendanceDeduction || 0)).toLocaleString()}</span>
                                                            </div>
                                                            <div className="border-t border-gray-200 mt-1 pt-1 font-bold bg-gray-50 flex justify-between items-center gap-2">
                                                                <span className="shrink-0">Total:</span>
                                                                <span className="text-right">
                                                                    {Math.round(
                                                                        Number(row.attendanceDeduction || 0) +
                                                                        Number(row.loanDeduction || 0) +
                                                                        Number(row.advanceSalaryDeduction || 0) +
                                                                        Number(row.eobiDeduction || 0) +
                                                                        Number(row.providentFundDeduction || 0) +
                                                                        Number(row.taxDeduction || 0) +
                                                                        deductionBreakupTotal
                                                                    ).toLocaleString()}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="text-[10px] min-w-[120px]">
                                                            {row.socialSecurityContributionAmount > 0 ? (
                                                                <div className="flex justify-between items-center gap-2">
                                                                    <span className="font-bold shrink-0">Contribution:</span>
                                                                    <span className="text-right">{Math.round(Number(row.socialSecurityContributionAmount || 0)).toLocaleString()}</span>
                                                                </div>
                                                            ) : (
                                                                <span className="text-muted-foreground">-</span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="font-bold text-green-600">
                                                        {Math.round(Number(row.netSalary || 0)).toLocaleString()}
                                                    </TableCell>
                                                    <TableCell>{row.accountNumber || "-"}</TableCell>
                                                    <TableCell>{row.paymentMode || "Bank Transfer"}</TableCell>
                                                </TableRow>
                                            );
                                        })}
                                </TableBody>
                            </Table>
                        </div>
                        <div className="mt-4 flex justify-end">
                            <div className="text-right">
                                <div className="text-sm text-muted-foreground">Total Payout</div>
                                <div className="text-2xl font-bold">
                                    {previewData.reduce((acc, curr) => acc + (curr.netSalary || 0), 0).toLocaleString()}
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
