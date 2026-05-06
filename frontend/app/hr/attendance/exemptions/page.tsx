"use client";

import { useState, useTransition, useEffect, startTransition, addTransitionType } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { getAllEmployeesForClearance } from "@/lib/actions/exit-clearance";
import type { Employee } from "@/lib/actions/exit-clearance";
import { createAttendanceExemption } from "@/lib/actions/attendance-exemption";
import { getDepartments, type Department, type SubDepartment } from "@/lib/actions/department";

const flagTypes = ["Late", "Absent", "Early Leave", "Missing Check-in", "Missing Check-out", "Other"];
const exemptionTypes = ["Medical Emergency", "Family Emergency", "Official Duty", "Approved Leave", "System Error", "Other"];

export default function AttendanceExemptionPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([]);

  const [formData, setFormData] = useState({
    employeeId: "",
    employeeName: "",
    department: "",
    subDepartment: "",
    attendanceDate: "",
    flagType: "",
    exemptionType: "",
    reason: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [employeesResult, departmentsResult] = await Promise.all([
          getAllEmployeesForClearance(),
          getDepartments(),
        ]);

        if (employeesResult.status && employeesResult.data) {
          setAllEmployees(employeesResult.data);
        } else {
          toast.error(employeesResult.message || "Failed to load employees");
        }

        if (departmentsResult.status && departmentsResult.data) {
          setDepartments(departmentsResult.data);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
        toast.error("Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const updateField = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Filter employees based on selected department
  const filteredEmployees = formData.department
    ? allEmployees.filter((emp) => emp.department === formData.department)
    : allEmployees;

  const handleEmployeeChange = (employeeId: string) => {
    const selected = allEmployees.find((e) => e.id === employeeId);
    if (selected) {
      setFormData((prev) => ({
        ...prev,
        employeeId: selected.id,
        employeeName: selected.employeeName,
        // Don't auto-fill department/subDepartment, let user select manually
      }));
    }
  };

  const handleDepartmentChange = (departmentName: string) => {
    // Clear employee selection if current employee doesn't belong to new department
    const currentEmployee = allEmployees.find((e) => e.id === formData.employeeId);
    const shouldClearEmployee = currentEmployee && currentEmployee.department !== departmentName;

    setFormData((prev) => ({
      ...prev,
      department: departmentName,
      subDepartment: "", // Clear sub-department when department changes
      ...(shouldClearEmployee && { employeeId: "", employeeName: "" }), // Clear employee if doesn't match
    }));

    // Find department and set its sub-departments
    const selectedDept = departments.find((d) => d.name === departmentName);
    if (selectedDept && selectedDept.subDepartments) {
      setSubDepartments(selectedDept.subDepartments);
    } else {
      setSubDepartments([]);
    }
  };

  const handleSubDepartmentChange = (subDepartmentName: string) => {
    setFormData((prev) => ({
      ...prev,
      subDepartment: subDepartmentName,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.employeeId || !formData.attendanceDate || !formData.flagType || !formData.exemptionType || !formData.reason.trim()) {
      toast.error("Please fill all required fields");
      return;
    }

    startTransition(async () => {
      try {
        const result = await createAttendanceExemption({
          employeeId: formData.employeeId,
          employeeName: formData.employeeName,
          department: formData.department || null,
          subDepartment: formData.subDepartment || null,
          attendanceDate: formData.attendanceDate,
          flagType: formData.flagType,
          exemptionType: formData.exemptionType,
          reason: formData.reason,
          approvalStatus: "pending",
        });

        if (result.status && result.data) {
          toast.success("Attendance exemption request submitted successfully");
          
          // Reset form
          setFormData({
            employeeId: "",
            employeeName: "",
            department: "",
            subDepartment: "",
            attendanceDate: "",
            flagType: "",
            exemptionType: "",
            reason: "",
          });
          
          // Redirect to list page
          startTransition(() => {
            addTransitionType("nav-back");
            router.push("/hr/attendance/exemptions-list");
          });
        } else {
          toast.error(result.message || "Failed to submit attendance exemption request");
        }
      } catch (error) {
        console.error("Error:", error);
        toast.error("Failed to submit attendance exemption request");
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto pb-10">
      <div className="mb-6">
        <Link href="/hr/attendance" transitionTypes={["nav-back"]}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Attendance
          </Button>
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Employee Information & Exemption Details */}
        <Card>
          <CardHeader>
            <CardTitle>Employee Information & Exemption Details</CardTitle>
            <CardDescription>Select employee and provide details for the attendance exemption request</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Department</Label>
              <Select
                value={formData.department}
                onValueChange={handleDepartmentChange}
                disabled={isPending || loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.name}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sub Department</Label>
              <Select
                value={formData.subDepartment}
                onValueChange={handleSubDepartmentChange}
                disabled={isPending || loading || !formData.department}
              >
                <SelectTrigger>
                  <SelectValue placeholder={formData.department ? "Select sub department" : "Select department first"} />
                </SelectTrigger>
                <SelectContent>
                  {subDepartments.length > 0 ? (
                    subDepartments.map((subDept) => (
                      <SelectItem key={subDept.id} value={subDept.name}>
                        {subDept.name}
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      {formData.department ? "No sub departments available" : "Select department first"}
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Employee <span className="text-red-500">*</span></Label>
              {loading ? (
                <div className="h-10 bg-muted rounded animate-pulse" />
              ) : (
                <Select
                  value={formData.employeeId}
                  onValueChange={handleEmployeeChange}
                  disabled={isPending || loading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.department ? "Select employee from department" : "Select employee"} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredEmployees.length > 0 ? (
                      filteredEmployees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.employeeName} ({e.employeeId})
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        {formData.department ? "No employees in this department" : "No employees available"}
                      </div>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label>Attendance Date <span className="text-red-500">*</span></Label>
              <DatePicker
                value={formData.attendanceDate}
                onChange={(value) => updateField("attendanceDate", value || "")}
                placeholder="Select attendance date"
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label>Flag Type <span className="text-red-500">*</span></Label>
              <Select
                value={formData.flagType}
                onValueChange={(value) => updateField("flagType", value)}
                disabled={isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select flag type" />
                </SelectTrigger>
                <SelectContent>
                  {flagTypes.map((flag) => (
                    <SelectItem key={flag} value={flag}>
                      {flag}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Exemption Type <span className="text-red-500">*</span></Label>
              <Select
                value={formData.exemptionType}
                onValueChange={(value) => updateField("exemptionType", value)}
                disabled={isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select exemption type" />
                </SelectTrigger>
                <SelectContent>
                  {exemptionTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Reason <span className="text-red-500">*</span></Label>
              <Textarea
                value={formData.reason}
                onChange={(e) => updateField("reason", e.target.value)}
                placeholder="Enter reason for attendance exemption..."
                rows={4}
                required
                disabled={isPending}
              />
            </div>

            <div className="flex gap-2 justify-end md:col-span-2 mt-4">
            

              <Button type="submit" disabled={isPending} size="sm">
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Submit Request
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setFormData({
                    employeeId: "",
                    employeeName: "",
                    department: "",
                    subDepartment: "",
                    attendanceDate: "",
                    flagType: "",
                    exemptionType: "",
                    reason: "",
                  })
                }
              >
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}

