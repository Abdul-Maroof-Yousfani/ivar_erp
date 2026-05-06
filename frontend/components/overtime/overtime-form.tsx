"use client";

import { useState, useEffect } from "react";
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
import { Autocomplete } from "@/components/ui/autocomplete";
import { Loader2 } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { toast } from "sonner";
import type { OvertimeType, OvertimeRequest } from "@/lib/actions/overtime";
import type { EmployeeDropdownOption } from "@/lib/actions/employee";
import type { Department, SubDepartment } from "@/lib/actions/department";
import { getSubDepartmentsByDepartment } from "@/lib/actions/department";

interface OvertimeFormData {
  employeeId: string;
  overtimeType: OvertimeType;
  title: string;
  description: string;
  date: string;
  weekdayOvertimeHours: number;
  holidayOvertimeHours: number;
}

interface OvertimeFormProps {
  mode: "create" | "edit";
  initialEmployees: EmployeeDropdownOption[];
  initialDepartments: Department[];
  initialData?: OvertimeRequest;
  onSubmit: (data: OvertimeFormData) => Promise<void>;
  isPending?: boolean;
}

export function OvertimeForm({
  mode,
  initialEmployees,
  initialDepartments = [],
  initialData,
  onSubmit,
  isPending = false,
}: OvertimeFormProps) {
  const [departments] = useState<Department[]>(initialDepartments || []);
  const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([]);
  const [loadingSubDepartments, setLoadingSubDepartments] = useState(false);
  // Format date for DatePicker (YYYY-MM-DD format)
  const getFormattedDate = (dateString: string | undefined) => {
    if (!dateString) return "";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "";
      return date.toISOString().split("T")[0];
    } catch {
      return "";
    }
  };

  const [formData, setFormData] = useState({
    department: "all",
    subDepartment: "all",
    employeeId: initialData?.employeeId || "",
    overtimeType: (initialData?.overtimeType || "") as OvertimeType | "",
    title: initialData?.title || "",
    description: initialData?.description || "",
    date: getFormattedDate(initialData?.date),
    weekdayOvertimeHours: initialData?.weekdayOvertimeHours?.toString() || "0",
    holidayOvertimeHours: initialData?.holidayOvertimeHours?.toString() || "0",
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

  useEffect(() => {
    if (initialData) {
      setFormData({
        department: "all",
        subDepartment: "all",
        employeeId: initialData.employeeId || "",
        overtimeType: (initialData.overtimeType || "") as OvertimeType | "",
        title: initialData.title || "",
        description: initialData.description || "",
        date: getFormattedDate(initialData.date),
        weekdayOvertimeHours: initialData.weekdayOvertimeHours?.toString() || "0",
        holidayOvertimeHours: initialData.holidayOvertimeHours?.toString() || "0",
      });
    }
  }, [initialData]);

  // Filter employees based on department and sub-department
  const filteredEmployees = initialEmployees.filter((emp) => {
    if (formData.department && formData.department !== "all") {
      if (emp.departmentId !== formData.department) return false;
    }
    if (formData.subDepartment && formData.subDepartment !== "all") {
      if (emp.subDepartmentId !== formData.subDepartment) return false;
    }
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.employeeId) {
      toast.error("Please select an employee");
      return;
    }

    if (!formData.overtimeType) {
      toast.error("Please select overtime type");
      return;
    }

    if (!formData.title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    if (!formData.description.trim()) {
      toast.error("Please enter a description");
      return;
    }

    if (!formData.date || !formData.date.trim()) {
      toast.error("Please select a date");
      return;
    }

    const weekdayHours = parseFloat(formData.weekdayOvertimeHours);
    const holidayHours = parseFloat(formData.holidayOvertimeHours);

    if (isNaN(weekdayHours) || weekdayHours < 0) {
      toast.error("Please enter valid weekday overtime hours");
      return;
    }

    if (isNaN(holidayHours) || holidayHours < 0) {
      toast.error("Please enter valid holiday overtime hours");
      return;
    }

    if (weekdayHours === 0 && holidayHours === 0) {
      toast.error("Please enter at least one overtime hour (weekday or holiday)");
      return;
    }

    await onSubmit({
      employeeId: formData.employeeId,
      overtimeType: formData.overtimeType as OvertimeType,
      title: formData.title.trim(),
      description: formData.description.trim(),
      date: formData.date,
      weekdayOvertimeHours: weekdayHours,
      holidayOvertimeHours: holidayHours,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="border-0 shadow-lg bg-card">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl font-bold">
            {mode === "create" ? "Overtime Request" : "Edit Overtime Request"}
          </CardTitle>
          <CardDescription className="text-base">
            {mode === "create"
              ? "Fill in the details to create an overtime request"
              : "Update the details of the overtime request"}
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
                onValueChange={(value) =>
                  setFormData((prev) => ({
                    ...prev,
                    department: value,
                    subDepartment: "all",
                  }))
                }
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
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, subDepartment: value || "all" }))
                }
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

            {/* Overtime Type */}
            <div className="space-y-2">
              <Label htmlFor="overtimeType">
                Overtime Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.overtimeType}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, overtimeType: value as OvertimeType }))
                }
                disabled={isPending}
              >
                <SelectTrigger id="overtimeType">
                  <SelectValue placeholder="Select One" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekday">Weekday Overtime</SelectItem>
                  <SelectItem value="holiday">Holiday Overtime</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Second Row - Employee */}
          <div className="space-y-2">
            <Label htmlFor="employee">
              Employee <span className="text-destructive">*</span>
            </Label>
            <Autocomplete
              options={filteredEmployees.map((e) => ({
                value: e.id,
                label: `${e.employeeName} (${e.employeeId})`,
              }))}
              value={formData.employeeId}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, employeeId: value || "" }))
              }
              placeholder="Select employee"
              disabled={isPending}
            />
          </div>

          {/* Third Row - Description full width */}
          <div className="space-y-2">
            <Label htmlFor="description">
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, description: e.target.value }))
              }
              placeholder="Enter description"
              disabled={isPending}
              rows={4}
              required
            />
          </div>

          {/* Fourth Row - 2 columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="Title"
                disabled={isPending}
                required
              />
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="date">
                Date <span className="text-destructive">*</span>
              </Label>
              <DatePicker
                value={formData.date}
                onChange={(value) =>
                  setFormData((prev) => ({ ...prev, date: value }))
                }
                disabled={isPending}
                placeholder="mm/dd/yyyy"
              />
            </div>
          </div>

          {/* Fourth Row - 2 columns */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Weekday Overtime Hours */}
            <div className="space-y-2">
              <Label htmlFor="weekdayOvertimeHours">
                Weekday Overtime Hours <span className="text-destructive">*</span>
              </Label>
              <Input
                id="weekdayOvertimeHours"
                type="number"
                step="0.01"
                min="0"
                value={formData.weekdayOvertimeHours}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, weekdayOvertimeHours: e.target.value }))
                }
                placeholder="0"
                disabled={isPending}
                required
              />
            </div>

            {/* Holiday Overtime Hours */}
            <div className="space-y-2">
              <Label htmlFor="holidayOvertimeHours">
                Holiday Overtime Hours <span className="text-destructive">*</span>
              </Label>
              <Input
                id="holidayOvertimeHours"
                type="number"
                step="0.01"
                min="0"
                value={formData.holidayOvertimeHours}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, holidayOvertimeHours: e.target.value }))
                }
                placeholder="0"
                disabled={isPending}
                required
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-4 border-t">
            <Button type="submit" disabled={isPending} size="lg">
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {mode === "create" ? "Submitting..." : "Updating..."}
                </>
              ) : (
                mode === "create" ? "Submit" : "Update"
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

