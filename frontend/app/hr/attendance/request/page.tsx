"use client";

import { useState, useTransition, useEffect, startTransition, addTransitionType } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { createAttendanceRequestQuery } from "@/lib/actions/attendance-request-query";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAllEmployeesForClearance } from "@/lib/actions/exit-clearance";
import type { Employee } from "@/lib/actions/exit-clearance";
import { getDepartments, type Department, type SubDepartment } from "@/lib/actions/department";
import { useAuth } from "@/components/providers/auth-provider";

export default function AttendanceRequestQueryPage() {
  const router = useRouter();
  const { user, isAdmin } = useAuth();
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
    clockInTimeRequest: "",
    clockOutTimeRequest: "",
    breakIn: "",
    breakOut: "",
    query: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
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

  // Auto-select current employee for non-admins
  useEffect(() => {
    if (!isAdmin() && user?.employeeId && allEmployees.length > 0) {
      const currentEmployee = allEmployees.find(e => e.id === user.employeeId);
      if (currentEmployee) {
        setFormData(prev => ({
          ...prev,
          employeeId: currentEmployee.id,
          employeeName: currentEmployee.employeeName,
          department: currentEmployee.department || "",
          subDepartment: currentEmployee.subDepartment || ""
        }));
        
        // Also fetch sub-departments if department is set
        if (currentEmployee.department) {
           const dept = departments.find(d => d.name === currentEmployee.department);
           if (dept && dept.subDepartments) {
             setSubDepartments(dept.subDepartments);
           }
        }
      }
    }
  }, [user, isAdmin, allEmployees, departments]);

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

  const resetForm = () => {
    setFormData((prev) => ({
      ...prev,
      attendanceDate: "",
      clockInTimeRequest: "",
      clockOutTimeRequest: "",
      breakIn: "",
      breakOut: "",
      query: "",
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.attendanceDate || !formData.query) {
      toast.error("Please fill required fields");
      return;
    }
    startTransition(async () => {
      try {
        const result = await createAttendanceRequestQuery({
          employeeId: formData.employeeId || null,
          employeeName: formData.employeeName || null,
          department: formData.department || null,
          subDepartment: formData.subDepartment || null,
          attendanceDate: formData.attendanceDate,
          clockInTimeRequest: formData.clockInTimeRequest || null,
          clockOutTimeRequest: formData.clockOutTimeRequest || null,
          breakIn: formData.breakIn || null,
          breakOut: formData.breakOut || null,
          query: formData.query,
          approvalStatus: "pending",
        });

        if (result.status) {
          toast.success(result.message || "Attendance request query created successfully");
          // Redirect to request list page
          startTransition(() => {
            addTransitionType("nav-back");
            router.push("/hr/attendance/request-list");
          });
        } else {
          toast.error(result.message || "Failed to create attendance request query");
        }
      } catch (error) {
        console.error("Error:", error);
        toast.error("Failed to create attendance request query");
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto pb-10">
      <div className="mb-6">
        <Link href="/hr/attendance/request-list" transitionTypes={["nav-back"]}>
          <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Back to List</Button>
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Attendance Request Query Information */}
        <Card>
          <CardHeader>
            <CardTitle>Attendance Request Query</CardTitle>
            <CardDescription>Submit your attendance time correction request</CardDescription>
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
              <Label>Employee Name <span className="text-red-500">*</span></Label>
              {loading ? (
                <div className="h-10 bg-muted rounded animate-pulse" />
              ) : (
                <Select 
                  value={formData.employeeId} 
                  onValueChange={handleEmployeeChange} 
                  disabled={isPending || loading || (!isAdmin() && !!user?.employeeId)}
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
                onChange={(value: string) => updateField("attendanceDate", value)}
                disabled={isPending}
                placeholder="Select attendance date"
              />
            </div>
            <div className="space-y-2">
              <Label>Clock Inn Time Request To Change <span className="text-red-500">*</span></Label>
              <TimePicker
                value={formData.clockInTimeRequest}
                onChange={(value: string) => updateField("clockInTimeRequest", value)}
                disabled={isPending}
                placeholder="Select clock in time"
              />
            </div>
            <div className="space-y-2">
              <Label>Clock Out Time Request To Change <span className="text-red-500">*</span></Label>
              <TimePicker
                value={formData.clockOutTimeRequest}
                onChange={(value: string) => updateField("clockOutTimeRequest", value)}
                disabled={isPending}
                placeholder="Select clock out time"
              />
            </div>
            <div className="space-y-2">
              <Label>Break In <span className="text-red-500">*</span></Label>
              <TimePicker
                value={formData.breakIn}
                onChange={(value: string) => updateField("breakIn", value)}
                disabled={isPending}
                placeholder="Select break in time"
              />
            </div>
            <div className="space-y-2">
              <Label>Break Out <span className="text-red-500">*</span></Label>
              <TimePicker
                value={formData.breakOut}
                onChange={(value: string) => updateField("breakOut", value)}
                disabled={isPending}
                placeholder="Select break out time"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Query <span className="text-red-500">*</span></Label>
              <Textarea
                value={formData.query}
                onChange={(e) => updateField("query", e.target.value)}
                placeholder="Enter your query or reason for the attendance correction..."
                rows={4}
                disabled={isPending}
                required
              />
  <div className="flex space-x-4 mt-4 justify-end">
  <Button type="submit" disabled={isPending} className="w-32">
    {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
    Submit Request
  </Button>
  <Button type="button" variant="outline" className="w-32" onClick={() => {
    startTransition(() => {
      addTransitionType("nav-back");
      router.back();
    });
  }}>
    Cancel
  </Button>
</div>


            </div>
          </CardContent>
        </Card>

        {/* Submit */}
      
      </form>
    </div>
  );
}

