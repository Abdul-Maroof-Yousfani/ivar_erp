"use client";

import { useRouter } from "next/navigation";
import { useState, useMemo } from "react";
import DataTable from "@/components/common/data-table";
import { columns } from "./columns";
import type { Employee } from "@/lib/actions/employee";
import type { Department } from "@/lib/actions/department";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import Link from "next/link";

export interface AttendanceExemption {
  id: string;
  employeeId?: string | null;
  employeeName?: string | null;
  department?: string | null;
  subDepartment?: string | null;
  attendanceDate: string;
  flagType: string;
  exemptionType: string;
  reason: string;
  approvalStatus: string;
  createdAt?: string;
}

export interface AttendanceExemptionRow extends AttendanceExemption {
  sNo: number;
}

interface AttendanceExemptionsListProps {
  initialExemptions: AttendanceExemption[];
  employees: Employee[];
  departments: Department[];
  newItemId?: string;
}

export function AttendanceExemptionsList({
  initialExemptions,
  employees,
  departments: masterDepartments,
  newItemId,
}: AttendanceExemptionsListProps) {
  const router = useRouter();
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("all");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedSubDepartment, setSelectedSubDepartment] = useState<string>("all");

  // Get all departments from master list
  const departmentOptions = useMemo(() => {
    const deptNames = masterDepartments.map((dept) => dept.name).sort();
    return [
      { value: "all", label: "All Departments" },
      ...deptNames.map((name) => ({ value: name, label: name })),
    ];
  }, [masterDepartments]);

  // Get sub-departments based on selected department or all sub-departments
  const subDepartmentOptions = useMemo(() => {
    const subDeptSet = new Set<string>();
    
    if (selectedDepartment === "all") {
      // If "All Departments" is selected, show all sub-departments
      masterDepartments.forEach((dept) => {
        dept.subDepartments?.forEach((subDept) => {
          subDeptSet.add(subDept.name);
        });
      });
    } else {
      // If a specific department is selected, show only its sub-departments
      const selectedDept = masterDepartments.find((d) => d.name === selectedDepartment);
      selectedDept?.subDepartments?.forEach((subDept) => {
        subDeptSet.add(subDept.name);
      });
    }
    
    // Also add sub-departments from exemptions and employees for completeness
    initialExemptions.forEach((ex) => {
      if (ex.subDepartment) subDeptSet.add(ex.subDepartment);
    });
    employees.forEach((emp) => {
      if (emp.subDepartment) subDeptSet.add(emp.subDepartment);
    });

    const subDeptNames = Array.from(subDeptSet).sort();
    return [
      { value: "all", label: "All Sub Departments" },
      ...subDeptNames.map((name) => ({ value: name, label: name })),
    ];
  }, [masterDepartments, selectedDepartment, initialExemptions, employees]);

  // Handle employee selection - auto-populate department and sub-department
  const handleEmployeeChange = (employeeId: string) => {
    setSelectedEmployeeId(employeeId);
    if (employeeId === "all") {
      setSelectedDepartment("all");
      setSelectedSubDepartment("all");
    } else {
      const selectedEmployee = employees.find((e) => e.id === employeeId);
      if (selectedEmployee) {
        setSelectedDepartment(selectedEmployee.department || "all");
        setSelectedSubDepartment(selectedEmployee.subDepartment || "all");
      }
    }
  };

  // Handle department change - reset sub-department if needed
  const handleDepartmentChange = (department: string) => {
    setSelectedDepartment(department);
    // Reset sub-department when department changes
    setSelectedSubDepartment("all");
  };

  // Filter exemptions based on selected filters
  const filteredExemptions = useMemo(() => {
    let filtered = initialExemptions;

    if (selectedEmployeeId !== "all") {
      const selectedEmployee = employees.find((e) => e.id === selectedEmployeeId);
      if (selectedEmployee) {
        filtered = filtered.filter((ex) => ex.employeeId === selectedEmployee.employeeId);
      }
    }

    if (selectedDepartment !== "all") {
      filtered = filtered.filter((ex) => ex.department === selectedDepartment);
    }

    if (selectedSubDepartment !== "all") {
      filtered = filtered.filter((ex) => ex.subDepartment === selectedSubDepartment);
    }

    return filtered;
  }, [initialExemptions, selectedEmployeeId, selectedDepartment, selectedSubDepartment, employees]);

  // Transform data for DataTable
  const data: AttendanceExemptionRow[] = filteredExemptions.map((exemption, index) => ({
    ...exemption,
    id: exemption.id,
    sNo: index + 1,
  }));

  const handleToggle = () => {
    router.push("/hr/attendance/exemptions");
  };

  // Prepare filter options
  const employeeOptions = [
    { value: "all", label: "All Employees" },
    ...employees.map((emp) => ({
      value: emp.id,
      label: `${emp.employeeName} (${emp.employeeId})`,
    })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Attendance Exemptions</h2>
          <p className="text-muted-foreground">Manage employee attendance exemption requests</p>
        </div>
        
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter exemptions by employee, department, or sub-department</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Employee ID</Label>
              <Select value={selectedEmployeeId} onValueChange={handleEmployeeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {employeeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={selectedDepartment} onValueChange={handleDepartmentChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {departmentOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sub Department</Label>
              <Select value={selectedSubDepartment} onValueChange={setSelectedSubDepartment}>
                <SelectTrigger>
                  <SelectValue placeholder="Select sub-department" />
                </SelectTrigger>
                <SelectContent>
                  {subDepartmentOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <DataTable
        columns={columns}
        data={data}
        toggleAction={handleToggle}
        actionText="Create Exemption"
        newItemId={newItemId}
        searchFields={[
          { key: "employeeName", label: "Employee" },
          { key: "reason", label: "Reason" },
        ]}
        tableId="attendance-exemptions-list"
      />
    </div>
  );
}

