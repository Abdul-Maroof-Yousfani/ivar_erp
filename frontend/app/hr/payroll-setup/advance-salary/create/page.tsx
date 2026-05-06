"use client";

import { useState, useEffect, useMemo, startTransition, addTransitionType } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
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
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { getEmployeesForDropdown, type EmployeeDropdownOption } from "@/lib/actions/employee";
import { getDepartments, getSubDepartmentsByDepartment, type Department, type SubDepartment } from "@/lib/actions/department";
import { DatePicker } from "@/components/ui/date-picker";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import { Autocomplete } from "@/components/ui/autocomplete";
import { MultiSelect } from "@/components/ui/multi-select";
import { createAdvanceSalary } from "@/lib/actions/advance-salary";

// Zod validation schema
const advanceSalaryFormSchema = z.object({
  departmentId: z.string().optional(),
  subDepartmentId: z.string().optional(),
  employeeIds: z
    .array(z.string())
    .min(1, "At least one employee must be selected"),
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine(
      (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num > 0;
      },
      "Amount must be a positive number"
    ),
  neededOn: z
    .string()
    .min(1, "Advance salary needed date is required"),
  deductionMonthYear: z
    .string()
    .min(1, "Deduction month and year is required")
    .regex(/^\d{4}-\d{2}$/, "Invalid month-year format"),
  reason: z
    .string()
    .min(1, "Reason is required")
    .min(10, "Reason must be at least 10 characters")
    .max(500, "Reason must not exceed 500 characters"),
});

type AdvanceSalaryFormData = z.infer<typeof advanceSalaryFormSchema>;

import { useAuth } from "@/components/providers/auth-provider";

// ... existing imports

export default function CreateAdvanceSalaryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const { user, isAdmin, hasPermission } = useAuth();
  
  // Check if user has permission to create advance salary for others
  const canCreateForOthers = isAdmin() || hasPermission("hr.advance-salary.create");
  
  const [loadingSubDepartments, setLoadingSubDepartments] = useState(false);
  const [employees, setEmployees] = useState<EmployeeDropdownOption[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([]);

  const form = useForm<AdvanceSalaryFormData>({
    resolver: zodResolver(advanceSalaryFormSchema) as any,
    defaultValues: {
      departmentId: undefined,
      subDepartmentId: undefined,
      employeeIds: [],
      amount: "",
      neededOn: "",
      deductionMonthYear: "",
      reason: "",
    },
    mode: "onBlur",
  });

  const loginId = user?.employeeId || user?.employee?.id;

  // Pre-select current user if available
  useEffect(() => {
    if (loginId) {
      // Set employee ID immediately (even before employees are loaded)
      const currentEmployeeIds = form.getValues("employeeIds");
      if (currentEmployeeIds.length === 0) {
        form.setValue("employeeIds", [loginId as string]);
      }

      // If employees are loaded, also set department and sub-department
      if (employees.length > 0) {
        const currentUserEmployee = employees.find(emp => emp.id === loginId);
        
        if (currentUserEmployee) {
          // Set department if not already set
          if (!form.getValues("departmentId") && currentUserEmployee.departmentId) {
            form.setValue("departmentId", currentUserEmployee.departmentId);
          }
          
          // Set sub-department if not already set
          if (!form.getValues("subDepartmentId") && currentUserEmployee.subDepartmentId) {
            form.setValue("subDepartmentId", currentUserEmployee.subDepartmentId);
          }
        }
      }
    }
  }, [user, loginId, employees, form]);

  const selectedDepartmentId = form.watch("departmentId");
  const selectedSubDepartmentId = form.watch("subDepartmentId");

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
        // Silently fail for regular users, can show error for admins if needed
        if (isAdmin()) {
          toast.error("Failed to load departments");
        }
      }
    };
    fetchDepartments();
  }, [isAdmin]);

  // Fetch employees on mount
  useEffect(() => {
    const fetchEmployees = async () => {
      setLoading(true);
      try {
        const result = await getEmployeesForDropdown();
        if (result.status && result.data) {
          setEmployees(result.data);
        } else {
          // If fetch fails (likely permission), and user is NOT admin, 
          // we don't necessarily want to toast every time
          if (isAdmin()) {
            toast.error(result.message || "Failed to load employees");
          }
          setEmployees([]);
        }
      } catch (error) {
        console.error("Error:", error);
        if (isAdmin()) {
          toast.error("Failed to load employees");
        }
        setEmployees([]);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, [isAdmin]);

  // Fetch sub-departments when department changes
  useEffect(() => {
    const fetchSubDepartments = async () => {
      if (selectedDepartmentId) {
        setLoadingSubDepartments(true);
        try {
          const result = await getSubDepartmentsByDepartment(selectedDepartmentId);
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

  // Find current employee object for display
  const currentEmployee = useMemo(() => {
    if (loginId && employees.length > 0) {
      return employees.find(emp => emp.id === loginId);
    }
    return null;
  }, [loginId, employees]);

  // Filter employees based on department and sub-department
  const filteredEmployees = useMemo(() => {
    let filtered = [...employees];

    if (selectedDepartmentId) {
      filtered = filtered.filter((emp) => emp.departmentId === selectedDepartmentId);
    }

    if (selectedSubDepartmentId) {
      filtered = filtered.filter((emp) => emp.subDepartmentId === selectedSubDepartmentId);
    }

    return filtered;
  }, [employees, selectedDepartmentId, selectedSubDepartmentId]);

  // Employee options for MultiSelect
  const employeeOptions = useMemo(() => {
    const options = filteredEmployees.map((emp) => ({
      value: emp.id,
      label: `${emp.employeeName} (${emp.employeeId})`,
      description: emp.departmentName || undefined,
    }));

    if (loginId && !options.some(o => o.value === loginId)) {
      const empInFullList = employees.find(e => e.id === loginId);
      if (empInFullList) {
        options.unshift({
          value: empInFullList.id,
          label: `${empInFullList.employeeName} (${empInFullList.employeeId})`,
          description: empInFullList.departmentName || undefined,
        });
      } else if (user?.employee) {
        options.unshift({
          value: loginId as string,
          label: `${user.firstName || ""} ${user.lastName || ""} (${user.employee.employeeId})`,
          description: user.employee.department?.name || undefined,
        });
      }
    }

    return options;
  }, [filteredEmployees, employees, user, loginId]);

  const onSubmit = async (data: AdvanceSalaryFormData) => {
    try {
      const result = await createAdvanceSalary({
        employeeIds: data.employeeIds,
        amount: parseFloat(data.amount),
        neededOn: data.neededOn,
        deductionMonthYear: data.deductionMonthYear,
        reason: data.reason,
      });

      if (result.status) {
        toast.success(result.message || "Advance salary request created successfully");
        startTransition(() => {
          addTransitionType("nav-back");
          router.push("/hr/payroll-setup/advance-salary/view");
        });
      } else {
        toast.error(result.message || "Failed to create advance salary request");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to create advance salary request");
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <div className="mb-6">
        <Link href="/hr/payroll-setup/advance-salary/view" transitionTypes={["nav-back"]}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Create Advance Salary Form</CardTitle>
              <CardDescription>
                Fill in the details to create an advance salary request for one or more employees
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Department and Sub Department Row - Only visible to admins/authorized users */}
              {canCreateForOthers && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="departmentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department</FormLabel>
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
                            disabled={form.formState.isSubmitting || !canCreateForOthers}
                          />
                        </FormControl>
                        <FormDescription>
                          Filter employees by department
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="subDepartmentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sub Department</FormLabel>
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
                                !selectedDepartmentId ||
                                subDepartments.length === 0 ||
                                !canCreateForOthers
                              }
                            />
                          )}
                        </FormControl>
                        <FormDescription>
                          Filter employees by sub-department
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {/* Employees Selection */}
              {canCreateForOthers ? (
                <FormField
                  control={form.control}
                  name="employeeIds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Employees <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        {loading ? (
                          <div className="h-10 bg-muted rounded-md animate-pulse" />
                        ) : (
                          <MultiSelect
                            options={employeeOptions}
                            value={field.value}
                            onValueChange={field.onChange}
                            placeholder="Select one or more employees"
                            searchPlaceholder="Search employees..."
                            emptyMessage="No employees found"
                            disabled={form.formState.isSubmitting || loading || !canCreateForOthers}
                            maxDisplayedItems={3}
                            showSelectAll={canCreateForOthers}
                          />
                        )}
                      </FormControl>
                      <FormDescription>
                        Select one or more employees for advance salary request
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                // Read-only view for employees without permission
                <div className="space-y-2">
                  <Label>
                    Employees <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex w-full rounded-md bg-muted px-3 py-2 text-sm">
                    {currentEmployee 
                      ? `${currentEmployee.employeeName} (${currentEmployee.employeeId})` 
                      : user?.employee 
                        ? `${user.firstName || ""} ${user.lastName || ""} (${user.employee.employeeId})`
                        : loginId
                          ? `Employee ID: ${loginId}`
                          : "Loading..."}
                  </div>
                  <FormDescription>
                    You can only create requests for yourself
                  </FormDescription>
                </div>
              )}

              {/* Amount, Needed On, and Deduction Month-Year Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Amount <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          disabled={form.formState.isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Enter the advance salary amount
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="neededOn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Advance Salary Needed On <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <DatePicker
                          value={field.value}
                          onChange={field.onChange}
                          disabled={form.formState.isSubmitting}
                          placeholder="Select date"
                        />
                      </FormControl>
                      <FormDescription>
                        When the advance salary is needed
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="deductionMonthYear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Deduction Month & Year <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <MonthYearPicker
                          value={field.value}
                          onChange={field.onChange}
                          disabled={form.formState.isSubmitting}
                          placeholder="Select month and year"
                        />
                      </FormControl>
                      <FormDescription>
                        When the advance will be deducted from salary
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Reason Field */}
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Reason (Detail) <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter detailed reason for advance salary request..."
                        rows={4}
                        disabled={form.formState.isSubmitting}
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Provide a detailed reason (10-500 characters)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Submit and Clear Buttons */}
          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => form.reset()}
              disabled={form.formState.isSubmitting}
            >
              Clear Form
            </Button>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Submit
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
