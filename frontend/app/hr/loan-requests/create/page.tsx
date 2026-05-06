"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ArrowLeft, Loader2, FileText, Calendar, Users, Building2, DollarSign, CreditCard } from "lucide-react";
import Link from "next/link";
import { getEmployeesForDropdown, type EmployeeDropdownOption } from "@/lib/actions/employee";
import { getDepartments, getSubDepartmentsByDepartment, type Department, type SubDepartment } from "@/lib/actions/department";
import { getLoanTypes, type LoanType } from "@/lib/actions/loan-type";
import { DatePicker } from "@/components/ui/date-picker";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import { Autocomplete } from "@/components/ui/autocomplete";
import { createLoanRequest } from "@/lib/actions/loan-request";

// Zod validation schema
const loanRequestFormSchema = z.object({
  departmentId: z.string().optional(),
  subDepartmentId: z.string().optional(),
  employeeId: z.string().min(1, "Employee is required"),
  loanTypeId: z.string().min(1, "Loan type is required"),
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
  requestedDate: z.string().min(1, "Requested date is required"),
  repaymentStartMonthYear: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^\d{4}-\d{2}$/.test(val),
      "Invalid month-year format (YYYY-MM)"
    ),
  numberOfInstallments: z
    .string()
    .optional()
    .refine(
      (val) => {
        if (!val) return true;
        const num = parseInt(val);
        return !isNaN(num) && num > 0 && num <= 120;
      },
      "Number of installments must be between 1 and 120"
    ),
  reason: z
    .string()
    .min(1, "Reason is required")
    .min(10, "Reason must be at least 10 characters")
    .max(1000, "Reason must not exceed 1000 characters"),
  additionalDetails: z
    .string()
    .max(2000, "Additional details must not exceed 2000 characters")
    .optional(),
});

type LoanRequestFormData = z.infer<typeof loanRequestFormSchema>;

import { useAuth } from "@/components/providers/auth-provider";

export default function CreateLoanRequestPage() {
  const router = useRouter();
  const { user, isAdmin, hasPermission } = useAuth();

  // Check if user has permission to create loan request for others
  const canCreateForOthers = isAdmin() || hasPermission("hr.loan-request.create");

  const [loading, setLoading] = useState(true);
  const [loadingSubDepartments, setLoadingSubDepartments] = useState(false);
  const [loadingLoanTypes, setLoadingLoanTypes] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [employees, setEmployees] = useState<EmployeeDropdownOption[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([]);
  const [loanTypes, setLoanTypes] = useState<LoanType[]>([]);

  const form = useForm<LoanRequestFormData>({
    resolver: zodResolver(loanRequestFormSchema) as any,
    defaultValues: {
      departmentId: undefined,
      subDepartmentId: undefined,
      employeeId: "",
      loanTypeId: "",
      amount: "",
      requestedDate: "",
      repaymentStartMonthYear: undefined,
      numberOfInstallments: "",
      reason: "",
      additionalDetails: "",
    },
    mode: "onBlur",
  });

  // Pre-select current user if available
  useEffect(() => {
    if (user?.employeeId && employees.length > 0) {
      // Find employee object for current user
      const currentUserEmployee = employees.find(emp => emp.id === user.employeeId);

      if (currentUserEmployee) {
        // Set department if not already set
        if (!form.getValues("departmentId") && currentUserEmployee.departmentId) {
          form.setValue("departmentId", currentUserEmployee.departmentId);
        }

        // Set sub-department if not already set
        if (!form.getValues("subDepartmentId") && currentUserEmployee.subDepartmentId) {
          form.setValue("subDepartmentId", currentUserEmployee.subDepartmentId);
        }

        // Set employee ID
        if (!form.getValues("employeeId")) {
          form.setValue("employeeId", user.employeeId);
        }
      }
    }
  }, [user, employees, form]);

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
        if (isAdmin()) {
          toast.error("Failed to load departments");
        }
      }
    };
    fetchDepartments();
  }, [isAdmin]);

  // Fetch loan types on mount
  useEffect(() => {
    const fetchLoanTypes = async () => {
      setLoadingLoanTypes(true);
      try {
        const result = await getLoanTypes();
        if (result.status && result.data) {
          setLoanTypes(result.data.filter(lt => lt.status === "active"));
        } else {
          if (isAdmin()) {
            toast.error(result.message || "Failed to load loan types");
          }
          setLoanTypes([]);
        }
      } catch (error) {
        console.error("Error:", error);
        if (isAdmin()) {
          toast.error("Failed to load loan types");
        }
        setLoanTypes([]);
      } finally {
        setLoadingLoanTypes(false);
      }
    };
    fetchLoanTypes();
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

  // Find current employee object for display
  const currentEmployee = useMemo(() => {
    if (user?.employeeId && employees.length > 0) {
      return employees.find(emp => emp.id === user.employeeId);
    }
    return null;
  }, [user, employees]);

  // Employee options for Autocomplete
  const employeeOptions = useMemo(() => {
    return filteredEmployees.map((emp) => ({
      value: emp.id,
      label: `${emp.employeeName} (${emp.employeeId})`,
      description: emp.departmentName || undefined,
    }));
  }, [filteredEmployees]);

  // Loan type options for Autocomplete
  const loanTypeOptions = useMemo(() => {
    return loanTypes.map((lt) => ({
      value: lt.id,
      label: lt.name,
    }));
  }, [loanTypes]);

  const onSubmit = async (data: LoanRequestFormData) => {
    try {
      setSubmitting(true);
      const result = await createLoanRequest({
        employeeIds: [data.employeeId], // Convert single employeeId to array for API
        loanTypeId: data.loanTypeId,
        amount: parseFloat(data.amount),
        requestedDate: data.requestedDate,
        repaymentStartMonthYear: data.repaymentStartMonthYear || undefined,
        numberOfInstallments: data.numberOfInstallments ? parseInt(data.numberOfInstallments) : undefined,
        reason: data.reason,
        additionalDetails: data.additionalDetails || undefined,
      });

      if (result.status) {
        toast.success(result.message || "Loan request created successfully");
        router.push("/hr/loan-requests/view");
      } else {
        toast.error(result.message || "Failed to create loan request");
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to create loan request");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <div className="mb-6">
        <Link href="/hr/loan-requests/view">
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
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Create Loan Request
              </CardTitle>
              <CardDescription>
                Fill in the details to create a loan request for one or more employees
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
                              form.setValue("employeeId", "");
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
                                form.setValue("employeeId", "");
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
                </div>
              )}

              {/* Employee Selection */}
              {canCreateForOthers ? (
                <FormField
                  control={form.control}
                  name="employeeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Employee <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        {loading ? (
                          <div className="h-10 bg-muted rounded-md animate-pulse" />
                        ) : (
                          <Autocomplete
                            options={employeeOptions}
                            value={field.value}
                            onValueChange={field.onChange}
                            placeholder="Select employee"
                            searchPlaceholder="Search employees..."
                            emptyMessage="No employees found"
                            disabled={form.formState.isSubmitting || submitting || loading}
                          />
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                // Read-only view for employees
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Select Employee</h3>
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Employee ID</p>
                    <div className="flex w-full rounded-md bg-muted px-3 py-2 text-sm">
                      {currentEmployee
                        ? `${currentEmployee.employeeName} (${currentEmployee.employeeId})`
                        : user?.employee
                          ? `${user.firstName || ""} ${user.lastName || ""} (${user.employee.employeeId})`
                          : "Loading..."}
                    </div>
                  </div>
                </div>
              )}

              {/* Loan Type */}
              <FormField
                control={form.control}
                name="loanTypeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Loan Type <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      {loadingLoanTypes ? (
                        <div className="h-10 bg-muted rounded-md animate-pulse" />
                      ) : (
                        <Autocomplete
                          options={loanTypeOptions}
                          value={field.value}
                          onValueChange={field.onChange}
                          placeholder="Select loan type"
                          searchPlaceholder="Search loan type..."
                          emptyMessage="No loan types found"
                          disabled={form.formState.isSubmitting || submitting || loadingLoanTypes}
                        />
                      )}
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Amount, Requested Date, and Repayment Start Month-Year Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Loan Amount <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          disabled={form.formState.isSubmitting || submitting}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="requestedDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Requested Date <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <DatePicker
                          value={field.value}
                          onChange={field.onChange}
                          disabled={form.formState.isSubmitting || submitting}
                          placeholder="Select requested date"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="repaymentStartMonthYear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Repayment Start Month & Year
                      </FormLabel>
                      <FormControl>
                        <MonthYearPicker
                          value={field.value}
                          onChange={field.onChange}
                          disabled={form.formState.isSubmitting || submitting}
                          placeholder="Select month and year (optional)"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Number of Installments */}
              <FormField
                control={form.control}
                name="numberOfInstallments"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Number of Installments</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="1"
                        max="120"
                        placeholder="e.g., 12"
                        disabled={form.formState.isSubmitting || submitting}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Number of months for repayment (1-120, optional)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                        placeholder="Enter detailed reason for loan request..."
                        rows={5}
                        disabled={form.formState.isSubmitting || submitting}
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      Provide a detailed reason (10-1000 characters)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Additional Details Field */}
              <FormField
                control={form.control}
                name="additionalDetails"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Additional Details</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Enter any additional details or notes (optional)..."
                        rows={4}
                        disabled={form.formState.isSubmitting || submitting}
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
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
              disabled={form.formState.isSubmitting || submitting}
            >
              Clear Form
            </Button>
            <Button
              type="submit"
              disabled={form.formState.isSubmitting || submitting}
            >
              {(form.formState.isSubmitting || submitting) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Submit Request
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
