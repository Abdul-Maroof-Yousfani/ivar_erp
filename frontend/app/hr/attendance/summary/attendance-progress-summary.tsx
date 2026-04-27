"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useMemo, useEffect, startTransition, addTransitionType } from "react";
import DataTable from "@/components/common/data-table";
import { columns } from "./columns";
import type { AttendanceProgressRow } from "./columns";
import type { Employee } from "@/lib/actions/employee";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Autocomplete } from "@/components/ui/autocomplete";
import { DateRangePicker, DateRange } from "@/components/ui/date-range-picker";
import { type Department } from "@/lib/actions/department";
import {
  getSubDepartmentsByDepartment,
  type SubDepartment,
} from "@/lib/actions/department";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown } from "lucide-react";
import type { AttendanceProgress } from "@/lib/actions/attendance";
import { MultiSelect } from "@/components/ui/multi-select";
import { useAuth } from "@/components/providers/auth-provider";
import { DirectionalTransition } from "@/components/layouts/directional-transition";

interface AttendanceProgressSummaryProps {
  initialData: AttendanceProgress[];
  employees: Employee[];
  departments: Department[];
  newItemId?: string;
}

// Column selection options - defined outside component as constant
const COLUMN_OPTIONS = [
  { value: "sNo", label: "S.no" },
  { value: "employee", label: "Employee" },
  { value: "empDetail", label: "Emp Detail" },
  { value: "days", label: "Days" },
  { value: "scheduleDays", label: "Schedule Days" },
  { value: "offDays", label: "Off Days" },
  { value: "present", label: "Present" },
  { value: "presentOnHoliday", label: "Present On Holiday" },
  { value: "leaves", label: "Leaves" },
  { value: "absents", label: "Absents" },
  { value: "late", label: "Late" },
  { value: "halfDay", label: "Half Day" },
  { value: "shortDays", label: "Short Days" },
  { value: "scheduleTime", label: "Schedule Time" },
  { value: "actualWorkedTime", label: "Actual Worked Time" },
  { value: "breakTime", label: "Break Time" },
  { value: "absentTime", label: "Absent Time" },
  { value: "overtimeBeforeTime", label: "Overtime Before Time" },
  { value: "overtimeAfterTime", label: "Overtime After Time" },
  { value: "shortExcessTime", label: "Short Excess Time" },
] as const;

export function AttendanceProgressSummary({
  initialData,
  employees,
  departments: initialDepartments,
  newItemId,
}: AttendanceProgressSummaryProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAdmin } = useAuth();

  // Initialize from URL params or defaults
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>(() => {
    const employeeId = searchParams.get("employeeId");
    return employeeId ? employeeId.split(",") : [];
  });
  const [selectedDepartment, setSelectedDepartment] = useState<string>(
    searchParams.get("departmentId") || "all"
  );
  const [selectedSubDepartment, setSelectedSubDepartment] = useState<string>(
    searchParams.get("subDepartmentId") || "all"
  );
  const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([]);
  const [loadingSubDepartments, setLoadingSubDepartments] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(
    COLUMN_OPTIONS.map((col) => col.value)
  );
  const [columnPopoverOpen, setColumnPopoverOpen] = useState(false);

  const getInitialDateRange = (): DateRange => {
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    return {
      from: dateFrom
        ? new Date(dateFrom)
        : new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      to: dateTo ? new Date(dateTo) : new Date(),
    };
  };

  const [dateRange, setDateRange] = useState<DateRange>(getInitialDateRange());

  // Handle user-specific view restriction
  useEffect(() => {
    if (user && !isAdmin() && user.employeeId) {
        // If regular user (not admin), force their employee ID
        setSelectedEmployeeIds([user.employeeId]);
        setSelectedDepartment("all");
        setSelectedSubDepartment("all");
    }
  }, [user, isAdmin]);

  // Update URL params when filters change to trigger server refetch
  const updateFilters = (updates: {
    employeeIds?: string[];
    departmentId?: string;
    subDepartmentId?: string;
    dateFrom?: Date;
    dateTo?: Date;
  }) => {
    const params = new URLSearchParams(searchParams.toString());

    if (updates.employeeIds !== undefined) {
      if (updates.employeeIds.length === 0) {
        params.delete("employeeId");
      } else {
        params.set("employeeId", updates.employeeIds.join(","));
      }
    }

    if (updates.departmentId !== undefined) {
      if (updates.departmentId === "all") {
        params.delete("departmentId");
      } else {
        params.set("departmentId", updates.departmentId);
      }
    }

    if (updates.subDepartmentId !== undefined) {
      if (updates.subDepartmentId === "all") {
        params.delete("subDepartmentId");
      } else {
        params.set("subDepartmentId", updates.subDepartmentId);
      }
    }

    if (updates.dateFrom) {
      params.set("dateFrom", updates.dateFrom.toISOString());
    }

    if (updates.dateTo) {
      params.set("dateTo", updates.dateTo.toISOString());
    }

    startTransition(() => {
      addTransitionType("nav-forward");
      router.push(`/hr/attendance/summary?${params.toString()}`);
    });
  };

  // Fetch sub-departments when department changes
  useEffect(() => {
    if (selectedDepartment === "all" || !selectedDepartment) {
      setSubDepartments([]);
      setSelectedSubDepartment("all");
      return;
    }

    const fetchSubDepartments = async () => {
      try {
        setLoadingSubDepartments(true);
        const result = await getSubDepartmentsByDepartment(selectedDepartment);
        if (result.status && result.data) {
          setSubDepartments(result.data);
        }
      } catch (error) {
        console.error("Error fetching sub-departments:", error);
      } finally {
        setLoadingSubDepartments(false);
      }
    };

    fetchSubDepartments();
  }, [selectedDepartment]);

  // Filter employees based on department/sub-department selection
  const filteredEmployeeOptions = useMemo(() => {
    let result = employees;

    if (selectedDepartment !== "all") {
      const dept = initialDepartments.find((d) => d.id === selectedDepartment);
      if (dept) {
        result = result.filter(
          (emp) =>
            emp.departmentName === dept.name ||
            emp.department === dept.name ||
            emp.department === selectedDepartment
        );
      }
    }

    if (selectedSubDepartment !== "all") {
      const subDept = subDepartments.find((sd) => sd.id === selectedSubDepartment);
      if (subDept) {
        result = result.filter(
          (emp) =>
            emp.subDepartmentName === subDept.name ||
            emp.subDepartment === subDept.name ||
            emp.subDepartment === selectedSubDepartment
        );
      }
    }

    return result.map((emp) => ({
      value: emp.id,
      label: emp.employeeName,
      description: `${emp.employeeId}${emp.departmentName ? ` • ${emp.departmentName}` : ""}`,
    }));
  }, [employees, selectedDepartment, selectedSubDepartment, initialDepartments, subDepartments]);

  // Filter data based on selected filters
  const filteredData = useMemo(() => {
    let filtered = initialData;

    if (selectedEmployeeIds.length > 0) {
      const selectedEmployeeIdValues = selectedEmployeeIds.map((id) => {
        const emp = employees.find((e) => e.id === id);
        return emp?.employeeId;
      }).filter(Boolean);
      
      filtered = filtered.filter((item) =>
        selectedEmployeeIdValues.includes(item.employeeId)
      );
    }

    if (selectedDepartment !== "all") {
      const selectedDept = initialDepartments.find(
        (d) => d.id === selectedDepartment
      );
      if (selectedDept) {
        filtered = filtered.filter(
          (item) => item.department === selectedDept.id
        );
      }
    }

    if (selectedSubDepartment !== "all" && selectedSubDepartment) {
      filtered = filtered.filter(
        (item) => item.subDepartment === selectedSubDepartment
      );
    }

    return filtered;
  }, [
    initialData,
    selectedEmployeeIds,
    selectedDepartment,
    selectedSubDepartment,
    employees,
    initialDepartments,
  ]);

  // Transform data for DataTable
  const data: AttendanceProgressRow[] = filteredData.map((item, index) => ({
    ...item,
    id: item.id || `row-${index}`,
    sNo: index + 1,
  }));
  console.log(data);
  // Prepare filter options
  const departmentOptions = [
    { value: "all", label: "All Departments" },
    ...initialDepartments.map((dept) => ({
      value: dept.id,
      label: dept.name,
    })),
  ];

  const subDepartmentOptions = [
    { value: "all", label: "All Sub Departments" },
    ...subDepartments.map((subDept) => ({
      value: subDept.id,
      label: subDept.name,
    })),
  ];

  const handleEmployeeChange = (newIds: string[]) => {
    setSelectedEmployeeIds(newIds);
    updateFilters({ employeeIds: newIds });
  };

    <DirectionalTransition>
      <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            View Employee Attendance Progress Summary
          </h2>
          <p className="text-muted-foreground">
            View detailed attendance progress for employees
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {isAdmin() && (
              <>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Autocomplete
                    options={departmentOptions}
                    value={selectedDepartment}
                    onValueChange={(value) => {
                      setSelectedDepartment(value || "all");
                      setSelectedSubDepartment("all");
                      updateFilters({ departmentId: value || "all" });
                    }}
                    placeholder="All Departments"
                    searchPlaceholder="Search department..."
                    emptyMessage="No departments found"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Sub Department</Label>
                  <Autocomplete
                    options={subDepartmentOptions}
                    value={selectedSubDepartment}
                    onValueChange={(value) => {
                      const newValue = value || "all";
                      setSelectedSubDepartment(newValue);
                      updateFilters({ subDepartmentId: newValue });
                    }}
                    placeholder={
                      selectedDepartment === "all"
                        ? "All Sub Departments"
                        : "Select sub department"
                    }
                    searchPlaceholder="Search sub department..."
                    emptyMessage="No sub departments found"
                    disabled={selectedDepartment === "all" || loadingSubDepartments}
                    isLoading={loadingSubDepartments}
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label>Employees</Label>
                  <MultiSelect
                    options={filteredEmployeeOptions}
                    value={selectedEmployeeIds}
                    onValueChange={handleEmployeeChange}
                    placeholder="All Employees"
                    searchPlaceholder="Search employees..."
                    emptyMessage="No employees found"
                  />
                </div>
              </>
            )}

            <div className="space-y-2 md:col-span-2">
              <Label>Date Range</Label>
              <DateRangePicker
                initialDateFrom={dateRange.from}
                initialDateTo={dateRange.to}
                showCompare={false}
                onUpdate={(values) => {
                  if (values.range) {
                    setDateRange(values.range);
                    updateFilters({
                      dateFrom: values.range.from,
                      dateTo: values.range.to,
                    });
                  }
                }}
              />
            </div>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Select Columns</Label>
            <Popover
              open={columnPopoverOpen}
              onOpenChange={setColumnPopoverOpen}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                >
                  {selectedColumns.length === COLUMN_OPTIONS.length
                    ? "All Columns Selected"
                    : `${selectedColumns.length} Column${
                        selectedColumns.length !== 1 ? "s" : ""
                      } Selected`}
                  <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0" align="start">
                <div className="p-4 space-y-2">
                  <div className="flex items-center justify-between border-b pb-2">
                    <Label className="text-sm font-semibold">
                      Select Columns
                    </Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        if (selectedColumns.length === COLUMN_OPTIONS.length) {
                          setSelectedColumns([]);
                        } else {
                          setSelectedColumns(
                            COLUMN_OPTIONS.map((col) => col.value)
                          );
                        }
                      }}
                    >
                      {selectedColumns.length === COLUMN_OPTIONS.length
                        ? "Deselect All"
                        : "Select All"}
                    </Button>
                  </div>
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2 p-2">
                      {COLUMN_OPTIONS.map((col) => (
                        <div
                          key={col.value}
                          className="flex items-center space-x-2"
                        >
                          <Checkbox
                            id={col.value}
                            checked={selectedColumns.includes(col.value)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedColumns([
                                  ...selectedColumns,
                                  col.value,
                                ]);
                              } else {
                                setSelectedColumns(
                                  selectedColumns.filter((c) => c !== col.value)
                                );
                              }
                            }}
                          />
                          <label
                            htmlFor={col.value}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer flex-1"
                          >
                            {col.label}
                          </label>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </CardContent>
      </Card>

      <div className="w-full max-w-full overflow-x-hidden">
        <DataTable
          columns={columns}
          data={data}
          searchFields={[
            { key: "employeeName", label: "Employee" },
            { key: "employeeId", label: "Employee ID" },
          ]}
          tableId="attendance-progress-summary"
        />
      </div>
    </DirectionalTransition>
  );
}
