"use client";

import { useState, useEffect, useMemo, startTransition, addTransitionType } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Gift,
  Users,
  Building2,
  DollarSign,
  Calendar,
  Percent,
  Search,
  CalendarDays,
  Minus,
  Wallet,
  Trash2,
  Plus,
} from "lucide-react";
import Link from "next/link";
import {
  getEmployeesForDropdown,
  getEmployeeById,
  type EmployeeDropdownOption,
  type Employee,
} from "@/lib/actions/employee";
import {
  getDepartments,
  getSubDepartmentsByDepartment,
  type Department,
  type SubDepartment,
} from "@/lib/actions/department";
import { getBonusTypes, type BonusType } from "@/lib/actions/bonus-type";
import { createBonuses } from "@/lib/actions/bonus";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import { Autocomplete } from "@/components/ui/autocomplete";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// Zod validation schema
const bonusIssueFormSchema = z.object({
  departmentId: z.string().optional(),
  subDepartmentId: z.string().optional(),
  employeeIds: z
    .array(z.string())
    .min(1, "At least one employee must be selected"),
  bonusTypeId: z.string().min(1, "Bonus type is required"),
  amount: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || val.trim() === "") return true; // Optional, validated in onSubmit
        const num = parseFloat(val);
        return !isNaN(num) && num > 0;
      },
      {
        message: "Amount must be a positive number",
      }
    ),
  percentage: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val || val.trim() === "") return true; // Optional, validated in onSubmit
        const num = parseFloat(val);
        return !isNaN(num) && num >= 0 && num <= 100;
      },
      {
        message: "Percentage must be between 0 and 100",
      }
    ),
  bonusMonthYear: z
    .string()
    .min(1, "Bonus month and year is required")
    .regex(/^\d{4}-\d{2}$/, "Invalid month-year format (YYYY-MM)"),
  paymentMethod: z.enum(["with_salary", "separately"]).default("with_salary"),
  adjustmentMethod: z
    .enum(["distributed-remaining-months", "deduct-current-month"])
    .default("distributed-remaining-months"),
  notes: z
    .string()
    .max(1000, "Notes must not exceed 1000 characters")
    .optional(),
  isTaxable: z.boolean().default(false),
  taxPercentage: z.string().optional(),
});

type BonusIssueFormData = z.infer<typeof bonusIssueFormSchema>;

interface EmployeeBonusItem {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeCode: string;
  bonusTypeId: string;
  bonusTypeName: string;
  amount: number;
  percentage?: number;
  paymentMethod: string;
  adjustmentMethod: string;
  notes: string;
  isTaxable: boolean;
  taxPercentage: number;
}

export default function IssueBonusPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [loadingSubDepartments, setLoadingSubDepartments] = useState(false);
  const [loadingBonusTypes, setLoadingBonusTypes] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [employees, setEmployees] = useState<EmployeeDropdownOption[]>([]);
  const [employeeDetails, setEmployeeDetails] = useState<{
    [key: string]: Employee;
  }>({});
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([]);
  const [bonusTypes, setBonusTypes] = useState<BonusType[]>([]);
  const [selectedBonusType, setSelectedBonusType] = useState<BonusType | null>(
    null
  );
  const [employeeBonuses, setEmployeeBonuses] = useState<EmployeeBonusItem[]>(
    []
  );

  const form = useForm<BonusIssueFormData>({
    resolver: zodResolver(bonusIssueFormSchema) as any,
    defaultValues: {
      departmentId: undefined,
      subDepartmentId: undefined,
      employeeIds: [],
      bonusTypeId: "",
      amount: "",
      percentage: "",
      bonusMonthYear: "",
      paymentMethod: "with_salary",
      adjustmentMethod: "distributed-remaining-months",
      notes: "",
      isTaxable: false,
      taxPercentage: "0",
    },
    mode: "onBlur",
  });

  const selectedDepartmentId = form.watch("departmentId");
  const selectedSubDepartmentId = form.watch("subDepartmentId");
  const selectedBonusTypeId = form.watch("bonusTypeId");
  const selectedEmployeeIdsForm = form.watch("employeeIds");

  // Fetch departments on mount
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const result = await getDepartments();
        if (result.status && result.data) {
          setDepartments(result.data);
        }
      } catch (error) {
        console.error("Failed to fetch departments:", error);
      }
    };
    fetchDepartments();
  }, []);

  // Fetch bonus types on mount
  useEffect(() => {
    const fetchBonusTypes = async () => {
      setLoadingBonusTypes(true);
      try {
        const result = await getBonusTypes();
        if (result.status && result.data) {
          setBonusTypes(result.data.filter((bt) => bt.status === "active"));
        } else {
          setBonusTypes([]);
        }
      } catch (error) {
        console.error("Error:", error);
        toast.error("Failed to load bonus types");
        setBonusTypes([]);
      } finally {
        setLoadingBonusTypes(false);
      }
    };
    fetchBonusTypes();
  }, []);

  // Fetch employees on mount
  useEffect(() => {
    const fetchEmployees = async () => {
      setLoading(true);
      try {
        const result = await getEmployeesForDropdown();
        if (result.status && result.data) {
          setEmployees(result.data);
        } else {
          toast.error(result.message || "Failed to load employees");
          setEmployees([]);
        }
      } catch (error) {
        console.error("Error:", error);
        toast.error("Failed to load employees");
        setEmployees([]);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, []);

  // Fetch employee details when employees are selected
  useEffect(() => {
    const fetchEmployeeDetails = async () => {
      const newEmployeeIds = selectedEmployeeIdsForm.filter(
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
  }, [selectedEmployeeIdsForm, employeeDetails]);

  // Update selected bonus type when bonusTypeId changes
  useEffect(() => {
    if (selectedBonusTypeId) {
      const bonusType = bonusTypes.find((bt) => bt.id === selectedBonusTypeId);
      setSelectedBonusType(bonusType || null);
      if (bonusType?.calculationType === "Amount") {
        form.setValue("percentage", "");
        if (bonusType.amount) {
          form.setValue("amount", bonusType.amount.toString());
        }
      } else if (bonusType?.calculationType === "Percentage") {
        form.setValue("amount", "");
        if (bonusType.percentage) {
          form.setValue("percentage", bonusType.percentage.toString());
        }
      }
    } else {
      setSelectedBonusType(null);
    }
  }, [selectedBonusTypeId, bonusTypes, form]);

  // Calculate bonus amounts when employees or bonus type changes
  useEffect(() => {
    if (selectedBonusType && selectedEmployeeIdsForm.length > 0) {
      if (selectedBonusType.calculationType === "Percentage") {
        const percentage = parseFloat(form.getValues("percentage") || "0");
        if (percentage > 0) {
          // Calculate amount for each employee based on their salary
          // Amount calculation is handled in the submit handler
        }
      }
    }
  }, [selectedBonusType, selectedEmployeeIdsForm, employeeDetails, form]);

  // Fetch sub-departments when department changes
  useEffect(() => {
    const fetchSubDepartments = async () => {
      if (selectedDepartmentId) {
        setLoadingSubDepartments(true);
        try {
          const result = await getSubDepartmentsByDepartment(
            selectedDepartmentId
          );
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
        form.setValue("subDepartmentId", undefined);
      }
    };

    fetchSubDepartments();
  }, [selectedDepartmentId, form]);

  // Filter employees based on department and sub-department
  const filteredEmployees = useMemo(() => {
    let filtered = [...employees];

    if (selectedDepartmentId) {
      filtered = filtered.filter(
        (emp) => emp.departmentId === selectedDepartmentId
      );
    }

    if (selectedSubDepartmentId) {
      filtered = filtered.filter(
        (emp) => emp.subDepartmentId === selectedSubDepartmentId
      );
    }

    return filtered;
  }, [employees, selectedDepartmentId, selectedSubDepartmentId]);

  // Employee options for MultiSelect
  const employeeOptions = useMemo(() => {
    return filteredEmployees.map((emp) => ({
      value: emp.id,
      label: `${emp.employeeName} (${emp.employeeId})`,
      description: emp.departmentName || undefined,
    }));
  }, [filteredEmployees]);

  // Bonus type options for Autocomplete
  const bonusTypeOptions = useMemo(() => {
    return bonusTypes.map((bt) => ({
      value: bt.id,
      label: `${bt.name} (${bt.calculationType === "Amount"
        ? `Fixed: ${bt.amount || "N/A"}`
        : `Percentage: ${bt.percentage || "N/A"}%`
        })`,
    }));
  }, [bonusTypes]);

  const handleSearch = () => {
    const bonusMonthYear = form.getValues("bonusMonthYear");
    const bonusTypeId = form.getValues("bonusTypeId");
    const employeeIds = form.getValues("employeeIds");
    const amount = form.getValues("amount");
    const percentage = form.getValues("percentage");
    const paymentMethod = form.getValues("paymentMethod");
    const adjustmentMethod = form.getValues("adjustmentMethod");
    const notes = form.getValues("notes") || "";

    if (!bonusMonthYear || !bonusTypeId || employeeIds.length === 0) {
      toast.error(
        "Please select bonus type, month-year, and at least one employee"
      );
      return;
    }

    if (selectedBonusType) {
      if (selectedBonusType.calculationType === "Amount" && !amount) {
        toast.error("Amount is required for this bonus type");
        return;
      }
      if (selectedBonusType.calculationType === "Percentage" && !percentage) {
        toast.error("Percentage is required for this bonus type");
        return;
      }
    }

    const selectedBonusTypeObj = bonusTypes.find((bt) => bt.id === bonusTypeId);
    if (!selectedBonusTypeObj) {
      toast.error("Invalid bonus type selected");
      return;
    }

    // Create bonus items for all selected employees
    const newBonuses: EmployeeBonusItem[] = employeeIds.map((empId) => {
      const employee = employees.find((e) => e.id === empId);
      let calculatedAmount = 0;
      let calculatedPercentage: number | undefined = undefined;

      if (selectedBonusTypeObj.calculationType === "Amount") {
        calculatedAmount = parseFloat(amount || "0");
      } else {
        calculatedPercentage = parseFloat(percentage || "0");
        const emp = employeeDetails[empId];
        if (emp?.employeeSalary) {
          calculatedAmount =
            (Number(emp.employeeSalary) * calculatedPercentage) / 100;
        }
      }

      return {
        id: `${empId}-${bonusTypeId}-${Date.now()}-${Math.random()}`,
        employeeId: empId,
        employeeName: employee?.employeeName || "",
        employeeCode: employee?.employeeId || "",
        bonusTypeId: bonusTypeId,
        bonusTypeName: selectedBonusTypeObj.name,
        amount: calculatedAmount,
        percentage: calculatedPercentage,
        paymentMethod: paymentMethod,
        adjustmentMethod: adjustmentMethod,
        notes: notes,
        isTaxable: form.getValues("isTaxable"),
        taxPercentage: parseFloat(form.getValues("taxPercentage") || "0"),
      };
    });

    // Filter out duplicates (same employee + bonus type combination)
    const existingIds = new Set(
      employeeBonuses.map((b) => `${b.employeeId}-${b.bonusTypeId}`)
    );
    const uniqueNewBonuses = newBonuses.filter(
      (b) => !existingIds.has(`${b.employeeId}-${b.bonusTypeId}`)
    );

    if (uniqueNewBonuses.length === 0) {
      toast.warning("All selected employees already have bonuses added");
      return;
    }

    setEmployeeBonuses([...employeeBonuses, ...uniqueNewBonuses]);
    toast.success(`Added bonuses for ${uniqueNewBonuses.length} employee(s)`);
  };

  const handleUpdateBonus = (
    id: string,
    field: keyof EmployeeBonusItem,
    value: string | number | undefined
  ) => {
    setEmployeeBonuses(
      employeeBonuses.map((item) =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const handleRemoveBonus = (id: string) => {
    setEmployeeBonuses(employeeBonuses.filter((item) => item.id !== id));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (employeeBonuses.length === 0) {
      toast.error("Please search and add at least one employee bonus");
      return;
    }

    // Group bonuses by bonusTypeId and bonusMonthYear
    const groupedBonuses = employeeBonuses.reduce(
      (acc, bonus) => {
        const key = `${bonus.bonusTypeId}-${form.getValues("bonusMonthYear")}`;
        if (!acc[key]) {
          acc[key] = {
            bonusTypeId: bonus.bonusTypeId,
            bonusMonthYear: form.getValues("bonusMonthYear"),
            bonuses: [] as Array<{
              employeeId: string;
              amount: number;
              percentage?: number;
              isTaxable?: boolean;
              taxPercentage?: number;
            }>,
            paymentMethod: bonus.paymentMethod,
            adjustmentMethod: bonus.adjustmentMethod,
            notes: bonus.notes,
          };
        }
        acc[key].bonuses.push({
          employeeId: bonus.employeeId,
          amount: bonus.amount,
          percentage: bonus.percentage,
          isTaxable: bonus.isTaxable,
          taxPercentage: bonus.taxPercentage,
        });
        return acc;
      },
      {} as Record<
        string,
        {
          bonusTypeId: string;
          bonusMonthYear: string;
          bonuses: Array<{
            employeeId: string;
            amount: number;
            percentage?: number;
            isTaxable?: boolean;
            taxPercentage?: number;
          }>;
          paymentMethod: string;
          adjustmentMethod: string;
          notes: string;
        }
      >
    );

    setSubmitting(true);
    try {
      // Submit each group separately
      const results = await Promise.all(
        Object.values(groupedBonuses).map(
          (group: {
            bonusTypeId: string;
            bonusMonthYear: string;
            bonuses: Array<{
              employeeId: string;
              amount: number;
              percentage?: number;
              isTaxable?: boolean;
              taxPercentage?: number;
            }>;
            paymentMethod: string;
            adjustmentMethod: string;
            notes: string;
          }) =>
            createBonuses({
              bonusTypeId: group.bonusTypeId,
              bonusMonthYear: group.bonusMonthYear,
              bonuses: group.bonuses,
              paymentMethod: group.paymentMethod,
              adjustmentMethod: group.adjustmentMethod,
              notes: group.notes,
            })
        )
      );

      const allSuccess = results.every((r) => r.status);
      if (allSuccess) {
        const totalAmount = employeeBonuses.reduce(
          (sum, b) => sum + b.amount,
          0
        );
        toast.success(
          `Bonuses issued successfully for ${employeeBonuses.length
          } employee(s). Total amount: PKR ${totalAmount.toLocaleString(
            "en-PK",
            { minimumFractionDigits: 2 }
          )}`
        );
        form.reset();
        setEmployeeBonuses([]);
        startTransition(() => {
          addTransitionType("nav-back");
          router.push("/hr/payroll-setup/bonus/view");
        });
      } else {
        const errorMessages = results
          .filter((r) => !r.status)
          .map((r) => r.message)
          .join(", ");
        toast.error(errorMessages || "Failed to issue some bonuses");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to issue bonuses");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <div className="mb-6">
        <Link href="/hr/payroll-setup/bonus/view" transitionTypes={["nav-back"]}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
      </div>

      <Form {...form}>
        <form onSubmit={onSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5" />
                Issue Bonus
              </CardTitle>
              <CardDescription>
                Issue bonus to one or more employees based on the selected bonus
                type
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Department and Sub Department Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="departmentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Department
                      </FormLabel>
                      <FormControl>
                        <Autocomplete
                          options={[
                            { value: "", label: "All Departments" },
                            ...departments.map((dept) => ({
                              value: dept.id,
                              label: dept.name,
                            })),
                          ]}
                          value={field.value ?? ""}
                          onValueChange={(value) => {
                            const newValue = value === "" ? undefined : value;
                            field.onChange(newValue);
                            form.setValue("subDepartmentId", undefined);
                            form.setValue("employeeIds", []);
                          }}
                          placeholder="Select Department (Optional)"
                          searchPlaceholder="Search department..."
                          emptyMessage="No departments found"
                          disabled={form.formState.isSubmitting || submitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="subDepartmentId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Sub Department
                      </FormLabel>
                      <FormControl>
                        {loadingSubDepartments ? (
                          <div className="h-10 bg-muted rounded-md animate-pulse" />
                        ) : (
                          <Autocomplete
                            options={[
                              { value: "", label: "All Sub Departments" },
                              ...subDepartments.map((subDept) => ({
                                value: subDept.id,
                                label: subDept.name,
                              })),
                            ]}
                            value={field.value ?? ""}
                            onValueChange={(value) => {
                              const newValue = value === "" ? undefined : value;
                              field.onChange(newValue);
                              form.setValue("employeeIds", []);
                            }}
                            placeholder={
                              !selectedDepartmentId
                                ? "Select department first"
                                : "Select Sub Department (Optional)"
                            }
                            searchPlaceholder="Search sub department..."
                            emptyMessage="No sub departments found"
                            disabled={
                              form.formState.isSubmitting ||
                              submitting ||
                              !selectedDepartmentId ||
                              subDepartments.length === 0
                            }
                          />
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Employees Multi-Select */}
                <FormField
                  control={form.control}
                  name="employeeIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Employees <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        {loading ? (
                          <div className="h-10 bg-muted rounded-md animate-pulse" />
                        ) : (
                          <MultiSelect
                            options={employeeOptions}
                            value={field.value}
                            onValueChange={(value) => {
                              field.onChange(value);
                            }}
                            placeholder="Select one or more employees"
                            searchPlaceholder="Search employees..."
                            emptyMessage="No employees found"
                            disabled={
                              form.formState.isSubmitting ||
                              submitting ||
                              loading
                            }
                            maxDisplayedItems={3}
                            showSelectAll={true}
                            icon={<Users className="h-3 w-3" />}
                          />
                        )}
                      </FormControl>
                      <FormDescription>
                        {field.value.length > 0 &&
                          `${field.value.length} employee(s) selected`}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className={cn("grid grid-cols-1 gap-4 items-start", selectedBonusType?.calculationType ? "md:grid-cols-3" : "md:grid-cols-2")}>
                {/* Bonus Type */}
                <FormField
                  control={form.control}
                  name="bonusTypeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Gift className="h-4 w-4" />
                        Bonus Type <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        {loadingBonusTypes ? (
                          <div className="h-10 bg-muted rounded-md animate-pulse" />
                        ) : (
                          <Autocomplete
                            options={bonusTypeOptions}
                            value={field.value}
                            onValueChange={field.onChange}
                            placeholder="Select bonus type"
                            searchPlaceholder="Search bonus type..."
                            emptyMessage="No bonus types found"
                            disabled={
                              form.formState.isSubmitting ||
                              submitting ||
                              loadingBonusTypes
                            }
                          />
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Amount or Percentage based on bonus type */}
                {selectedBonusType?.calculationType === "Amount" ? (
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Bonus Amount{" "}
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder={
                              selectedBonusType.amount
                                ? selectedBonusType.amount.toString()
                                : "0.00"
                            }
                            disabled={
                              form.formState.isSubmitting ||
                              submitting ||
                              !!selectedBonusType.amount
                            }
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          {selectedBonusType.amount
                            ? `Fixed amount: ${selectedBonusType.amount} (pre-filled from bonus type)`
                            : "Enter the bonus amount per employee"}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : selectedBonusType?.calculationType === "Percentage" ? (
                  <FormField
                    control={form.control}
                    name="percentage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Percent className="h-4 w-4" />
                          Bonus Percentage{" "}
                          <span className="text-destructive">*</span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            placeholder={
                              selectedBonusType.percentage
                                ? selectedBonusType.percentage.toString()
                                : "0.00"
                            }
                            disabled={
                              form.formState.isSubmitting ||
                              submitting ||
                              !!selectedBonusType.percentage
                            }
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          {selectedBonusType.percentage
                            ? `Fixed percentage: ${selectedBonusType.percentage}% (pre-filled from bonus type). Amount will be calculated based on each employee's salary.`
                            : "Enter the bonus percentage (0-100%). Amount will be calculated based on each employee's salary."}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : null}
                {/* Bonus Month-Year */}
                <FormField
                  control={form.control}
                  name="bonusMonthYear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Bonus Month & Year{" "}
                        <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <MonthYearPicker
                          value={field.value}
                          onChange={field.onChange}
                          disabled={form.formState.isSubmitting || submitting}
                          placeholder="Select month and year"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">

                {/* Payment Method */}
                <FormField
                  control={form.control}
                  name="paymentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Wallet className="h-4 w-4" />
                        Payment Method <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={form.formState.isSubmitting || submitting}
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Select payment method">
                              {field.value === "with_salary" ? (
                                <span className="flex items-center gap-2">
                                  <Wallet className="h-4 w-4 text-primary" />
                                  Pay with Salary
                                </span>
                              ) : field.value === "separately" ? (
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
                            <SelectItem
                              value="with_salary"
                              className="py-3 cursor-pointer"
                            >
                              <div className="flex items-start gap-3 w-full">
                                <Wallet className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                                <div className="flex flex-col gap-1 flex-1">
                                  <span className="font-semibold text-sm">
                                    Pay with Salary
                                  </span>
                                  <span className="text-xs text-muted-foreground leading-relaxed">
                                    Bonus will be included in the monthly salary
                                    payment
                                  </span>
                                </div>
                              </div>
                            </SelectItem>
                            <SelectItem
                              value="separately"
                              className="py-3 cursor-pointer"
                            >
                              <div className="flex items-start gap-3 w-full">
                                <DollarSign className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                                <div className="flex flex-col gap-1 flex-1">
                                  <span className="font-semibold text-sm">
                                    Separately
                                  </span>
                                  <span className="text-xs text-muted-foreground leading-relaxed">
                                    Bonus will be paid as a separate transaction
                                  </span>
                                </div>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormDescription>
                        Choose how the bonus should be paid to employees.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Tax Settings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start border p-4 rounded-md bg-muted/20 my-4">
                  <FormField
                    control={form.control}
                    name="isTaxable"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm bg-background">
                        <div className="space-y-0.5">
                          <FormLabel>Taxable Bonus</FormLabel>
                          <FormDescription>
                            Include this bonus in taxable income calculation
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={form.formState.isSubmitting || submitting}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Adjustment Method */}
                <FormField
                  control={form.control}
                  name="adjustmentMethod"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4" />
                        Adjustment Method{" "}
                        <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={form.formState.isSubmitting || submitting}
                        >
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Select adjustment method">
                              {field.value === "distributed-remaining-months" ? (
                                <span className="flex items-center gap-2">
                                  <CalendarDays className="h-4 w-4 text-primary" />
                                  Distributed in Remaining Months
                                </span>
                              ) : field.value === "deduct-current-month" ? (
                                <span className="flex items-center gap-2">
                                  <Minus className="h-4 w-4 text-destructive" />
                                  Deduct from Current Month
                                </span>
                              ) : (
                                "Select adjustment method"
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className="min-w-[320px]">
                            <SelectItem
                              value="distributed-remaining-months"
                              className="py-3 cursor-pointer"
                            >
                              <div className="flex items-start gap-3 w-full">
                                <CalendarDays className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                                <div className="flex flex-col gap-1 flex-1">
                                  <span className="font-semibold text-sm">
                                    Distributed in Remaining Months
                                  </span>
                                  <span className="text-xs text-muted-foreground leading-relaxed">
                                    Bonus will be distributed across remaining
                                    months of the year
                                  </span>
                                </div>
                              </div>
                            </SelectItem>
                            <SelectItem
                              value="deduct-current-month"
                              className="py-3 cursor-pointer"
                            >
                              <div className="flex items-start gap-3 w-full">
                                <Minus className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
                                <div className="flex flex-col gap-1 flex-1">
                                  <span className="font-semibold text-sm">
                                    Deduct from Current Month
                                  </span>
                                  <span className="text-xs text-muted-foreground leading-relaxed">
                                    Bonus will be deducted from the current
                                    month&apos;s salary
                                  </span>
                                </div>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormDescription>
                        Choose how the bonus adjustment should be handled when an
                        existing bonus is found.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Search Button */}
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSearch}
                  disabled={
                    form.formState.isSubmitting ||
                    submitting ||
                    !form.getValues("bonusTypeId") ||
                    !form.getValues("bonusMonthYear") ||
                    form.getValues("employeeIds").length === 0
                  }
                >
                  <Search className="h-4 w-4 mr-2" />
                  Search
                </Button>
              </div>

              {/* Employee Bonuses Table */}
              {employeeBonuses.length > 0 && (
                <Card className="border-dashed">
                  <CardHeader>
                    <CardTitle className="text-lg">Employee Bonuses</CardTitle>
                    <CardDescription>
                      Review and edit bonuses before submitting (
                      {employeeBonuses.length} employee(s))
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Employee</TableHead>
                            <TableHead>Bonus Type</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Percentage</TableHead>
                            <TableHead>Payment Method</TableHead>
                            <TableHead>Adjustment Method</TableHead>
                            <TableHead>Notes</TableHead>
                            <TableHead className="w-[100px]">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {employeeBonuses.map((item) => (
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
                                  value={item.bonusTypeId}
                                  onValueChange={(value) => {
                                    const bonusType = bonusTypes.find(
                                      (bt) => bt.id === value
                                    );
                                    handleUpdateBonus(
                                      item.id,
                                      "bonusTypeId",
                                      value
                                    );
                                    if (bonusType) {
                                      handleUpdateBonus(
                                        item.id,
                                        "bonusTypeName",
                                        bonusType.name
                                      );
                                    }
                                  }}
                                  disabled={submitting}
                                >
                                  <SelectTrigger className="w-[180px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {bonusTypes.map((bt) => (
                                      <SelectItem key={bt.id} value={bt.id}>
                                        {bt.name}
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
                                    handleUpdateBonus(
                                      item.id,
                                      "amount",
                                      parseFloat(e.target.value) || 0
                                    )
                                  }
                                  disabled={submitting}
                                  className="w-[120px]"
                                />
                              </TableCell>
                              <TableCell>
                                {item.percentage !== undefined ? (
                                  <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="100"
                                    value={item.percentage}
                                    onChange={(e) =>
                                      handleUpdateBonus(
                                        item.id,
                                        "percentage",
                                        parseFloat(e.target.value) || 0
                                      )
                                    }
                                    disabled={submitting}
                                    className="w-[100px]"
                                  />
                                ) : (
                                  <span className="text-muted-foreground">
                                    —
                                  </span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={item.paymentMethod}
                                  onValueChange={(value) =>
                                    handleUpdateBonus(
                                      item.id,
                                      "paymentMethod",
                                      value
                                    )
                                  }
                                  disabled={submitting}
                                >
                                  <SelectTrigger className="w-[140px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="with_salary">
                                      Pay with Salary
                                    </SelectItem>
                                    <SelectItem value="separately">
                                      Separately
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Select
                                  value={item.adjustmentMethod}
                                  onValueChange={(value) =>
                                    handleUpdateBonus(
                                      item.id,
                                      "adjustmentMethod",
                                      value
                                    )
                                  }
                                  disabled={submitting}
                                >
                                  <SelectTrigger className="w-[180px]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="distributed-remaining-months">
                                      Distributed in Remaining Months
                                    </SelectItem>
                                    <SelectItem value="deduct-current-month">
                                      Deduct from Current Month
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Input
                                  value={item.notes}
                                  onChange={(e) =>
                                    handleUpdateBonus(
                                      item.id,
                                      "notes",
                                      e.target.value
                                    )
                                  }
                                  placeholder="Notes"
                                  disabled={submitting}
                                  className="w-[200px]"
                                />
                              </TableCell>
                              <TableCell>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRemoveBonus(item.id)}
                                  disabled={submitting}
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

              {/* Total Bonus Preview */}
              {employeeBonuses.length > 0 && (
                <div className="p-4 bg-muted/50 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        Total Bonus Amount
                      </p>
                      <p className="text-2xl font-bold text-primary">
                        PKR{" "}
                        {employeeBonuses
                          .reduce((sum, b) => sum + b.amount, 0)
                          .toLocaleString("en-PK", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        For {employeeBonuses.length} employee(s)
                      </p>
                    </div>
                    <Gift className="h-8 w-8 text-primary/50" />
                  </div>
                </div>
              )}

              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter any additional notes or comments (optional)..."
                        rows={3}
                        disabled={form.formState.isSubmitting || submitting}
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Optional notes or comments about this bonus issue (max
                      1000 characters)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end pt-4 border-t">
            <Button
              type="submit"
              disabled={submitting || employeeBonuses.length === 0}
              size="lg"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Bonuses ({employeeBonuses.length})
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
