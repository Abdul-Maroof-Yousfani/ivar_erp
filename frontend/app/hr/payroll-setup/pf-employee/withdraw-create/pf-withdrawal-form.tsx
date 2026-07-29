"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Autocomplete } from "@/components/ui/autocomplete";
import { EmployeeSelect } from "@/components/employees/employee-select";
import { toast } from "sonner";
import { Printer, FileDown, Wallet, TrendingDown, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { getDepartments, getSubDepartmentsByDepartment } from "@/lib/actions/department";
import { createPFWithdrawal } from "@/lib/actions/pf-withdrawal";
import { getEmployeePFBalance } from "@/lib/actions/pf-employee";
import { MonthYearPicker } from "@/components/ui/month-year-picker";

const formatPKR = (amount: number) =>
    new Intl.NumberFormat("en-PK", {
        style: "currency",
        currency: "PKR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);

export function PFWithdrawalForm() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [departments, setDepartments] = useState<any[]>([]);
    const [subDepartments, setSubDepartments] = useState<any[]>([]);
    const [balanceLoading, setBalanceLoading] = useState(false);
    const [balance, setBalance] = useState<{
        totalPFBalance: number;
        totalWithdrawn: number;
        availableBalance: number;
    } | null>(null);

    const [formData, setFormData] = useState({
        departmentId: "",
        subDepartmentId: "",
        employeeId: "",
        withdrawalAmount: "",
        monthYear: "",
    });

    // Fetch departments on mount
    useEffect(() => {
        const fetchDepartments = async () => {
            const result = await getDepartments();
            if (result.status && result.data) {
                setDepartments(result.data);
            }
        };
        fetchDepartments();
    }, []);

    // Fetch sub-departments when department changes
    useEffect(() => {
        const fetchSubDepartments = async () => {
            if (formData.departmentId) {
                const result = await getSubDepartmentsByDepartment(formData.departmentId);
                if (result.status && result.data) {
                    setSubDepartments(result.data);
                } else {
                    setSubDepartments([]);
                }
            } else {
                setSubDepartments([]);
            }
        };
        fetchSubDepartments();
    }, [formData.departmentId]);

    // Fetch employee balance when employee changes
    useEffect(() => {
        if (!formData.employeeId) {
            setBalance(null);
            return;
        }
        const fetchBalance = async () => {
            setBalanceLoading(true);
            const result = await getEmployeePFBalance(formData.employeeId);
            if (result.status && result.data) {
                setBalance(result.data);
            } else {
                setBalance(null);
            }
            setBalanceLoading(false);
        };
        fetchBalance();
    }, [formData.employeeId]);

    const requestedAmount = parseFloat(formData.withdrawalAmount) || 0;
    const isOverLimit = balance !== null && requestedAmount > balance.availableBalance;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.employeeId || !formData.withdrawalAmount || !formData.monthYear) {
            toast.error("Please fill all required fields");
            return;
        }

        if (isOverLimit) {
            toast.error(`Amount exceeds available balance of ${formatPKR(balance!.availableBalance)}`);
            return;
        }

        setLoading(true);

        try {
            const [year, month] = formData.monthYear.split("-");

            const result = await createPFWithdrawal({
                employeeId: formData.employeeId,
                withdrawalAmount: parseFloat(formData.withdrawalAmount),
                month,
                year,
            });

            if (result.status) {
                toast.success(result.message || "PF withdrawal created successfully");
                router.push("/hr/payroll-setup/pf-employee/withdraw-view");
            } else {
                toast.error(result.message || "Failed to create PF withdrawal");
            }
        } catch (error) {
            toast.error("An error occurred while creating PF withdrawal");
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>PF Withdrawal Form</CardTitle>
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm">
                            <Printer className="h-4 w-4 mr-2" />
                            Print
                        </Button>
                        <Button type="button" variant="outline" size="sm">
                            <FileDown className="h-4 w-4 mr-2" />
                            Export CSV
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Department */}
                        <div className="space-y-2">
                            <Label htmlFor="department">
                                Department <span className="text-destructive">*</span>
                            </Label>
                            <Autocomplete
                                options={departments.map((dept) => ({
                                    value: dept.id,
                                    label: dept.name,
                                }))}
                                value={formData.departmentId}
                                onValueChange={(value) =>
                                    setFormData({ ...formData, departmentId: value, subDepartmentId: "", employeeId: "" })
                                }
                                placeholder="Select Department"
                                searchPlaceholder="Search department..."
                            />
                        </div>

                        {/* Sub Department */}
                        <div className="space-y-2">
                            <Label htmlFor="subDepartment">
                                Sub Department <span className="text-destructive">*</span>
                            </Label>
                            <Autocomplete
                                options={subDepartments.map((subDept) => ({
                                    value: subDept.id,
                                    label: subDept.name,
                                }))}
                                value={formData.subDepartmentId}
                                onValueChange={(value) =>
                                    setFormData({ ...formData, subDepartmentId: value, employeeId: "" })
                                }
                                placeholder={formData.departmentId ? "Select Sub Department" : "No Record Found"}
                                searchPlaceholder="Search sub department..."
                                disabled={!formData.departmentId}
                            />
                        </div>

                        {/* Employee */}
                        <div className="space-y-2">
                            <Label htmlFor="employee">
                                Employee <span className="text-destructive">*</span>
                            </Label>
                            <EmployeeSelect
                                value={formData.employeeId}
                                onValueChange={(value) =>
                                    setFormData({ ...formData, employeeId: value, withdrawalAmount: "" })
                                }
                                departmentId={formData.departmentId}
                                subDepartmentId={formData.subDepartmentId}
                                providentFundOnly
                                placeholder="Select Employee"
                                searchPlaceholder="Search employee..."
                                emptyMessage="No PF-enabled employees found"
                            />
                        </div>
                    </div>

                    {/* Balance Card */}
                    {formData.employeeId && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {balanceLoading ? (
                                <div className="md:col-span-3 flex items-center gap-2 text-muted-foreground text-sm py-3">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading balance...
                                </div>
                            ) : balance ? (
                                <>
                                    <div className="flex items-center gap-3 rounded-lg border p-4 bg-muted/30">
                                        <Wallet className="h-8 w-8 text-blue-500 shrink-0" />
                                        <div>
                                            <p className="text-xs text-muted-foreground">Total PF Balance</p>
                                            <p className="font-bold text-base">{formatPKR(balance.totalPFBalance)}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 rounded-lg border p-4 bg-red-50 dark:bg-red-950/20">
                                        <TrendingDown className="h-8 w-8 text-red-500 shrink-0" />
                                        <div>
                                            <p className="text-xs text-muted-foreground">Total Withdrawn</p>
                                            <p className="font-bold text-base text-red-600">-{formatPKR(balance.totalWithdrawn)}</p>
                                        </div>
                                    </div>
                                    <div className={`flex items-center gap-3 rounded-lg border p-4 ${balance.availableBalance <= 0 ? "bg-red-50 dark:bg-red-950/20" : "bg-green-50 dark:bg-green-950/20"}`}>
                                        {balance.availableBalance <= 0 ? (
                                            <AlertCircle className="h-8 w-8 text-red-500 shrink-0" />
                                        ) : (
                                            <CheckCircle2 className="h-8 w-8 text-green-500 shrink-0" />
                                        )}
                                        <div>
                                            <p className="text-xs text-muted-foreground">Available Balance</p>
                                            <p className={`font-bold text-base ${balance.availableBalance <= 0 ? "text-red-600" : "text-green-600"}`}>
                                                {formatPKR(balance.availableBalance)}
                                            </p>
                                        </div>
                                    </div>
                                </>
                            ) : null}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Withdrawal Amount */}
                        <div className="space-y-2">
                            <Label htmlFor="withdrawalAmount">
                                Withdrawal Amount <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="withdrawalAmount"
                                type="number"
                                step="0.01"
                                placeholder="Enter amount"
                                value={formData.withdrawalAmount}
                                onChange={(e) =>
                                    setFormData({ ...formData, withdrawalAmount: e.target.value })
                                }
                                className={isOverLimit ? "border-red-500 focus-visible:ring-red-500" : ""}
                            />
                            {isOverLimit && (
                                <p className="text-xs text-red-600 flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" />
                                    Exceeds available balance of {formatPKR(balance!.availableBalance)}
                                </p>
                            )}
                        </div>

                        {/* Month-Year */}
                        <div className="space-y-2">
                            <Label htmlFor="monthYear">
                                Month-Year <span className="text-destructive">*</span>
                            </Label>
                            <MonthYearPicker
                                value={formData.monthYear}
                                onChange={(value) =>
                                    setFormData({
                                        ...formData,
                                        monthYear: Array.isArray(value) ? value[0] || "" : value,
                                    })
                                }
                                placeholder="Select month and year"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-4">
                        <Button type="submit" disabled={loading || isOverLimit || (balance !== null && balance.availableBalance <= 0)}>
                            {loading ? "Submitting..." : "Submit"}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </form>
    );
}
