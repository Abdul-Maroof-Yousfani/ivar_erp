 
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
import { ArrowLeft, Loader2, Search, Plus, Trash2 } from "lucide-react";
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
import { bulkCreateDeductions, type DeductionHead } from "@/lib/actions/deduction";
import { format } from "date-fns";
import { enUS } from "date-fns/locale";

interface EmployeeDeductionItem {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  deductionHeadId: string;
  deductionHeadName: string;
  amount: number;
  notes: string;
  monthYear: string; // Format: "YYYY-MM" - stored for each deduction item
}

interface CreateDeductionClientProps {
  initialDepartments: Department[];
  initialEmployees: EmployeeDropdownOption[];
  initialDeductionHeads: DeductionHead[];
}

export function CreateDeductionClient({
  initialDepartments,
  initialEmployees,
  initialDeductionHeads,
}: CreateDeductionClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [departments] = useState<Department[]>(initialDepartments);
  const [employees] = useState<EmployeeDropdownOption[]>(initialEmployees);
  const [deductionHeads] = useState<DeductionHead[]>(initialDeductionHeads);
  const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([]);
  const [loadingSubDepartments, setLoadingSubDepartments] = useState(false);

  const [formData, setFormData] = useState({
    department: "all",
    subDepartment: "all",
    remarks: "",
    deductionAmount: "",
    deductionType: "",
    monthYear: "" as string | string[], // Can be single string or array for multiple months
  });

  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [employeeDeductions, setEmployeeDeductions] = useState<EmployeeDeductionItem[]>([]);

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

  const handleEmployeeSelectionChange = (selectedIds: string[]) => {
    setSelectedEmployeeIds(selectedIds);
    // Remove deductions for employees that are no longer selected
    setEmployeeDeductions(employeeDeductions.filter((item) => selectedIds.includes(item.employeeId)));
  };

  // Prepare employee options for MultiSelect
  const employeeOptions: MultiSelectOption[] = filteredEmployees.map((emp) => ({
    value: emp.id,
    label: emp.employeeName,
    description: `${emp.employeeId}${emp.departmentName ? ` • ${emp.departmentName}` : ""}`,
  }));

  const handleSearch = () => {
    if (!formData.deductionAmount || !formData.deductionType) {
      toast.error("Please fill all required fields (Deduction Amount, Deduction Type)");
      return;
    }

    if (!formData.monthYear || (Array.isArray(formData.monthYear) && formData.monthYear.length === 0)) {
      toast.error("Please select at least one month");
      return;
    }

    const amount = parseFloat(formData.deductionAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (selectedEmployeeIds.length === 0) {
      toast.error("Please select at least one employee");
      return;
    }

    const selectedDeductionHead = deductionHeads.find((h) => h.id === formData.deductionType);
    if (!selectedDeductionHead) {
      toast.error("Invalid deduction type selected");
      return;
    }

    // Get selected months - handle both single string and array
    const selectedMonths = Array.isArray(formData.monthYear)
      ? formData.monthYear
      : formData.monthYear
        ? [formData.monthYear]
        : [];

    // Create deduction items for all selected employees and months
    const newDeductions: EmployeeDeductionItem[] = [];
    selectedEmployeeIds.forEach((empId) => {
      const employee = employees.find((e) => e.id === empId);
      selectedMonths.forEach((monthYear, monthIndex) => {
        newDeductions.push({
          id: `${empId}-${formData.deductionType}-${monthYear}-${Date.now()}-${monthIndex}`,
          employeeId: empId,
          employeeName: employee?.employeeName || "",
          employeeCode: employee?.employeeId || "",
          deductionHeadId: formData.deductionType,
          deductionHeadName: selectedDeductionHead.name,
          amount: amount,
          notes: formData.remarks || "",
          monthYear: monthYear, // Store the month-year for this specific deduction
        });
      });
    });

    setEmployeeDeductions([...employeeDeductions, ...newDeductions]);
    toast.success(`Added deductions for ${selectedEmployeeIds.length} employee(s) across ${selectedMonths.length} month(s)`);
  };

  const handleUpdateDeduction = (id: string, field: keyof EmployeeDeductionItem, value: any) => {
    setEmployeeDeductions(
      employeeDeductions.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const handleRemoveDeduction = (id: string) => {
    setEmployeeDeductions(employeeDeductions.filter((item) => item.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (employeeDeductions.length === 0) {
      toast.error("Please search and add at least one employee deduction");
      return;
    }

    startTransition(async () => {
      try {
        // Group deductions by month-year to create multiple bulk requests
        const deductionsByMonth = new Map<string, typeof employeeDeductions>();

        employeeDeductions.forEach((item) => {
          const monthYear = item.monthYear || new Date().toISOString().slice(0, 7);
          if (!deductionsByMonth.has(monthYear)) {
            deductionsByMonth.set(monthYear, []);
          }
          deductionsByMonth.get(monthYear)!.push(item);
        });

        // Create deductions for each month-year group
        const results = await Promise.all(
          Array.from(deductionsByMonth.entries()).map(async ([monthYear, deductions]) => {
            const [year, month] = monthYear.split("-");
            return bulkCreateDeductions({
              month: month,
              year: year,
              date: `${monthYear}-01`,
              deductions: deductions.map((item) => ({
                employeeId: item.employeeId,
                deductionHeadId: item.deductionHeadId,
                amount: item.amount,
                notes: item.notes || undefined,
              })),
            });
          })
        );

        // Check if all requests succeeded
        const allSuccessful = results.every((result) => result.status);
        if (allSuccessful) {
          const totalCreated = results.reduce((sum, result) => sum + (result.data?.length || 0), 0);
          toast.success(`Successfully created ${totalCreated} deduction(s) for ${deductionsByMonth.size} month(s)`);
          startTransition(() => {
            addTransitionType("nav-back");
            router.push("/hr/payroll-setup/deduction/view");
          });
        } else {
          const failedResult = results.find((result) => !result.status);
          toast.error(failedResult?.message || "Failed to create some deductions");
        }
      } catch (error) {
        console.error("Error:", error);
        toast.error("Failed to create deductions");
      }
    });
  };

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <div className="mb-6">
        <Link href="/hr/payroll-setup/deduction/view" transitionTypes={["nav-back"]}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="border-0 shadow-lg bg-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-bold">Create Deduction Form</CardTitle>
            <CardDescription className="text-base">
              Fill in the details to create a deduction record
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

            {/* Third Row - 3 columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Deduction Amount */}
              <div className="space-y-2">
                <Label htmlFor="deductionAmount">
                  Deduction Amount: <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="deductionAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.deductionAmount}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, deductionAmount: e.target.value }))
                  }
                  placeholder="0.00"
                  disabled={isPending}
                  required
                />
              </div>

              {/* Deduction Type */}
              <div className="space-y-2">
                <Label htmlFor="deductionType">
                  Select Deduction Type: <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.deductionType}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, deductionType: value }))
                  }
                  disabled={isPending}
                >
                  <SelectTrigger id="deductionType">
                    <SelectValue placeholder="Select Deduction Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {deductionHeads.length > 0 ? (
                      deductionHeads.map((head) => (
                        <SelectItem key={head.id} value={head.id}>
                          {head.name}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-heads" disabled>
                        No deduction types available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Month-Year */}
              <div className="space-y-2">
                <Label htmlFor="monthYear">
                  Month-Year <span className="text-destructive">*</span>
                </Label>
                <MonthYearPicker
                  value={formData.monthYear}
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, monthYear: value }))
                  }
                  disabled={isPending}
                  placeholder="Select month(s) and year"
                  multiple={true}
                />
              </div>
            </div>

            {/* Tax Fields Removed */}

            {/* Search Button */}
            <div className="space-y-2 flex justify-end">
              <Label>&nbsp;</Label>
              <Button
                type="button"
                onClick={handleSearch}
                disabled={isPending}
                className="w-fit self-end"
              >
                <Search className="h-4 w-4 mr-2" />
                Search
              </Button>
            </div>
            {/* Employee Deductions Table */}
            {employeeDeductions.length > 0 && (
              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle className="text-lg">Employee Deductions</CardTitle>
                  <CardDescription>
                    Review and edit deductions before submitting ({employeeDeductions.length} employee(s))
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Deduction Type</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Month-Year</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {employeeDeductions.map((item) => (
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
                              <Select
                                value={item.deductionHeadId}
                                onValueChange={(value) => {
                                  const head = deductionHeads.find((h) => h.id === value);
                                  handleUpdateDeduction(item.id, "deductionHeadId", value);
                                  if (head) {
                                    handleUpdateDeduction(item.id, "deductionHeadName", head.name);
                                  }
                                }}
                                disabled={isPending}
                              >
                                <SelectTrigger className="w-[180px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {deductionHeads.map((head) => (
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
                                  handleUpdateDeduction(
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
                              <div className="text-sm font-medium">
                                {item.monthYear
                                  ? (() => {
                                    const [year, month] = item.monthYear.split("-").map(Number);
                                    return format(new Date(year, month - 1, 1), "MMM yyyy", { locale: enUS });
                                  })()
                                  : "—"}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Input
                                value={item.notes}
                                onChange={(e) =>
                                  handleUpdateDeduction(item.id, "notes", e.target.value)
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
                                onClick={() => handleRemoveDeduction(item.id)}
                                disabled={isPending}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Submit Button */}
            <div className="flex justify-end pt-4 border-t">
              <Button type="submit" disabled={isPending || employeeDeductions.length === 0} size="lg">
                {isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Deductions ({employeeDeductions.length})
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
