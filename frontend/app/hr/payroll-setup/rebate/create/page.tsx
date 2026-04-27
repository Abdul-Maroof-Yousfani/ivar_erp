"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { getEmployeesForDropdown, type EmployeeDropdownOption } from "@/lib/actions/employee";
import { getDepartments, getSubDepartmentsByDepartment, type Department, type SubDepartment } from "@/lib/actions/department";
import { getRebateNatures, type RebateNature } from "@/lib/actions/rebate-nature";
import { createRebate } from "@/lib/actions/rebate";
import { MonthYearPicker } from "@/components/ui/month-year-picker";
import { Autocomplete } from "@/components/ui/autocomplete";

// Zod validation schema
const rebateFormSchema = z.object({
  departmentId: z.string().optional(),
  subDepartmentId: z.string().optional(),
  employeeId: z.string().min(1, "Employee is required"),
  monthYear: z
    .string()
    .min(1, "Month - Year is required")
    .regex(/^\d{4}-\d{2}$/, "Invalid month-year format (YYYY-MM)"),
  rebateNatureId: z.string().min(1, "Rebate Nature is required"),
  rebateAmount: z
    .string()
    .min(1, "Rebate Amount is required")
    .refine(
      (val) => {
        const num = parseFloat(val);
        return !isNaN(num) && num > 0;
      },
      "Amount must be a positive number"
    ),
  file: z.any().optional(),
  remarks: z.string().optional(),
});

type RebateFormData = z.infer<typeof rebateFormSchema>;

export default function CreateRebatePage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [loadingSubDepartments, setLoadingSubDepartments] = useState(false);
  const [employees, setEmployees] = useState<EmployeeDropdownOption[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([]);
  const [rebateNatures, setRebateNatures] = useState<RebateNature[]>([]);
  const [loadingRebateNatures, setLoadingRebateNatures] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File[]>([]);

  const form = useForm<RebateFormData>({
    resolver: zodResolver(rebateFormSchema) as any,
    defaultValues: {
      departmentId: undefined,
      subDepartmentId: undefined,
      employeeId: "",
      monthYear: "",
      rebateNatureId: "",
      rebateAmount: "",
      file: undefined,
      remarks: "",
    },
    mode: "onBlur",
  });

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
      }
    };
    fetchDepartments();
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

  // Fetch rebate natures on mount
  useEffect(() => {
    const fetchRebateNatures = async () => {
      setLoadingRebateNatures(true);
      try {
        const result = await getRebateNatures();
        if (result.status && result.data) {
          setRebateNatures(result.data);
        } else {
          console.error("Failed to load rebate natures:", result.message);
          setRebateNatures([]);
        }
      } catch (error) {
        console.error("Error:", error);
        setRebateNatures([]);
      } finally {
        setLoadingRebateNatures(false);
      }
    };

    fetchRebateNatures();
  }, []);

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

  // Employee options for Autocomplete
  const employeeOptions = useMemo(() => {
    return filteredEmployees.map((emp) => ({
      value: emp.id,
      label: `${emp.employeeName} (${emp.employeeId})`,
      description: emp.departmentName || undefined,
    }));
  }, [filteredEmployees]);

  const handleFileChange = (files: File[]) => {
    setSelectedFile(files);
    form.setValue("file", files[0] || undefined);
  };

  const handleClearForm = () => {
    form.reset();
    setSelectedFile([]);
  };

  const onSubmit = async (data: RebateFormData) => {
    startTransition(async () => {
      try {
        let attachmentUrl: string | undefined = undefined;

        // Upload file first if provided
        if (data.file) {
          const formData = new FormData();
          formData.append("file", data.file);

          const uploadRes = await fetch("/internal-api/uploads", {
            method: "POST",
            body: formData,
          });

          const uploadResult = await uploadRes.json();

          if (!uploadResult.status || !uploadResult.data?.url) {
            toast.error(uploadResult.message || "Failed to upload file");
            return;
          }

          attachmentUrl = uploadResult.data.url;
        }

        const result = await createRebate({
          employeeId: data.employeeId,
          rebateNatureId: data.rebateNatureId,
          rebateAmount: parseFloat(data.rebateAmount),
          monthYear: data.monthYear,
          attachment: attachmentUrl,
          remarks: data.remarks || undefined,
        });

        if (result.status) {
          toast.success(result.message || "Rebate created successfully");
          router.push("/hr/payroll-setup/rebate/list");
        } else {
          toast.error(result.message || "Failed to create rebate");
        }
      } catch (error) {
        console.error("Error:", error);
        toast.error("Failed to create rebate");
      }
    });
  };

  // Get selected rebate nature to determine type
  const selectedRebateNatureId = form.watch("rebateNatureId");
  const selectedRebateNature = rebateNatures.find((rn) => rn.id === selectedRebateNatureId);
  const rebateType = selectedRebateNature?.type || "other";
  const amountLabel = rebateType === "fixed" ? "Rebate Amount" : "Actual Investment";

  // Group rebate natures by category
  const groupedRebateNatures = useMemo(() => {
    const fixedByCategory = new Map<string, RebateNature[]>();
    const otherNatures: RebateNature[] = [];

    rebateNatures.forEach((nature) => {
      if (nature.type === "fixed" && nature.category) {
        if (!fixedByCategory.has(nature.category)) {
          fixedByCategory.set(nature.category, []);
        }
        fixedByCategory.get(nature.category)!.push(nature);
      } else {
        otherNatures.push(nature);
      }
    });

    return { fixedByCategory, otherNatures };
  }, [rebateNatures]);

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <div className="mb-6">
        <Link href="/hr/payroll-setup/rebate/list">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card className="border-0 shadow-lg bg-card">
            <CardHeader className="pb-4">
              <CardTitle className="text-2xl font-bold">Create Rebate Form</CardTitle>
              <CardDescription className="text-base">
                Fill in the details to create a rebate record
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Department and Sub Department Row */}
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
                            form.setValue("employeeId", "");
                          }}
                          placeholder="Select Department (Optional)"
                          searchPlaceholder="Search department..."
                          emptyMessage="No departments found"
                          disabled={isPending || form.formState.isSubmitting}
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

              {/* First Row - 3 columns */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Employee */}
                <FormField
                  control={form.control}
                  name="employeeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
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
                            placeholder="Select Employee"
                            searchPlaceholder="Search employees..."
                            emptyMessage="No employees found"
                            disabled={isPending || form.formState.isSubmitting}
                          />
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Month - Year */}
                <FormField
                  control={form.control}
                  name="monthYear"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Month - Year <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <MonthYearPicker
                          value={field.value}
                          onChange={field.onChange}
                          disabled={isPending || form.formState.isSubmitting}
                          placeholder="Select month and year"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Rebate Nature */}
                <FormField
                  control={form.control}
                  name="rebateNatureId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Rebate Nature <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        {loadingRebateNatures ? (
                          <div className="h-10 bg-muted rounded-md animate-pulse" />
                        ) : (
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={isPending || form.formState.isSubmitting}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select Nature of Rebate" />
                            </SelectTrigger>
                            <SelectContent>
                              {/* Fixed rebate natures grouped by category */}
                              {Array.from(groupedRebateNatures.fixedByCategory.entries())
                                .sort(([catA], [catB]) => catA.localeCompare(catB))
                                .map(([category, natures]) => (
                                  <SelectGroup key={category}>
                                    <SelectLabel>{category}</SelectLabel>
                                    {natures
                                      .sort((a, b) => a.name.localeCompare(b.name))
                                      .map((nature) => (
                                        <SelectItem key={nature.id} value={nature.id}>
                                          {nature.name}
                                        </SelectItem>
                                      ))}
                                  </SelectGroup>
                                ))}

                              {/* Other rebate natures */}
                              {groupedRebateNatures.otherNatures.length > 0 && (
                                <SelectGroup>
                                  <SelectLabel>Other</SelectLabel>
                                  {groupedRebateNatures.otherNatures
                                    .sort((a, b) => a.name.localeCompare(b.name))
                                    .map((nature) => (
                                      <SelectItem key={nature.id} value={nature.id}>
                                        {nature.name}
                                      </SelectItem>
                                    ))}
                                </SelectGroup>
                              )}
                            </SelectContent>
                          </Select>
                        )}
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Second Row - 3 columns */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                {/* Rebate Amount / Actual Investment */}
                <FormField
                  control={form.control}
                  name="rebateAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {amountLabel} <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          disabled={isPending || form.formState.isSubmitting}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* File Upload */}
                <FormField
                  control={form.control}
                  name="file"
                  render={({ field: { onChange, value, ...field } }) => (
                    <FormItem>
                      <FormLabel>Attachment (Optional)</FormLabel>
                      <FormControl>
                        <Input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                          disabled={isPending || form.formState.isSubmitting}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            handleFileChange(file ? [file] : []);
                            onChange(file);
                          }}
                          {...field}
                          value={undefined}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Remarks */}
              <FormField
                control={form.control}
                name="remarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Remarks (Optional)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter any additional remarks..."
                        disabled={isPending || form.formState.isSubmitting}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Action Buttons */}
              <div className="flex justify-end gap-4 pt-4 border-t">
                <Button
                  type="button"
                  variant="default"
                  onClick={handleClearForm}
                  disabled={isPending || form.formState.isSubmitting}
                >
                  Clear Form
                </Button>
                <Button
                  type="submit"
                  disabled={isPending || form.formState.isSubmitting}
                >
                  {(isPending || form.formState.isSubmitting) ? (
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
      </Form>
    </div>
  );
}

