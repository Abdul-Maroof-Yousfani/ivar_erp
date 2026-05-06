"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Autocomplete } from "@/components/ui/autocomplete";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import type { EmployeeDropdownOption } from "@/lib/actions/employee";
import type { Department, SubDepartment } from "@/lib/actions/department";
import type { DeductionHead } from "@/lib/actions/deduction";

interface DeductionFiltersProps {
  departments: Department[];
  subDepartments: SubDepartment[];
  employees: EmployeeDropdownOption[];
  deductionHeads: DeductionHead[];
  loading?: boolean;
  loadingSubDepartments?: boolean;
  filters: {
    departmentId: string;
    subDepartmentId: string;
    employeeId: string;
    deductionHeadId: string;
    status: string;
    month: string;
    year: string;
  };
  onFiltersChange: (filters: {
    departmentId: string;
    subDepartmentId: string;
    employeeId: string;
    deductionHeadId: string;
    status: string;
    month: string;
    year: string;
  }) => void;
  onReset: () => void;
}

export function DeductionFilters({
  departments,
  subDepartments,
  employees,
  deductionHeads,
  loading = false,
  loadingSubDepartments = false,
  filters,
  onFiltersChange,
  onReset,
}: DeductionFiltersProps) {
  const [isOpen, setIsOpen] = useState(true);

  const hasActiveFilters =
    filters.departmentId !== "all" ||
    filters.subDepartmentId !== "all" ||
    filters.employeeId !== "all" ||
    filters.deductionHeadId !== "all" ||
    filters.status !== "all" ||
    filters.month !== "all" ||
    filters.year !== "all";

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
                        filters.deductionHeadId !== "all",
                        filters.status !== "all",
                        filters.month !== "all",
                        filters.year !== "all",
                      ].filter(Boolean).length
                    }
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                Filter deduction records by department, employee, type, status, month, or year
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Department Filter */}
              <div className="space-y-2">
                <Label htmlFor="department-filter">Department</Label>
                {loading ? (
                  <div className="h-10 bg-muted rounded-md animate-pulse" />
                ) : (
                  <Autocomplete
                    id="department-filter"
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
                    id="sub-department-filter"
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
                    disabled={filters.departmentId === "all" || subDepartments.length === 0}
                  />
                )}
              </div>

              {/* Employee Filter */}
              <div className="space-y-2">
                <Label htmlFor="employee-filter">Employee</Label>
                {loading ? (
                  <div className="h-10 bg-muted rounded-md animate-pulse" />
                ) : (
                  <Autocomplete
                    id="employee-filter"
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

              {/* Deduction Type Filter */}
              <div className="space-y-2">
                <Label htmlFor="deduction-type-filter">Deduction Type</Label>
                {loading ? (
                  <div className="h-10 bg-muted rounded-md animate-pulse" />
                ) : (
                  <Autocomplete
                    id="deduction-type-filter"
                    options={[
                      { value: "all", label: "All Deduction Types" },
                      ...deductionHeads.map((head) => ({
                        value: head.id,
                        label: head.name,
                      })),
                    ]}
                    value={filters.deductionHeadId}
                    onValueChange={(value) =>
                      handleFilterChange("deductionHeadId", value || "all")
                    }
                    placeholder="Select Deduction Type"
                    searchPlaceholder="Search deduction type..."
                    emptyMessage="No deduction types found"
                  />
                )}
              </div>

              {/* Status Filter */}
              <div className="space-y-2">
                <Label htmlFor="status-filter">Status</Label>
                <Autocomplete
                  id="status-filter"
                  options={[
                    { value: "all", label: "All Status" },
                    { value: "active", label: "Active" },
                    { value: "inactive", label: "Inactive" },
                    { value: "cancelled", label: "Cancelled" },
                  ]}
                  value={filters.status}
                  onValueChange={(value) =>
                    handleFilterChange("status", value || "all")
                  }
                  placeholder="Select Status"
                  searchPlaceholder="Search status..."
                  emptyMessage="No status found"
                />
              </div>

              {/* Month Filter */}
              <div className="space-y-2">
                <Label htmlFor="month-filter">Month</Label>
                <Autocomplete
                  id="month-filter"
                  options={[
                    { value: "all", label: "All Months" },
                    { value: "01", label: "January" },
                    { value: "02", label: "February" },
                    { value: "03", label: "March" },
                    { value: "04", label: "April" },
                    { value: "05", label: "May" },
                    { value: "06", label: "June" },
                    { value: "07", label: "July" },
                    { value: "08", label: "August" },
                    { value: "09", label: "September" },
                    { value: "10", label: "October" },
                    { value: "11", label: "November" },
                    { value: "12", label: "December" },
                  ]}
                  value={filters.month}
                  onValueChange={(value) =>
                    handleFilterChange("month", value || "all")
                  }
                  placeholder="Select Month"
                  searchPlaceholder="Search month..."
                  emptyMessage="No month found"
                />
              </div>

              {/* Year Filter */}
              <div className="space-y-2">
                <Label htmlFor="year-filter">Year</Label>
                <Autocomplete
                  id="year-filter"
                  options={[
                    { value: "all", label: "All Years" },
                    ...Array.from({ length: 10 }, (_, i) => {
                      const year = new Date().getFullYear() - i;
                      return { value: year.toString(), label: year.toString() };
                    }),
                  ]}
                  value={filters.year}
                  onValueChange={(value) =>
                    handleFilterChange("year", value || "all")
                  }
                  placeholder="Select Year"
                  searchPlaceholder="Search year..."
                  emptyMessage="No year found"
                />
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
