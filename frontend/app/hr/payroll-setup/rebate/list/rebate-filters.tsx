"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Autocomplete } from "@/components/ui/autocomplete";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import type { EmployeeDropdownOption } from "@/lib/actions/employee";
import type { Department, SubDepartment } from "@/lib/actions/department";

interface RebateFiltersProps {
  departments: Department[];
  subDepartments: SubDepartment[];
  employees: EmployeeDropdownOption[];
  loading?: boolean;
  loadingSubDepartments?: boolean;
  filters: {
    departmentId: string;
    subDepartmentId: string;
    employeeId: string;
  };
  onFiltersChange: (filters: {
    departmentId: string;
    subDepartmentId: string;
    employeeId: string;
  }) => void;
  onReset: () => void;
}

export function RebateFilters({
  departments,
  subDepartments,
  employees,
  loading = false,
  loadingSubDepartments = false,
  filters,
  onFiltersChange,
  onReset,
}: RebateFiltersProps) {
  const [isOpen, setIsOpen] = useState(true);

  const hasActiveFilters =
    filters.departmentId !== "all" ||
    filters.subDepartmentId !== "all" ||
    filters.employeeId !== "all";

  const handleFilterChange = (key: keyof typeof filters, value: string) => {
    const newFilters = { ...filters };

    if (key === "departmentId") {
      newFilters.departmentId = value;
      newFilters.subDepartmentId = "all";
      newFilters.employeeId = "all";
    } else if (key === "subDepartmentId") {
      newFilters.subDepartmentId = value;
      newFilters.employeeId = "all";
    } else {
      newFilters[key] = value;
    }

    onFiltersChange(newFilters);
  };

  return (
    <Card className="border shadow-sm">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Filters
                {hasActiveFilters && (
                  <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {
                      [
                        filters.departmentId !== "all",
                        filters.subDepartmentId !== "all",
                        filters.employeeId !== "all",
                      ].filter(Boolean).length
                    }
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                Filter rebate records by department, sub-department, or employee
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReset();
                  }}
                  className="h-8 px-2 text-xs"
                >
                  <X className="h-3 w-3 mr-1" />
                  Clear
                </Button>
              )}
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  {isOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </div>
          </div>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Department Filter */}
              <div className="space-y-2">
                <Label htmlFor="department-filter">Department</Label>
                {loading ? (
                  <div className="h-10 bg-muted rounded-md animate-pulse" />
                ) : (
                  <Autocomplete
                    options={[
                      { value: "all", label: "All Departments" },
                      ...departments.map((dept) => ({
                        value: dept.id,
                        label: dept.name,
                      })),
                    ]}
                    value={filters.departmentId}
                    onValueChange={(value) =>
                      handleFilterChange("departmentId", value || "all")
                    }
                    placeholder="Select Department"
                    searchPlaceholder="Search department..."
                    emptyMessage="No departments found"
                  />
                )}
              </div>

              {/* Sub Department Filter */}
              <div className="space-y-2">
                <Label htmlFor="sub-department-filter">Sub Department</Label>
                {loadingSubDepartments ? (
                  <div className="h-10 bg-muted rounded-md animate-pulse" />
                ) : (
                  <Autocomplete
                    options={[
                      { value: "all", label: "All Sub Departments" },
                      ...subDepartments.map((subDept) => ({
                        value: subDept.id,
                        label: subDept.name,
                      })),
                    ]}
                    value={filters.subDepartmentId}
                    onValueChange={(value) =>
                      handleFilterChange("subDepartmentId", value || "all")
                    }
                    placeholder={
                      filters.departmentId === "all"
                        ? "Select department first"
                        : "Select Sub Department"
                    }
                    searchPlaceholder="Search sub department..."
                    emptyMessage="No sub departments found"
                    disabled={
                      filters.departmentId === "all" ||
                      subDepartments.length === 0
                    }
                  />
                )}
              </div>

              {/* Employee Filter */}
              <div className="space-y-2">
                <Label htmlFor="employee-filter">
                  Employee <span className="text-destructive">*</span>
                </Label>
                {loading ? (
                  <div className="h-10 bg-muted rounded-md animate-pulse" />
                ) : (
                  <Autocomplete
                    options={[
                      { value: "all", label: "All Employees" },
                      ...employees.map((emp) => ({
                        value: emp.id,
                        label: `${emp.employeeName} (${emp.employeeId})`,
                      })),
                    ]}
                    value={filters.employeeId}
                    onValueChange={(value) =>
                      handleFilterChange("employeeId", value || "all")
                    }
                    placeholder="Select Employee"
                    searchPlaceholder="Search employee..."
                    emptyMessage="No employees found"
                  />
                )}
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

