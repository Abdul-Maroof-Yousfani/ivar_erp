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
import { DatePicker } from "@/components/ui/date-picker";
import { MultiSelect, type MultiSelectOption } from "@/components/ui/multi-select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Search, Plus, Trash2 } from "lucide-react";
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
import { getEmployeeGrades, type EmployeeGrade } from "@/lib/actions/employee-grade";
import { getDesignations, type Designation } from "@/lib/actions/designation";
import { bulkCreateIncrements, updateIncrement, type Increment } from "@/lib/actions/increment";

interface EmployeeIncrementItem {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  previousDesignation?: string;
  previousSalary?: number;
  employeeGradeId: string;
  designationId: string;
  incrementType: "Increment" | "Decrement";
  incrementAmount?: number;
  incrementPercentage?: number;
  incrementMethod: "Amount" | "Percent";
  salary: number;
  promotionDate: string;
  currentMonth: string;
  monthsOfIncrement: number;
  notes: string;
}

interface CreateIncrementClientProps {
  initialDepartments: Department[];
  initialEmployees: EmployeeDropdownOption[];
  initialEmployeeGrades: EmployeeGrade[];
  initialDesignations: Designation[];
  editMode?: boolean;
  viewMode?: boolean;
  initialIncrement?: Increment;
}

export function CreateIncrementClient({
  initialDepartments,
  initialEmployees,
  initialEmployeeGrades,
  initialDesignations,
  editMode = false,
  viewMode = false,
  initialIncrement,
}: CreateIncrementClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [departments] = useState<Department[]>(initialDepartments);
  const [employees] = useState<EmployeeDropdownOption[]>(initialEmployees);
  const [employeeGrades] = useState<EmployeeGrade[]>(initialEmployeeGrades);
  const [designations] = useState<Designation[]>(initialDesignations);
  const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([]);
  const [loadingSubDepartments, setLoadingSubDepartments] = useState(false);

  const [formData, setFormData] = useState({
    department: "all",
    subDepartment: "all",
    remarks: "",
    incrementType: "Increment" as "Increment" | "Decrement",
    incrementMethod: "Amount" as "Amount" | "Percent",
    incrementAmount: "",
    incrementPercentage: "",
    promotionDate: "",
    currentMonth: "",
    monthsOfIncrement: "",
  });

  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [employeeIncrements, setEmployeeIncrements] = useState<EmployeeIncrementItem[]>([]);
  const [selectedEmployeeDetails, setSelectedEmployeeDetails] = useState<Record<string, Employee>>({});
  const [loadingEmployeeDetails, setLoadingEmployeeDetails] = useState<Record<string, boolean>>({});

  // Calculate salary based on increment/decrement
  const calculateSalary = (
    baseSalary: number,
    incrementType: "Increment" | "Decrement",
    incrementMethod: "Amount" | "Percent",
    incrementValue: number
  ): number => {
    if (!baseSalary || baseSalary <= 0) return 0;
    if (!incrementValue || incrementValue <= 0) return baseSalary;

    if (incrementMethod === "Amount") {
      return incrementType === "Increment"
        ? baseSalary + incrementValue
        : baseSalary - incrementValue;
    } else {
      // Percent
      const percentage = incrementValue / 100;
      return incrementType === "Increment"
        ? baseSalary + baseSalary * percentage
        : baseSalary - baseSalary * percentage;
    }
  };


  // Populate form when initialIncrement is provided (edit/view mode)
  useEffect(() => {
    if (initialIncrement) {
      setFormData({
        department: initialIncrement.department || "all",
        subDepartment: initialIncrement.subDepartment || "all",
        remarks: initialIncrement.notes || "",
        incrementType: initialIncrement.incrementType,
        incrementMethod: initialIncrement.incrementMethod,
        incrementAmount: initialIncrement.incrementAmount?.toString() || "",
        incrementPercentage: initialIncrement.incrementPercentage?.toString() || "",
        promotionDate: initialIncrement.promotionDate || "",
        currentMonth: initialIncrement.currentMonth || "",
        monthsOfIncrement: initialIncrement.monthsOfIncrement?.toString() || "",
      });
      
      // Set selected employee
      setSelectedEmployeeIds([initialIncrement.employeeId]);
      
      // Create increment item for table
      const incrementItem: EmployeeIncrementItem = {
        id: initialIncrement.id,
        employeeId: initialIncrement.employeeId,
        employeeName: initialIncrement.employeeName || "",
        employeeCode: initialIncrement.employeeCode || initialIncrement.employeeId,
        employeeGradeId: initialIncrement.employeeGradeId || "",
        designationId: initialIncrement.designationId || "",
        incrementType: initialIncrement.incrementType,
        incrementAmount: initialIncrement.incrementAmount,
        incrementPercentage: initialIncrement.incrementPercentage,
        incrementMethod: initialIncrement.incrementMethod,
        salary: initialIncrement.salary,
        promotionDate: initialIncrement.promotionDate,
        currentMonth: initialIncrement.currentMonth,
        monthsOfIncrement: initialIncrement.monthsOfIncrement,
        notes: initialIncrement.notes || "",
      };
      setEmployeeIncrements([incrementItem]);
      
      // Fetch employee details and calculate previous salary
      if (initialIncrement.employeeId) {
        setLoadingEmployeeDetails({ [initialIncrement.employeeId]: true });
        getEmployeeById(initialIncrement.employeeId).then(result => {
          if (result.status && result.data) {
            setSelectedEmployeeDetails({ [initialIncrement.employeeId]: result.data });
            
            // Calculate previous salary from current salary and increment
            const currentSalary = initialIncrement.salary;
            const incrementValue = initialIncrement.incrementMethod === "Amount"
              ? (initialIncrement.incrementAmount || 0)
              : (initialIncrement.incrementPercentage || 0);
            
            let previousSalary = currentSalary;
            if (incrementValue > 0) {
              if (initialIncrement.incrementMethod === "Amount") {
                // Reverse calculate: current = previous + increment, so previous = current - increment
                previousSalary = initialIncrement.incrementType === "Increment"
                  ? currentSalary - incrementValue
                  : currentSalary + incrementValue;
              } else {
                // Reverse calculate percentage
                const percentage = incrementValue / 100;
                if (initialIncrement.incrementType === "Increment") {
                  // current = previous * (1 + percentage), so previous = current / (1 + percentage)
                  previousSalary = currentSalary / (1 + percentage);
                } else {
                  // current = previous * (1 - percentage), so previous = current / (1 - percentage)
                  previousSalary = currentSalary / (1 - percentage);
                }
              }
            } else {
              // Use employee's current salary as fallback
              previousSalary = result.data.employeeSalary ? Number(result.data.employeeSalary) : currentSalary;
            }
            
            // Update increment item with previous salary
            setEmployeeIncrements((prev) =>
              prev.map((i) =>
                i.id === incrementItem.id ? { ...i, previousSalary } : i
              )
            );
          }
          setLoadingEmployeeDetails({ [initialIncrement.employeeId]: false });
        }).catch(() => {
          setLoadingEmployeeDetails({ [initialIncrement.employeeId]: false });
        });
      }
    }
  }, [initialIncrement]);

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

  const handleEmployeeSelectionChange = async (selectedIds: string[]) => {
    setSelectedEmployeeIds(selectedIds);
    // Remove increments for employees that are no longer selected
    setEmployeeIncrements(employeeIncrements.filter((item) => selectedIds.includes(item.employeeId)));
    
    // Fetch employee details for newly selected employees
    const newIds = selectedIds.filter(id => !selectedEmployeeDetails[id]);
    if (newIds.length > 0) {
      newIds.forEach(empId => {
        setLoadingEmployeeDetails(prev => ({ ...prev, [empId]: true }));
        getEmployeeById(empId).then(result => {
          if (result.status && result.data) {
            setSelectedEmployeeDetails(prev => ({ ...prev, [empId]: result.data! }));
          }
          setLoadingEmployeeDetails(prev => ({ ...prev, [empId]: false }));
        }).catch(() => {
          setLoadingEmployeeDetails(prev => ({ ...prev, [empId]: false }));
        });
      });
    }
    
    // Remove details for deselected employees
    const removedIds = Object.keys(selectedEmployeeDetails).filter(id => !selectedIds.includes(id));
    if (removedIds.length > 0) {
      setSelectedEmployeeDetails(prev => {
        const updated = { ...prev };
        removedIds.forEach(id => delete updated[id]);
        return updated;
      });
    }
  };

  // Prepare employee options for MultiSelect
  const employeeOptions: MultiSelectOption[] = filteredEmployees.map((emp) => ({
    value: emp.id,
    label: emp.employeeName,
    description: `${emp.employeeId}${emp.departmentName ? ` • ${emp.departmentName}` : ""}`,
  }));

  const handleSearch = () => {
    if (
      !formData.incrementType ||
      (!formData.incrementAmount && !formData.incrementPercentage) ||
      !formData.promotionDate ||
      !formData.currentMonth ||
      !formData.monthsOfIncrement
    ) {
      toast.error("Please fill all required fields");
      return;
    }

    const incrementValue = formData.incrementMethod === "Amount" 
      ? parseFloat(formData.incrementAmount) 
      : parseFloat(formData.incrementPercentage);
    
    if (isNaN(incrementValue) || incrementValue <= 0) {
      toast.error("Please enter a valid increment/decrement value");
      return;
    }

    // Validate percentage doesn't exceed 100
    if (formData.incrementMethod === "Percent" && incrementValue > 100) {
      toast.error("Percentage cannot exceed 100%");
      return;
    }

    const monthsOfIncrement = parseInt(formData.monthsOfIncrement);
    if (isNaN(monthsOfIncrement) || monthsOfIncrement <= 0) {
      toast.error("Please enter a valid number of months");
      return;
    }

    if (selectedEmployeeIds.length === 0) {
      toast.error("Please select at least one employee");
      return;
    }

    // Create increment items for all selected employees
    const newIncrements: EmployeeIncrementItem[] = selectedEmployeeIds.map((empId) => {
      const employee = employees.find((e) => e.id === empId);
      const employeeDetail = selectedEmployeeDetails[empId];
      
      // Get previous designation
      const getPreviousDesignation = () => {
        if (!employeeDetail) return "";
        const designation = (employeeDetail as any).designationRelation || (employeeDetail as any).designation;
        return (designation && typeof designation === 'object' && designation.name) ? designation.name : "";
      };
      
      // Get employee's current grade ID
      const getEmployeeGradeId = () => {
        if (!employeeDetail) return "";
        const grade = (employeeDetail as any).employeeGradeRelation || (employeeDetail as any).employeeGrade;
        if (grade && typeof grade === 'object' && grade.id) {
          return grade.id;
        }
        // Fallback to string if it's directly an ID
        if (typeof employeeDetail.employeeGrade === 'string') {
          return employeeDetail.employeeGrade;
        }
        return "";
      };
      
      // Get employee's current designation ID
      const getDesignationId = () => {
        if (!employeeDetail) return "";
        const designation = (employeeDetail as any).designationRelation || (employeeDetail as any).designation;
        if (designation && typeof designation === 'object' && designation.id) {
          return designation.id;
        }
        // Fallback to string if it's directly an ID
        if (typeof employeeDetail.designation === 'string') {
          return employeeDetail.designation;
        }
        return "";
      };
      
      // Calculate salary for this specific employee
      const baseSalary = employeeDetail?.employeeSalary ? Number(employeeDetail.employeeSalary) : 0;
      const calculatedSalary = baseSalary > 0 && incrementValue > 0
        ? calculateSalary(baseSalary, formData.incrementType, formData.incrementMethod, incrementValue)
        : baseSalary; // Use base salary if calculation fails
      
      return {
        id: `${empId}-${Date.now()}`,
        employeeId: empId,
        employeeName: employee?.employeeName || "",
        employeeCode: employee?.employeeId || "",
        previousDesignation: getPreviousDesignation(),
        previousSalary: baseSalary,
        employeeGradeId: getEmployeeGradeId(), // Pre-populate with employee's current grade
        designationId: getDesignationId(), // Pre-populate with employee's current designation
        incrementType: formData.incrementType,
        incrementAmount: formData.incrementMethod === "Amount" ? incrementValue : undefined,
        incrementPercentage: formData.incrementMethod === "Percent" ? incrementValue : undefined,
        incrementMethod: formData.incrementMethod,
        salary: calculatedSalary,
        promotionDate: formData.promotionDate,
        currentMonth: formData.currentMonth,
        monthsOfIncrement: monthsOfIncrement,
        notes: formData.remarks || "",
      };
    });

    setEmployeeIncrements([...employeeIncrements, ...newIncrements]);
    toast.success(`Added increments for ${selectedEmployeeIds.length} employee(s)`);
  };

  const handleUpdateIncrement = (id: string, field: keyof EmployeeIncrementItem, value: any) => {
    setEmployeeIncrements((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const handleRemoveIncrement = (id: string) => {
    setEmployeeIncrements(employeeIncrements.filter((item) => item.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (employeeIncrements.length === 0) {
      toast.error("Please search and add at least one employee increment");
      return;
    }

    // Validate that all increments have grade and designation
    const invalidIncrements = employeeIncrements.filter(
      (item) => !item.employeeGradeId || !item.designationId
    );
    if (invalidIncrements.length > 0) {
      toast.error("Please set Employee Grade and Designation for all employees in the table");
      return;
    }

    startTransition(async () => {
      try {
        if (editMode && initialIncrement) {
          // Update single increment
          const item = employeeIncrements[0];
          const result = await updateIncrement(initialIncrement.id, {
            employeeGradeId: item.employeeGradeId,
            designationId: item.designationId,
            incrementType: item.incrementType,
            incrementAmount: item.incrementAmount,
            incrementPercentage: item.incrementPercentage,
            incrementMethod: item.incrementMethod,
            salary: item.salary,
            promotionDate: item.promotionDate,
            currentMonth: item.currentMonth,
            monthsOfIncrement: item.monthsOfIncrement,
            notes: item.notes || undefined,
          });

          if (result.status) {
            toast.success(result.message || "Increment updated successfully");
            startTransition(() => {
              addTransitionType("nav-back");
              router.push("/hr/payroll-setup/increment/view");
            });
            router.refresh();
          } else {
            toast.error(result.message || "Failed to update increment");
          }
        } else {
          // Create increments
          const result = await bulkCreateIncrements({
            increments: employeeIncrements.map((item) => ({
              employeeId: item.employeeId,
              employeeGradeId: item.employeeGradeId,
              designationId: item.designationId,
              incrementType: item.incrementType,
              incrementAmount: item.incrementAmount,
              incrementPercentage: item.incrementPercentage,
              incrementMethod: item.incrementMethod,
              salary: item.salary,
              promotionDate: item.promotionDate,
              currentMonth: item.currentMonth,
              monthsOfIncrement: item.monthsOfIncrement,
              notes: item.notes || undefined,
            })),
          });

          if (result.status) {
            toast.success(result.message || "Increments created successfully");
            startTransition(() => {
              addTransitionType("nav-back");
              router.push("/hr/payroll-setup/increment/view");
            });
            router.refresh();
          } else {
            toast.error(result.message || "Failed to create increments");
          }
        }
      } catch (error) {
        console.error("Error:", error);
        toast.error(editMode ? "Failed to update increment" : "Failed to create increments");
      }
    });
  };

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <div className="mb-6">
        <Link href="/hr/payroll-setup/increment/view" transitionTypes={["nav-back"]}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card className="border-0 shadow-lg bg-card">
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl font-bold">
              {viewMode ? "View Employee Promotion" : editMode ? "Edit Employee Promotion" : "Create Employee Promotion Form"}
            </CardTitle>
            <CardDescription className="text-base">
              {viewMode 
                ? "View increment/promotion record details"
                : editMode 
                ? "Update the increment/promotion record details"
                : "Fill in the details to create an increment/promotion record"}
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
                  disabled={isPending || viewMode}
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
                  disabled={isPending || viewMode || editMode}
                  maxDisplayedItems={2}
                />
              </div>
            </div>

            {/* Previous Designation & Salary Table */}
            {selectedEmployeeIds.length > 0 && (
              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle className="text-lg">Previous Designation & Salary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Designation</TableHead>
                          <TableHead>Salary</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {selectedEmployeeIds.map((empId) => {
                          const employee = employees.find((e) => e.id === empId);
                          const employeeDetail = selectedEmployeeDetails[empId];
                          const isLoading = loadingEmployeeDetails[empId];
                          
                          // Helper function to get designation name
                          const getDesignationName = () => {
                            if (!employeeDetail) return isLoading ? "Loading..." : "N/A";
                            const designation = (employeeDetail as any).designationRelation || (employeeDetail as any).designation;
                            return (designation && typeof designation === 'object' && designation.name) ? designation.name : "N/A";
                          };
                          
                          // Get salary
                          const getSalary = () => {
                            if (!employeeDetail) return isLoading ? "Loading..." : "N/A";
                            return employeeDetail.employeeSalary ? `PKR ${Number(employeeDetail.employeeSalary).toLocaleString()}` : "N/A";
                          };
                          
                          // Get joining date
                          const getDate = () => {
                            if (!employeeDetail) return isLoading ? "Loading..." : "N/A";
                            return employeeDetail.joiningDate ? new Date(employeeDetail.joiningDate).toLocaleDateString() : "N/A";
                          };
                          
                          return (
                            <TableRow key={empId}>
                              <TableCell className="font-medium">
                                <div className="flex flex-col">
                                  <span>{employee?.employeeName}</span>
                                  <span className="text-xs text-muted-foreground">
                                    {employee?.employeeId}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell>{getDesignationName()}</TableCell>
                              <TableCell>{getSalary()}</TableCell>
                              <TableCell>{getDate()}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

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

            {/* Third Row - Increment/Decrement Type and Method */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Increment/Decrement Type */}
              <div className="space-y-2">
                <Label htmlFor="incrementType">
                  Increment/Decrement Type <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.incrementType}
                  onValueChange={(value: "Increment" | "Decrement") =>
                    setFormData((prev) => ({ ...prev, incrementType: value }))
                  }
                  disabled={isPending || viewMode}
                >
                  <SelectTrigger id="incrementType">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Increment">Increment</SelectItem>
                    <SelectItem value="Decrement">Decrement</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Increment/Decrement Method */}
              <div className="space-y-2">
                <Label>
                  Increment/Decrement <span className="text-destructive">*</span>
                </Label>
                <RadioGroup
                  value={formData.incrementMethod}
                  onValueChange={(value: "Amount" | "Percent") => {
                    setFormData((prev) => ({ ...prev, incrementMethod: value }));
                    // Clear the other field when method changes
                    if (value === "Amount") {
                      setFormData((prev) => ({ ...prev, incrementPercentage: "" }));
                    } else {
                      setFormData((prev) => ({ ...prev, incrementAmount: "" }));
                    }
                  }}
                  className="flex gap-6"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Amount" id="amount" />
                    <Label htmlFor="amount">Amount</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="Percent" id="percent" />
                    <Label htmlFor="percent">Percent</Label>
                  </div>
                </RadioGroup>
                {formData.incrementMethod === "Amount" ? (
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.incrementAmount}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, incrementAmount: e.target.value }))
                    }
                    placeholder="Enter amount"
                    disabled={isPending || viewMode}
                    className="mt-2"
                  />
                ) : (
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={formData.incrementPercentage}
                    onChange={(e) => {
                      const value = e.target.value;
                      const numValue = parseFloat(value);
                      // Prevent values above 100
                      if (value === "" || (!isNaN(numValue) && numValue <= 100)) {
                        setFormData((prev) => ({ ...prev, incrementPercentage: value }));
                      } else if (!isNaN(numValue) && numValue > 100) {
                        toast.error("Percentage cannot exceed 100%");
                        setFormData((prev) => ({ ...prev, incrementPercentage: "100" }));
                      }
                    }}
                    placeholder="Enter percentage (max 100)"
                    disabled={isPending || viewMode}
                    className="mt-2"
                  />
                )}
              </div>
            </div>

            {/* Fourth Row - Promotion Date, Current Month, Months of Increment */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Promotion / Increment Date */}
              <div className="space-y-2">
                <Label htmlFor="promotionDate">
                  Promotion / Increment Date <span className="text-destructive">*</span>
                </Label>
                <DatePicker
                  value={formData.promotionDate}
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, promotionDate: value || "" }))
                  }
                  disabled={isPending || viewMode}
                  placeholder="mm/dd/yyyy"
                />
              </div>

              {/* Select Current Month */}
              <div className="space-y-2">
                <Label htmlFor="currentMonth">
                  Select Current Month <span className="text-destructive">*</span>
                </Label>
                <DatePicker
                  value={formData.currentMonth}
                  onChange={(value) =>
                    setFormData((prev) => ({ ...prev, currentMonth: value || "" }))
                  }
                  disabled={isPending || viewMode}
                  placeholder="mm/dd/yyyy"
                />
              </div>

              {/* Months of Increment */}
              <div className="space-y-2">
                <Label htmlFor="monthsOfIncrement">
                  Months of Increment <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="monthsOfIncrement"
                  type="number"
                  min="1"
                  value={formData.monthsOfIncrement}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, monthsOfIncrement: e.target.value }))
                  }
                  placeholder="Enter months"
                  disabled={isPending || viewMode}
                  required
                />
              </div>
            </div>

            {/* Search Button - Hide in edit/view mode */}
            {!editMode && !viewMode && (
              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={handleSearch}
                  disabled={isPending || viewMode}
                >
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </div>
            )}

            {/* Employee Increments Table */}
            {employeeIncrements.length > 0 && (
              <Card className="border-dashed">
                <CardHeader>
                  <CardTitle className="text-lg">Employee Increments</CardTitle>
                  <CardDescription>
                    Review and edit increments before submitting ({employeeIncrements.length} employee(s))
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Employee</TableHead>
                          <TableHead>Grade</TableHead>
                          <TableHead>Designation</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Increment/Decrement</TableHead>
                          <TableHead>Salary</TableHead>
                          <TableHead>Date</TableHead>
                          {!viewMode && !editMode && <TableHead className="w-[100px]">Actions</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {employeeIncrements.map((item) => (
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
                                value={item.employeeGradeId}
                                onValueChange={(value) => {
                                  handleUpdateIncrement(item.id, "employeeGradeId", value);
                                }}
                                disabled={isPending || viewMode}
                              >
                                <SelectTrigger className="w-[150px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {employeeGrades.map((grade) => (
                                    <SelectItem key={grade.id} value={grade.id}>
                                      {grade.grade}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={item.designationId}
                                onValueChange={(value) => {
                                  handleUpdateIncrement(item.id, "designationId", value);
                                }}
                                disabled={isPending || viewMode}
                              >
                                <SelectTrigger className="w-[180px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {designations.map((designation) => (
                                    <SelectItem key={designation.id} value={designation.id}>
                                      {designation.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Select
                                value={item.incrementType || "Increment"}
                                onValueChange={(value) => {
                                  if (value === "Increment" || value === "Decrement") {
                                    const incrementType = value as "Increment" | "Decrement";
                                    // Update increment type
                                    setEmployeeIncrements((prev) =>
                                      prev.map((i) =>
                                        i.id === item.id ? { ...i, incrementType } : i
                                      )
                                    );
                                    // Recalculate salary when type changes
                                    const employeeDetail = selectedEmployeeDetails[item.employeeId];
                                    const baseSalary = item.previousSalary || 
                                      (employeeDetail?.employeeSalary ? Number(employeeDetail.employeeSalary) : 0) ||
                                      (item.salary > 0 ? item.salary : 0);
                                    const incrementValue =
                                      item.incrementMethod === "Amount"
                                        ? item.incrementAmount || 0
                                        : item.incrementPercentage || 0;
                                    if (incrementValue > 0 && baseSalary > 0) {
                                      const newSalary = calculateSalary(
                                        baseSalary,
                                        incrementType,
                                        item.incrementMethod,
                                        incrementValue
                                      );
                                      setEmployeeIncrements((prev) =>
                                        prev.map((i) =>
                                          i.id === item.id ? { ...i, salary: newSalary, previousSalary: baseSalary } : i
                                        )
                                      );
                                    }
                                  }
                                }}
                                disabled={isPending || viewMode}
                              >
                                <SelectTrigger className="w-[120px]">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Increment">Increment</SelectItem>
                                  <SelectItem value="Decrement">Decrement</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell>
                              {item.incrementMethod === "Amount" ? (
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={item.incrementAmount || 0}
                                  onChange={(e) => {
                                    const newAmount = parseFloat(e.target.value) || 0;
                                    handleUpdateIncrement(item.id, "incrementAmount", newAmount);
                                    // Auto-calculate salary
                                    const employeeDetail = selectedEmployeeDetails[item.employeeId];
                                    const baseSalary = item.previousSalary || 
                                      (employeeDetail?.employeeSalary ? Number(employeeDetail.employeeSalary) : 0) ||
                                      (item.salary > 0 ? item.salary : 0);
                                    const newSalary = calculateSalary(
                                      baseSalary,
                                      item.incrementType,
                                      "Amount",
                                      newAmount
                                    );
                                    handleUpdateIncrement(item.id, "salary", newSalary);
                                    // Update previousSalary if not set
                                    if (!item.previousSalary && baseSalary > 0) {
                                      handleUpdateIncrement(item.id, "previousSalary", baseSalary);
                                    }
                                  }}
                                  disabled={isPending || viewMode}
                                  className="w-[120px]"
                                  placeholder="Amount"
                                />
                              ) : (
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  max="100"
                                  value={item.incrementPercentage || 0}
                                  onChange={(e) => {
                                    const value = e.target.value;
                                    const numValue = parseFloat(value) || 0;
                                    // Prevent values above 100
                                    if (value === "" || numValue <= 100) {
                                      handleUpdateIncrement(item.id, "incrementPercentage", numValue);
                                      // Auto-calculate salary
                                      const employeeDetail = selectedEmployeeDetails[item.employeeId];
                                      const baseSalary = item.previousSalary || 
                                        (employeeDetail?.employeeSalary ? Number(employeeDetail.employeeSalary) : 0) ||
                                        (item.salary > 0 ? item.salary : 0);
                                      const newSalary = calculateSalary(
                                        baseSalary,
                                        item.incrementType,
                                        "Percent",
                                        numValue
                                      );
                                      handleUpdateIncrement(item.id, "salary", newSalary);
                                      // Update previousSalary if not set
                                      if (!item.previousSalary && baseSalary > 0) {
                                        handleUpdateIncrement(item.id, "previousSalary", baseSalary);
                                      }
                                    } else {
                                      toast.error("Percentage cannot exceed 100%");
                                      handleUpdateIncrement(item.id, "incrementPercentage", 100);
                                      // Auto-calculate salary with 100%
                                      const employeeDetail = selectedEmployeeDetails[item.employeeId];
                                      const baseSalary = item.previousSalary || 
                                        (employeeDetail?.employeeSalary ? Number(employeeDetail.employeeSalary) : 0) ||
                                        (item.salary > 0 ? item.salary : 0);
                                      const newSalary = calculateSalary(
                                        baseSalary,
                                        item.incrementType,
                                        "Percent",
                                        100
                                      );
                                      handleUpdateIncrement(item.id, "salary", newSalary);
                                      // Update previousSalary if not set
                                      if (!item.previousSalary && baseSalary > 0) {
                                        handleUpdateIncrement(item.id, "previousSalary", baseSalary);
                                      }
                                    }
                                  }}
                                  disabled={isPending || viewMode}
                                  className="w-[120px]"
                                  placeholder="Percent"
                                />
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={item.salary}
                                  onChange={(e) => {
                                    const newSalary = parseFloat(e.target.value) || 0;
                                    handleUpdateIncrement(item.id, "salary", newSalary);
                                  }}
                                  disabled={isPending || viewMode}
                                  className="w-[120px]"
                                  title="Salary is auto-calculated. You can manually adjust if needed."
                                />
                                {item.previousSalary && (
                                  <p className="text-xs text-muted-foreground">
                                    Base: {Number(item.previousSalary).toLocaleString()}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <DatePicker
                                value={item.promotionDate}
                                onChange={(value) =>
                                  handleUpdateIncrement(item.id, "promotionDate", value || "")
                                }
                                disabled={isPending || viewMode}
                              />
                            </TableCell>
                            {!viewMode && !editMode && (
                              <TableCell>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveIncrement(item.id)}
                                  disabled={isPending}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Submit Button - Hide in view mode */}
            {!viewMode && (
              <div className="flex justify-end pt-4 border-t">
                <Button type="submit" disabled={isPending || employeeIncrements.length === 0} size="lg">
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      {editMode ? "Updating..." : "Creating..."}
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      {editMode ? "Update" : `Submit (${employeeIncrements.length})`}
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

