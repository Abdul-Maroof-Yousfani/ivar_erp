"use client";

import { useState, useMemo } from "react";
import DataTable from "@/components/common/data-table";
import { columns, AttendanceRequestQueryRow } from "./columns";
import { useAuth } from "@/components/providers/auth-provider";
import { AttendanceRequestQuery } from "@/lib/actions/attendance-request-query";
import type { Employee } from "@/lib/actions/exit-clearance";
import type { Department } from "@/lib/actions/department";

interface AttendanceRequestQueryListProps {
  initialQueries: AttendanceRequestQuery[];
  employees: Employee[];
  departments: Department[];
  newItemId?: string;
}

export function AttendanceRequestQueryList({
  initialQueries,
  employees,
  departments: allDepartments,
  newItemId,
}: AttendanceRequestQueryListProps) {
  const { isAdmin } = useAuth();
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");

  // Get unique departments from all sources
  const departments = useMemo(() => {
    const deptSet = new Set<string>();
    
    // Add all departments from backend
    allDepartments.forEach((dept) => {
      if (dept.name) deptSet.add(dept.name);
    });
    
    // Add departments from employees (in case of name mismatches)
    employees.forEach((emp) => {
      if (emp.department) deptSet.add(emp.department);
    });
    
    // Add departments from requests (in case employee is removed but request exists)
    initialQueries.forEach((query) => {
      if (query.department) deptSet.add(query.department);
    });
    
    return Array.from(deptSet).sort();
  }, [allDepartments, employees, initialQueries]);

  // Filter employees based on selected department
  const filteredEmployees = useMemo(() => {
    if (selectedDepartment === "all") {
      return employees;
    }
    return employees.filter((emp) => emp.department === selectedDepartment);
  }, [employees, selectedDepartment]);

  // Handle filter changes from DataTable
  const handleFilterChange = (key: string, value: string) => {
    if (key === "department") {
      setSelectedDepartment(value);
    }
  };

  // Transform data for DataTable
  const data: AttendanceRequestQueryRow[] = initialQueries.map((query, index) => ({
    ...query,
    id: query.id,
    sNo: index + 1,
  }));

  // Prepare filter options for DataTable
  // Department filter options (DataTable will add "All Department" automatically)
  const departmentOptions = departments.map((dept) => ({ value: dept, label: dept }));

  // Employee filter options - filtered by selected department (DataTable will add "All Employee" automatically)
  const employeeOptions = useMemo(() => {
    return filteredEmployees.map((emp) => ({
      value: emp.id,
      label: `${emp.employeeName} (${emp.employeeId})`,
    }));
  }, [filteredEmployees]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Attendance Request Queries</h2>
          <p className="text-muted-foreground">Manage employee attendance correction requests</p>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data}
        newItemId={newItemId}
        searchFields={[
          { key: "employeeName", label: "Employee" },
          { key: "query", label: "Query" },
          { key: "department", label: "Department" },
          { key: "subDepartment", label: "Sub Department" },
        ]}
        filters={isAdmin() ? [
          {
            key: "department",
            label: "Department",
            options: departmentOptions,
          },
          {
            key: "employeeId",
            label: "Employee",
            options: employeeOptions,
          }
        ] : []}
        onFilterChange={handleFilterChange}
        resetFilterKey={selectedDepartment}
        tableId="attendance-request-query-list"
      />
    </div>
  );
}

