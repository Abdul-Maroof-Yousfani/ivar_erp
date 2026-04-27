"use client";

import { useState, useEffect, useTransition, startTransition, addTransitionType } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { DatePicker } from "@/components/ui/date-picker";
import { Autocomplete } from "@/components/ui/autocomplete";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import {
  getEmployeesForDropdown,
  type EmployeeDropdownOption,
} from "@/lib/actions/employee";
import {
  getSubDepartmentsByDepartment,
  type Department,
  type SubDepartment,
} from "@/lib/actions/department";
import { getLoanTypes, type LoanType } from "@/lib/actions/loan-type";
import { createLoanRequest } from "@/lib/actions/loan-request";

interface CreateLoanRequestClientProps {
  initialDepartments: Department[];
  initialEmployees: EmployeeDropdownOption[];
  initialLoanTypes: LoanType[];
}

export function CreateLoanRequestClient({
  initialDepartments,
  initialEmployees,
  initialLoanTypes,
}: CreateLoanRequestClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [departments] = useState<Department[]>(initialDepartments);
  const [employees] = useState<EmployeeDropdownOption[]>(initialEmployees);
  const [loanTypes] = useState<LoanType[]>(initialLoanTypes);
  const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([]);
  const [loadingSubDepartments, setLoadingSubDepartments] = useState(false);

  const [formData, setFormData] = useState({
    department: "all",
    subDepartment: "all",
    employeeId: "",
    loanTypeId: "",
    loanAmount: "",
    perMonthDeduction: "",
    neededOnMonth: "",
    neededOnYear: "",
    description: "",
  });

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

  // Filter employees based on department and sub-department
  const filteredEmployees = employees.filter((emp) => {
    if (formData.department && formData.department !== "all") {
      if (emp.departmentId !== formData.department) return false;
    }
    if (formData.subDepartment && formData.subDepartment !== "all") {
      if (emp.subDepartmentId !== formData.subDepartment) return false;
    }
    return true;
  });

  const handleDepartmentChange = (departmentId: string) => {
    setFormData((prev) => ({
      ...prev,
      department: departmentId,
      subDepartment: "all",
    }));
  };

  const handleSubDepartmentChange = (subDepartmentId: string) => {
    setFormData((prev) => ({
      ...prev,
      subDepartment: subDepartmentId,
    }));
  };

  // Prepare employee options for Autocomplete
  const employeeOptions = filteredEmployees.map((emp) => ({
    value: emp.id,
    label: `${emp.employeeName} (${emp.employeeId})`,
    description: emp.departmentName || "",
  }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.employeeId) {
      toast.error("Please select an employee");
      return;
    }

    if (!formData.loanTypeId) {
      toast.error("Please select a loan type");
      return;
    }

    if (!formData.loanAmount || parseFloat(formData.loanAmount) <= 0) {
      toast.error("Please enter a valid loan amount");
      return;
    }

    if (!formData.perMonthDeduction || parseFloat(formData.perMonthDeduction) <= 0) {
      toast.error("Please enter a valid per month deduction");
      return;
    }

    if (!formData.neededOnMonth || !formData.neededOnYear) {
      toast.error("Please select needed on month and year");
      return;
    }

    if (!formData.description.trim()) {
      toast.error("Please enter loan description");
      return;
    }

    // Parse date to get month and year
    let neededOnMonth = "";
    let neededOnYear = "";
    try {
      if (!formData.neededOnMonth) {
        toast.error("Please select needed on month and year");
        return;
      }
      const date = new Date(formData.neededOnMonth);
      if (isNaN(date.getTime())) {
        toast.error("Invalid date format");
        return;
      }
      neededOnMonth = (date.getMonth() + 1).toString().padStart(2, "0");
      neededOnYear = date.getFullYear().toString();
    } catch (error) {
      toast.error("Invalid date format");
      return;
    }

    startTransition(async () => {
      try {
        const result = await createLoanRequest({
          employeeId: formData.employeeId,
          loanTypeId: formData.loanTypeId,
          loanAmount: parseFloat(formData.loanAmount),
          perMonthDeduction: parseFloat(formData.perMonthDeduction),
          neededOnMonth,
          neededOnYear,
          description: formData.description.trim(),
        });

        if (result.status) {
          toast.success(result.message || "Loan request created successfully");
          startTransition(() => {
            addTransitionType("nav-back");
            router.push("/hr/payroll-setup/loan-requests/view");
          });
          router.refresh();
        } else {
          toast.error(result.message || "Failed to create loan request");
        }
      } catch (error) {
        console.error("Error:", error);
        toast.error("Failed to create loan request");
      }
    });
  };

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <div className="mb-6">
        <Link href="/hr/payroll-setup/loan-requests/view" transitionTypes={["nav-back"]}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="border-0 shadow-lg bg-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-bold">Create Loan Request Form</CardTitle>
            <CardDescription className="text-base">
              Fill in the details to create a loan request
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* First Row - 3 columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Department */}
              <div className="space-y-2">
                <Label htmlFor="department">
                  Department <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.department}
                  onValueChange={handleDepartmentChange}
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
                <Label htmlFor="subDepartment">
                  Sub Department <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.subDepartment === "all" ? undefined : formData.subDepartment}
                  onValueChange={handleSubDepartmentChange}
                  disabled={
                    isPending ||
                    formData.department === "all" ||
                    !formData.department ||
                    loadingSubDepartments
                  }
                >
                  <SelectTrigger id="subDepartment">
                    <SelectValue
                      placeholder={
                        loadingSubDepartments
                          ? "Loading..."
                          : formData.department === "all" || !formData.department
                          ? "Select department first"
                          : subDepartments.length === 0
                          ? "No sub departments available"
                          : "Select Sub Department"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {subDepartments.length === 0 ? (
                      <SelectItem value="no-subdept" disabled>
                        {formData.department === "all" || !formData.department
                          ? "Select department first"
                          : "No sub departments found"}
                      </SelectItem>
                    ) : (
                      <>
                        <SelectItem value="all">All Sub Departments</SelectItem>
                        {subDepartments.map((subDept) => (
                          <SelectItem key={subDept.id} value={subDept.id}>
                            {subDept.name}
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Employee */}
              <div className="space-y-2">
                <Label htmlFor="employee">
                  Employee <span className="text-destructive">*</span>
                </Label>
                <Autocomplete
                  options={employeeOptions}
                  value={formData.employeeId}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, employeeId: value || "" }))
                  }
                  placeholder="Select employee"
                  searchPlaceholder="Search employees..."
                  emptyMessage="No employees found"
                  disabled={isPending}
                />
              </div>
            </div>

            {/* Second Row - 4 columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Needed on Month & Year */}
              <div className="space-y-2">
                <Label htmlFor="neededOnMonth">
                  Needed on Month & Year <span className="text-destructive">*</span>
                </Label>
                <DatePicker
                  value={formData.neededOnMonth}
                  onChange={(value) => {
                    setFormData((prev) => ({
                      ...prev,
                      neededOnMonth: value || "",
                      neededOnYear: value ? new Date(value).getFullYear().toString() : "",
                    }));
                  }}
                  disabled={isPending}
                  placeholder="mm/dd/yyyy"
                />
              </div>

              {/* Loan Type */}
              <div className="space-y-2">
                <Label htmlFor="loanType">
                  Loan Type <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.loanTypeId}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, loanTypeId: value }))
                  }
                  disabled={isPending}
                >
                  <SelectTrigger id="loanType">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {loanTypes.length > 0 ? (
                      loanTypes.map((loanType) => (
                        <SelectItem key={loanType.id} value={loanType.id}>
                          {loanType.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-types" disabled>
                        No loan types available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Loan Amount */}
              <div className="space-y-2">
                <Label htmlFor="loanAmount">
                  Loan Amount <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="loanAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.loanAmount}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, loanAmount: e.target.value }))
                  }
                  placeholder="Enter loan amount"
                  disabled={isPending}
                  required
                />
              </div>

              {/* Per Month Deduction */}
              <div className="space-y-2">
                <Label htmlFor="perMonthDeduction">
                  Per Month Deduction <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="perMonthDeduction"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.perMonthDeduction}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, perMonthDeduction: e.target.value }))
                  }
                  placeholder="Enter per month deduction"
                  disabled={isPending}
                  required
                />
              </div>
            </div>

            {/* Third Row - Description full width */}
            <div className="space-y-2">
              <Label htmlFor="description">
                Loan Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Enter loan description"
                disabled={isPending}
                rows={4}
                required
              />
            </div>

            {/* Submit Button */}
            <div className="flex justify-end pt-4 border-t">
              <Button type="submit" disabled={isPending} size="lg">
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

