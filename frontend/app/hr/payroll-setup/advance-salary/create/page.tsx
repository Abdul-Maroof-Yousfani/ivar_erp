"use client";

import { useState, useEffect, startTransition, addTransitionType } from "react";
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
import { getEmployeeById } from "@/lib/actions/employee";
import { useEmployeeDropdown } from "@/hooks/use-employee-dropdown";
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
  const { user, isAdmin, hasPermission } = useAuth();
  
  // Check if user has permission to create advance salary for others
  const canCreateForOthers = isAdmin() || hasPermission("hr.advance-salary.create");
  
  const [loadingSubDepartments, setLoadingSubDepartments] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([]);
  const [currentEmployeeLabel, setCurrentEmployeeLabel] = useState<string>("");

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

  const selectedDepartmentId = form.watch("departmentId");
  const selectedSubDepartmentId = form.watch("subDepartmentId");
  const selectedEmployeeIds = form.watch("employeeIds");

  const { isInitialLoading, multiSelectProps } = useEmployeeDropdown({
    departmentId: selectedDepartmentId,
    subDepartmentId: selectedSubDepartmentId,
    selectedIds: selectedEmployeeIds,
  });

  const loginId = user?.employeeId || user?.employee?.id;

  // Pre-select current user if available
  useEffect(() => {
    if (loginId) {
      const currentEmployeeIds = form.getValues("employeeIds");
      if (currentEmployeeIds.length === 0) {
        form.setValue("employeeIds", [loginId as string]);
      }
    }
  }, [user, loginId, form]);

  useEffect(() => {
    const loadCurrentEmployee = async () => {
      if (!loginId) return;
      if (user?.employee) {
        setCurrentEmployeeLabel(`${user.firstName || ""} ${user.lastName || ""} (${user.employee.employeeId})`.trim());
        return;
      }
      const result = await getEmployeeById(loginId as string);
      if (result.status && result.data) {
        setCurrentEmployeeLabel(`${result.data.employeeName} (${result.data.employeeId})`);
      }
    };
    loadCurrentEmployee();
  }, [loginId, user]);

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
                        {isInitialLoading ? (
                          <div className="h-10 bg-muted rounded-md animate-pulse" />
                        ) : (
                          <MultiSelect
                            options={multiSelectProps.options}
                            value={field.value}
                            onValueChange={field.onChange}
                            onSearch={multiSelectProps.onSearch}
                            onLoadMore={multiSelectProps.onLoadMore}
                            hasMore={multiSelectProps.hasMore}
                            isLoading={multiSelectProps.isLoading}
                            placeholder="Select one or more employees"
                            searchPlaceholder="Search by name or employee ID..."
                            emptyMessage={multiSelectProps.isLoading ? "Loading employees..." : "No employees found"}
                            disabled={form.formState.isSubmitting || !canCreateForOthers}
                            maxDisplayedItems={3}
                            showSelectAll={false}
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
                    {currentEmployeeLabel
                      || (loginId ? `Employee ID: ${loginId}` : "Loading...")}
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
