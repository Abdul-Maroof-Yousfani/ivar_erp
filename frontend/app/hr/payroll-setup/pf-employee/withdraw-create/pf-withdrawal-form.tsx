"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Autocomplete } from "@/components/ui/autocomplete";
import { toast } from "sonner";
import { Printer, FileDown } from "lucide-react";
import { getDepartments, getSubDepartmentsByDepartment } from "@/lib/actions/department";
import { getEmployeesForDropdown } from "@/lib/actions/employee";
import { createPFWithdrawal } from "@/lib/actions/pf-withdrawal";
import { MonthYearPicker } from "@/components/ui/month-year-picker";

export function PFWithdrawalForm() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [departments, setDepartments] = useState<any[]>([]);
    const [subDepartments, setSubDepartments] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);

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

    // Fetch employees
    useEffect(() => {
        const fetchEmployees = async () => {
            const result = await getEmployeesForDropdown();
            if (result.status && result.data) {
                // Filter employees with PF enabled
                const pfEmployees = result.data.filter((emp: any) => emp.providentFund === true);
                setEmployees(pfEmployees);
            }
        };
        fetchEmployees();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.employeeId || !formData.withdrawalAmount || !formData.monthYear) {
            toast.error("Please fill all required fields");
            return;
        }

        setLoading(true);

        try {
            // Parse month and year from monthYear (format: YYYY-MM)
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
                                    setFormData({ ...formData, subDepartmentId: value })
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
                            <Autocomplete
                                options={employees
                                    .filter((emp: any) =>
                                        !formData.departmentId || emp.departmentId === formData.departmentId
                                    )
                                    .map((emp: any) => ({
                                        value: emp.id,
                                        label: `${emp.employeeId} -- ${emp.employeeName}`,
                                    }))}
                                value={formData.employeeId}
                                onValueChange={(value) =>
                                    setFormData({ ...formData, employeeId: value })
                                }
                                placeholder="Select Employee"
                                searchPlaceholder="Search employee..."
                            />
                        </div>
                    </div>

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
                                required
                            />
                        </div>

                        {/* Month Year */}
                        <div className="space-y-2">
                            <Label htmlFor="monthYear">
                                Month Year <span className="text-destructive">*</span>
                            </Label>
                            <MonthYearPicker
                                value={formData.monthYear}
                                onChange={(value) =>
                                    setFormData({ ...formData, monthYear: value as string })
                                }
                            />
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <Button type="submit" disabled={loading}>
                            {loading ? "Submitting..." : "Submit"}
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </form>
    );
}
