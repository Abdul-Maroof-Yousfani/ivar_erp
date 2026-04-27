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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Search, Plus, Trash2, DollarSign, Percent, Wallet } from "lucide-react";
import Link from "next/link";
import {
  getEmployeesForDropdown,
  getEmployeeById,
  type EmployeeDropdownOption,
  type Employee,
} from "@/lib/actions/employee";
import {
  getSubDepartmentsByDepartment,
  type Department,
  type SubDepartment,
} from "@/lib/actions/department";
import { bulkCreateAllowances, type AllowanceHead } from "@/lib/actions/allowance";
import { Autocomplete } from "@/components/ui/autocomplete";
import { useMemo } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";

interface EmployeeAllowanceItem {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  allowanceHeadId: string;
  allowanceHeadName: string;
  amount: number;
  type: string; // "recurring" | "specific"
  paymentMethod: string; // "with_salary" | "separately"
  notes: string;
  monthYear: string; // Format: "YYYY-MM" - stored for each allowance item
  isTaxable: boolean;
  taxPercentage: number;
}

interface CreateAllowanceClientProps {
  initialDepartments: Department[];
  initialEmployees: EmployeeDropdownOption[];
  initialAllowanceHeads: AllowanceHead[];
}

export function CreateAllowanceClient({
  initialDepartments,
  initialEmployees,
  initialAllowanceHeads,
}: CreateAllowanceClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [departments] = useState<Department[]>(initialDepartments);
  const [employees] = useState<EmployeeDropdownOption[]>(initialEmployees);
  const [allowanceHeads] = useState<AllowanceHead[]>(initialAllowanceHeads);
  const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([]);
  const [loadingSubDepartments, setLoadingSubDepartments] = useState(false);
  const [selectedAllowanceHead, setSelectedAllowanceHead] = useState<AllowanceHead | null>(null);
  const [employeeDetails, setEmployeeDetails] = useState<{ [key: string]: Employee }>({});
  const [incentiveCalculationType, setIncentiveCalculationType] = useState<"Amount" | "Percentage">("Percentage");

  const [formData, setFormData] = useState({
    department: "all",
    subDepartment: "all",
    remarks: "",
    allowanceAmount: "",
    allowancePercentage: "",
    allowanceType: "",
    allowanceTypeCategory: "specific", // "recurring" | "specific"
    monthYear: "" as string | string[], // Can be single string or array for multiple months
    paymentMethod: "with_salary", // "with_salary" | "separately"
    isTaxable: false,
    taxPercentage: "0",
  });

  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [employeeAllowances, setEmployeeAllowances] = useState<EmployeeAllowanceItem[]>([]);

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

  // Fetch employee details when employees are selected
  useEffect(() => {
    const fetchEmployeeDetails = async () => {
      const newEmployeeIds = selectedEmployeeIds.filter(
        (id) => !employeeDetails[id]
      );
      if (newEmployeeIds.length === 0) return;

      for (const empId of newEmployeeIds) {
        try {
          const result = await getEmployeeById(empId);
          if (result.status && result.data) {
            setEmployeeDetails((prev) => ({
              ...prev,
              [empId]: result.data as Employee,
            }));
          }
        } catch (error) {
          console.error(`Failed to fetch employee ${empId}:`, error);
        }
      }
    };

    fetchEmployeeDetails();
  }, [selectedEmployeeIds, employeeDetails]);

  // Update selected allowance head when allowanceType changes
  useEffect(() => {
    if (formData.allowanceType) {
      const allowanceHead = allowanceHeads.find((h) => h.id === formData.allowanceType);
      setSelectedAllowanceHead(allowanceHead || null);

      // Special handling for Incentive - allow user to choose
      if (allowanceHead?.name === "Incentive") {
        // Don't auto-fill, let user choose Amount or Percentage
        setFormData((prev) => ({
          ...prev,
          allowanceAmount: "",
          allowancePercentage: "",
        }));
      } else if (allowanceHead?.calculationType === "Amount") {
        setFormData((prev) => ({
          ...prev,
          allowancePercentage: "",
          allowanceAmount: allowanceHead.amount ? allowanceHead.amount.toString() : "",
        }));
      } else if (allowanceHead?.calculationType === "Percentage") {
        setFormData((prev) => ({
          ...prev,
          allowanceAmount: "",
          allowancePercentage: allowanceHead.percentage ? allowanceHead.percentage.toString() : "",
        }));
      }
    } else {
      setSelectedAllowanceHead(null);
    }
  }, [formData.allowanceType, allowanceHeads]);

  // Allowance head options for Autocomplete
  const allowanceHeadOptions = useMemo(() => {
    return allowanceHeads.map((head) => ({
      value: head.id,
      label: `${head.name} (${head.calculationType === "Amount"
        ? `Fixed: ${head.amount || "N/A"}`
        : `Percentage: ${head.percentage || "N/A"}%`
        })`,
    }));
  }, [allowanceHeads]);

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

  const handleEmployeeSelectionChange = (selectedIds: string[]) => {
    setSelectedEmployeeIds(selectedIds);
    // Remove allowances for employees that are no longer selected
    setEmployeeAllowances(employeeAllowances.filter((item) => selectedIds.includes(item.employeeId)));
  };

  // Prepare employee options for MultiSelect
  const employeeOptions: MultiSelectOption[] = filteredEmployees.map((emp) => ({
    value: emp.id,
    label: emp.employeeName,
    description: `${emp.employeeId}${emp.departmentName ? ` • ${emp.departmentName}` : ""}`,
  }));

  const handleSearch = () => {
    if (!formData.allowanceType) {
      toast.error("Please select an allowance type");
      return;
    }

    if (selectedAllowanceHead) {
      // Special handling for Incentive - user can choose Amount or Percentage
      if (selectedAllowanceHead.name === "Incentive") {
        if (incentiveCalculationType === "Amount" && !formData.allowanceAmount) {
          toast.error("Amount is required for Incentive");
          return;
        }
        if (incentiveCalculationType === "Percentage" && !formData.allowancePercentage) {
          toast.error("Percentage is required for Incentive");
          return;
        }
      } else {
        // For other allowances, use their fixed calculationType
        if (selectedAllowanceHead.calculationType === "Amount" && !formData.allowanceAmount) {
          toast.error("Amount is required for this allowance type");
          return;
        }
        if (selectedAllowanceHead.calculationType === "Percentage" && !formData.allowancePercentage) {
          toast.error("Percentage is required for this allowance type");
          return;
        }
      }
    }

    if (formData.allowanceTypeCategory === "specific") {
      if (Array.isArray(formData.monthYear) && formData.monthYear.length === 0) {
        toast.error("Please select at least one month for specific allowance");
        return;
      } else if (!formData.monthYear) {
        toast.error("Please select month and year for specific allowance");
        return;
      }
    }

    if (selectedEmployeeIds.length === 0) {
      toast.error("Please select at least one employee");
      return;
    }

    if (!selectedAllowanceHead) {
      toast.error("Invalid allowance type selected");
      return;
    }

    // Get selected months - handle both single string and array
    let selectedMonths: string[] = [];
    
    if (formData.allowanceTypeCategory === "specific") {
      selectedMonths = Array.isArray(formData.monthYear)
        ? formData.monthYear
        : formData.monthYear
          ? [formData.monthYear]
          : [];
    } else {
      // For recurring, use current month as default since input is disabled
      // This ensures at least one record is created
      selectedMonths = [new Date().toISOString().slice(0, 7)];
    }

    // Create allowance items for all selected employees and months
    const newAllowances: EmployeeAllowanceItem[] = [];
    selectedEmployeeIds.forEach((empId) => {
      const employee = employees.find((e) => e.id === empId);
      let calculatedAmount = 0;

      // Special handling for Incentive - use user's choice
      if (selectedAllowanceHead?.name === "Incentive") {
        if (incentiveCalculationType === "Amount") {
          calculatedAmount = parseFloat(formData.allowanceAmount || "0");
        } else {
          const percentage = parseFloat(formData.allowancePercentage || "0");
          const emp = employeeDetails[empId];
          if (emp?.employeeSalary) {
            calculatedAmount = (Number(emp.employeeSalary) * percentage) / 100;
          }
        }
      } else if (selectedAllowanceHead?.calculationType === "Amount") {
        calculatedAmount = parseFloat(formData.allowanceAmount || "0");
      } else if (selectedAllowanceHead?.calculationType === "Percentage") {
        const percentage = parseFloat(formData.allowancePercentage || "0");
        const emp = employeeDetails[empId];
        if (emp?.employeeSalary) {
          calculatedAmount = (Number(emp.employeeSalary) * percentage) / 100;
        }
      }

      selectedMonths.forEach((monthYear, monthIndex) => {
        newAllowances.push({
          id: `${empId}-${formData.allowanceType}-${monthYear}-${Date.now()}-${monthIndex}`,
          employeeId: empId,
          employeeName: employee?.employeeName || "",
          employeeCode: employee?.employeeId || "",
          allowanceHeadId: formData.allowanceType,
          allowanceHeadName: selectedAllowanceHead.name,
          amount: calculatedAmount,
          type: formData.allowanceTypeCategory, // "recurring" or "specific"
          paymentMethod: formData.paymentMethod,
          notes: formData.remarks || "",
          monthYear: monthYear, // Store the month-year for this specific allowance
          isTaxable: formData.isTaxable,
          taxPercentage: parseFloat(formData.taxPercentage || "0"),
        });
      });
    });

    // Filter out duplicates (same employee + allowance type + month-year combination)
    const existingIds = new Set(
      employeeAllowances.map((a) => `${a.employeeId}-${a.allowanceHeadId}-${a.monthYear}`)
    );
    const uniqueNewAllowances = newAllowances.filter(
      (a) => !existingIds.has(`${a.employeeId}-${a.allowanceHeadId}-${a.monthYear}`)
    );

    setEmployeeAllowances([...employeeAllowances, ...uniqueNewAllowances]);
    toast.success(`Added allowances for ${uniqueNewAllowances.length} employee-month combination(s)`);
  };

  const handleUpdateAllowance = (id: string, field: keyof EmployeeAllowanceItem, value: any) => {
    setEmployeeAllowances(
      employeeAllowances.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const handleRemoveAllowance = (id: string) => {
    setEmployeeAllowances(employeeAllowances.filter((item) => item.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (employeeAllowances.length === 0) {
      toast.error("Please search and add at least one employee allowance");
      return;
    }

    startTransition(async () => {
      try {
        // Group allowances by month-year to create multiple bulk requests
        const allowancesByMonth = new Map<string, typeof employeeAllowances>();

        employeeAllowances.forEach((item) => {
          const monthYear = item.monthYear || new Date().toISOString().slice(0, 7);
          if (!allowancesByMonth.has(monthYear)) {
            allowancesByMonth.set(monthYear, []);
          }
          allowancesByMonth.get(monthYear)!.push(item);
        });

        // Create allowances for each month-year group
        const results = await Promise.all(
          Array.from(allowancesByMonth.entries()).map(async ([monthYear, allowances]) => {
            const [year, month] = monthYear.split("-");
            return bulkCreateAllowances({
              month: month,
              year: year,
              date: `${monthYear}-01`,
              allowances: allowances.map((item) => ({
                employeeId: item.employeeId,
                allowanceHeadId: item.allowanceHeadId,
                amount: item.amount,
                type: item.type || "specific",
                paymentMethod: item.paymentMethod || "with_salary",
                notes: item.notes || undefined,
                isTaxable: item.isTaxable,
                taxPercentage: item.taxPercentage ? item.taxPercentage : undefined,
              })),
            });
          })
        );

        // Check if all requests succeeded
        const allSuccessful = results.every((result) => result.status);
        if (allSuccessful) {
          const totalCreated = results.reduce((sum, result) => sum + (result.data?.length || 0), 0);
          toast.success(`Successfully created ${totalCreated} allowance(s) for ${allowancesByMonth.size} month(s)`);
          startTransition(() => {
            addTransitionType("nav-back");
            router.push("/hr/payroll-setup/allowance/view");
          });
        } else {
          const failedResult = results.find((result) => !result.status);
          toast.error(failedResult?.message || "Failed to create some allowances");
        }
      } catch (error) {
        console.error("Error:", error);
        toast.error("Failed to create allowances");
      }
    });
  };

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <div className="mb-6">
        <Link href="/hr/payroll-setup/allowance/view" transitionTypes={["nav-back"]}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="border-0 shadow-lg bg-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-bold">Create Allowance Form</CardTitle>
            <CardDescription className="text-base">
              Fill in the details to create an allowance record
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* First Row - 3 columns */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Department */}
              <div className="space-y-2">
                <Label htmlFor="department">Department</Label>
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
                <Label htmlFor="subDepartment">Sub Department</Label>
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

              {/* Employee Multi-Select */}
              <div className="space-y-2">
                <Label htmlFor="employee">
                  Employee <span className="text-destructive">*</span>
                </Label>
                <MultiSelect
                  options={employeeOptions}
                  value={selectedEmployeeIds}
                  onValueChange={handleEmployeeSelectionChange}
                  placeholder="Select employee(s)"
                  searchPlaceholder="Search employees..."
                  emptyMessage="No employees found"
                  disabled={isPending}
                  maxDisplayedItems={2}
                />
              </div>
            </div>

            {/* Second Row - Remarks full width */}
            <div className="space-y-2">
              <Label htmlFor="remarks">Remarks</Label>
              <Textarea
                id="remarks"
                value={formData.remarks}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, remarks: e.target.value }))
                }
                placeholder="Enter remarks"
                disabled={isPending}
              />
            </div>

            {/* Third Row - Allowance Type and Amount/Percentage */}
            <div className={`grid grid-cols-1 gap-4 ${selectedAllowanceHead?.calculationType ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
              {/* Allowance Type */}
              <div className="space-y-2">
                <Label htmlFor="allowanceType">
                  Select Allowance Type: <span className="text-destructive">*</span>
                </Label>
                <Autocomplete
                  options={allowanceHeadOptions}
                  value={formData.allowanceType}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, allowanceType: value }))
                  }
                  placeholder="Select Allowance Type"
                  searchPlaceholder="Search allowance type..."
                  emptyMessage="No allowance types found"
                  disabled={isPending}
                />
              </div>

              {/* Amount or Percentage based on allowance type */}
              {selectedAllowanceHead?.name === "Incentive" ? (
                // Special UI for Incentive - user can choose Amount or Percentage
                <>
                  <div className="space-y-2">
                    <Label>Calculation Type <span className="text-destructive">*</span></Label>
                    <div className="flex items-center h-10 border rounded-md px-3 bg-background">
                      <RadioGroup
                        value={incentiveCalculationType}
                        onValueChange={(value: "Amount" | "Percentage") => {
                          setIncentiveCalculationType(value);
                          setFormData((prev) => ({
                            ...prev,
                            allowanceAmount: value === "Amount" ? prev.allowanceAmount : "",
                            allowancePercentage: value === "Percentage" ? prev.allowancePercentage : "",
                          }));
                        }}
                        disabled={isPending}
                        className="flex gap-6"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Amount" id="incentive-amount" />
                          <Label htmlFor="incentive-amount" className="cursor-pointer font-normal text-sm">
                            Amount
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="Percentage" id="incentive-percentage" />
                          <Label htmlFor="incentive-percentage" className="cursor-pointer font-normal text-sm">
                            Percentage
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>
                  {incentiveCalculationType === "Amount" ? (
                    <div className="space-y-2">
                      <Label htmlFor="allowanceAmount" className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Allowance Amount <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="allowanceAmount"
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.allowanceAmount}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, allowanceAmount: e.target.value }))
                        }
                        placeholder="0.00"
                        disabled={isPending}
                        required
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="allowancePercentage" className="flex items-center gap-2">
                        <Percent className="h-4 w-4" />
                        Allowance Percentage <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="allowancePercentage"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={formData.allowancePercentage}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "" || (parseFloat(val) >= 0 && parseFloat(val) <= 100)) {
                            setFormData((prev) => ({ ...prev, allowancePercentage: val }));
                          }
                        }}
                        placeholder="0.00"
                        disabled={isPending}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        Amount will be calculated based on each employee's salary.
                      </p>
                    </div>
                  )}
                </>
              ) : selectedAllowanceHead?.calculationType === "Amount" ? (
                <div className="space-y-2">
                  <Label htmlFor="allowanceAmount" className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Allowance Amount <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="allowanceAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.allowanceAmount}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, allowanceAmount: e.target.value }))
                    }
                    placeholder={
                      selectedAllowanceHead.amount
                        ? selectedAllowanceHead.amount.toString()
                        : "0.00"
                    }
                    disabled={isPending || !!selectedAllowanceHead.amount}
                    required
                  />
                  {selectedAllowanceHead.amount && (
                    <p className="text-xs text-muted-foreground">
                      Fixed amount: {selectedAllowanceHead.amount} (pre-filled from allowance type)
                    </p>
                  )}
                </div>
              ) : selectedAllowanceHead?.calculationType === "Percentage" ? (
                <div className="space-y-2">
                  <Label htmlFor="allowancePercentage" className="flex items-center gap-2">
                    <Percent className="h-4 w-4" />
                    Allowance Percentage <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="allowancePercentage"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.allowancePercentage}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "" || (parseFloat(val) >= 0 && parseFloat(val) <= 100)) {
                        setFormData((prev) => ({ ...prev, allowancePercentage: val }));
                      }
                    }}
                    placeholder={
                      selectedAllowanceHead.percentage
                        ? selectedAllowanceHead.percentage.toString()
                        : "0.00"
                    }
                    disabled={isPending || !!selectedAllowanceHead.percentage}
                    required
                  />
                  {selectedAllowanceHead.percentage && (
                    <p className="text-xs text-muted-foreground">
                      Fixed percentage: {selectedAllowanceHead.percentage}% (pre-filled from allowance type). Amount will be calculated based on each employee's salary.
                    </p>
                  )}
                </div>
              ) : null}

            </div>

            {/* Fourth Row - Payment Method, Category, Month-Year, and Search */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Payment Method */}
              <div className="space-y-2">
                <Label htmlFor="paymentMethod" className="flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Payment Method <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.paymentMethod}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, paymentMethod: value }))
                  }
                  disabled={isPending}
                >
                  <SelectTrigger id="paymentMethod" className="h-11">
                    <SelectValue placeholder="Select payment method">
                      {formData.paymentMethod === "with_salary" ? (
                        <span className="flex items-center gap-2">
                          <Wallet className="h-4 w-4 text-primary" />
                          Pay with Salary
                        </span>
                      ) : formData.paymentMethod === "separately" ? (
                        <span className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-primary" />
                          Separately
                        </span>
                      ) : (
                        "Select payment method"
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="min-w-[300px]">
                    <SelectItem value="with_salary" className="py-3 cursor-pointer">
                      <div className="flex items-start gap-3 w-full">
                        <Wallet className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <div className="flex flex-col gap-1 flex-1">
                          <span className="font-semibold text-sm">Pay with Salary</span>
                          <span className="text-xs text-muted-foreground leading-relaxed">
                            Allowance will be included in the monthly salary payment
                          </span>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="separately" className="py-3 cursor-pointer">
                      <div className="flex items-start gap-3 w-full">
                        <DollarSign className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <div className="flex flex-col gap-1 flex-1">
                          <span className="font-semibold text-sm">Separately</span>
                          <span className="text-xs text-muted-foreground leading-relaxed">
                            Allowance will be paid as a separate transaction
                          </span>
                        </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* Allowance Type Category (Recurring/Specific) */}
              <div className="space-y-2">
                <Label htmlFor="allowanceTypeCategory">
                  Allowance Category: <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.allowanceTypeCategory}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, allowanceTypeCategory: value }))
                  }
                  disabled={isPending}
                >
                  <SelectTrigger id="allowanceTypeCategory">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="specific">Specific Month</SelectItem>
                    <SelectItem value="recurring">Recurring</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Month-Year */}
              <div className="space-y-2">
                <Label htmlFor="monthYear">
                  Month-Year {formData.allowanceTypeCategory === "specific" && <span className="text-destructive">*</span>}
                </Label>
                <MonthYearPicker
                  value={formData.monthYear}
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, monthYear: value }))
                  }
                  disabled={isPending || formData.allowanceTypeCategory === "recurring"}
                  placeholder={formData.allowanceTypeCategory === "recurring" ? "Not required for recurring" : "Select month(s) and year"}
                  multiple={formData.allowanceTypeCategory === "specific"}
                />
              </div>

              {/* Taxable Allowance */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="isTaxable">Taxable Allowance</Label>
                  <Switch
                    id="isTaxable"
                    checked={formData.isTaxable}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, isTaxable: checked }))
                    }
                    disabled={isPending}
                  />
                </div>
              </div>

              {/* Search Button */}
              <div className="space-y-2">
                <Label>&nbsp;</Label>
                <Button
                  type="button"
                  onClick={handleSearch}
                  disabled={isPending}
                  className="w-full"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </div>
            </div>

            {/* Employee Allowances Table */}
            {employeeAllowances.length > 0 && (
              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle className="text-lg">Employee Allowances</CardTitle>
                  <CardDescription>
                    Review and edit allowances before submitting ({employeeAllowances.length} employee(s))
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Month-Year</TableHead>
                          <TableHead>Allowance Type</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Payment Method</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {employeeAllowances.map((item) => {
                          const formatMonthYear = (monthYear: string) => {
                            if (!monthYear) return "—";
                            const [year, month] = monthYear.split("-");
                            const monthNames = [
                              "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                              "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
                            ];
                            const monthIndex = parseInt(month) - 1;
                            return `${monthNames[monthIndex] || month} ${year}`;
                          };

                          return (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">
                                <div className="flex flex-col">
                                  <span>{item.employeeName}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {item.employeeCode}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm">{formatMonthYear(item.monthYear)}</span>
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={item.allowanceHeadId}
                                  onValueChange={(value) => {
                                    const head = allowanceHeads.find((h) => h.id === value);
                                    handleUpdateAllowance(item.id, "allowanceHeadId", value);
                                    if (head) {
                                      handleUpdateAllowance(item.id, "allowanceHeadName", head.name);
                                    }
                                  }}
                                  disabled={isPending}
                                >
                                  <SelectTrigger className="w-[180px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {allowanceHeads.map((head) => (
                                      <SelectItem key={head.id} value={head.id}>
                                        {head.name}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={item.amount}
                                  onChange={(e) =>
                                    handleUpdateAllowance(
                                      item.id,
                                      "amount",
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  disabled={isPending}
                                  className="w-[120px]"
                                />
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={item.paymentMethod || "with_salary"}
                                  onValueChange={(value) =>
                                    handleUpdateAllowance(item.id, "paymentMethod", value)
                                  }
                                  disabled={isPending}
                                >
                                  <SelectTrigger className="w-[150px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="with_salary">Pay with Salary</SelectItem>
                                    <SelectItem value="separately">Separately</SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={item.notes}
                                  onChange={(e) =>
                                    handleUpdateAllowance(item.id, "notes", e.target.value)
                                  }
                                  placeholder="Notes"
                                  disabled={isPending}
                                  className="w-[200px]"
                                />
                              </TableCell>
                              <TableCell>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveAllowance(item.id)}
                                  disabled={isPending}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Submit Button */}
            <div className="flex justify-end pt-4 border-t">
              <Button type="submit" disabled={isPending || employeeAllowances.length === 0} size="lg">
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Allowances ({employeeAllowances.length})
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
