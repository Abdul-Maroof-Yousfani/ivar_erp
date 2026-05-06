"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Autocomplete } from "@/components/ui/autocomplete";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Search,
  ArrowLeft,
  Plus,
  Minus,
  Printer,
  Download,
} from "lucide-react";
import Link from "next/link";
import {
  getEmployeesForDropdown,
  getEmployeeById,
  type EmployeeDropdownOption,
} from "@/lib/actions/employee";
import {
  getDepartments,
  getSubDepartmentsByDepartment,
  type Department,
  type SubDepartment,
} from "@/lib/actions/department";
import { createLeaveEncashment } from "@/lib/actions/leave-encashment";
import { toast } from "sonner";
import { format } from "date-fns";
import DataTable, { HighlightText } from "@/components/common/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { useAuth } from "@/components/providers/auth-provider";

export default function CreateLeaveEncashmentPage() {
  const router = useRouter();
  const { user, hasPermission } = useAuth();
  const [loading, setLoading] = useState(true);
  const [loadingSubDepartments, setLoadingSubDepartments] = useState(false);
  const [employees, setEmployees] = useState<EmployeeDropdownOption[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Check if user has permission to create leave encashment
  const hasCreatePermission = hasPermission("hr.leave-encashment.create");
  const isRestrictedToOwnEmployee = !hasCreatePermission && user?.employee?.id;

  // Sample data structure for results
  interface LeaveEncashmentResult {
    id: string;
    employeeId: string;
    employeeCode: string;
    employeeName: string;
    country?: string;
    province?: string;
    city?: string;
    area?: string;
    station?: string;
    department?: string;
    subDepartment?: string;
    designation?: string;
    encashmentDate: string;
    encashmentDays: number;
    gross: number;
    annual: number;
    perDay: number;
    totalEncashment: number;
  }

  interface LeaveEncashmentRow extends LeaveEncashmentResult {
    sNo: number;
  }

  const loginId = user?.employeeId || user?.employee?.id;

  const [filters, setFilters] = useState({
    departmentId: "",
    subDepartmentId: "",
    employeeId: loginId || "",
    encashmentDate: "",
  });

  // Pre-fill employeeId when user becomes available
  useEffect(() => {
    if (loginId && !filters.employeeId) {
      setFilters(prev => ({ ...prev, employeeId: loginId as string }));
    }
  }, [loginId, filters.employeeId]);

  // Fetch departments on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const deptResult = await getDepartments();
        if (deptResult.status && deptResult.data) {
          setDepartments(deptResult.data);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Fetch employees on mount
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const result = await getEmployeesForDropdown();
        if (result.status && result.data) {
          setEmployees(result.data);
        } else {
          setEmployees([]);
        }
      } catch (error) {
        console.error("Error:", error);
        setEmployees([]);
      }
    };

    fetchEmployees();
  }, []);

  // Fetch sub-departments when department changes
  useEffect(() => {
    const fetchSubDepartments = async () => {
      if (filters.departmentId) {
        setLoadingSubDepartments(true);
        try {
          const result = await getSubDepartmentsByDepartment(
            filters.departmentId
          );
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
        setFilters((prev) => ({ ...prev, subDepartmentId: "" }));
      }
    };

    fetchSubDepartments();
  }, [filters.departmentId]);

  // Filter employees based on department and sub-department
  const filteredEmployees = useMemo(() => {
    let filtered = [...employees];

    if (filters.departmentId) {
      filtered = filtered.filter(
        (emp) => emp.departmentId === filters.departmentId
      );
    }

    if (filters.subDepartmentId) {
      filtered = filtered.filter(
        (emp) => emp.subDepartmentId === filters.subDepartmentId
      );
    }

    return filtered;
  }, [employees, filters.departmentId, filters.subDepartmentId]);

  // Employee options for Autocomplete
  const employeeOptions = useMemo(() => {
    const options = filteredEmployees.map((emp) => ({
      value: emp.id,
      label: `${emp.employeeId} -- ${emp.employeeName}`,
      description: emp.departmentName || undefined,
    }));

    if (loginId && !options.some(o => o.value === loginId)) {
      const empInFullList = employees.find(e => e.id === loginId);
      if (empInFullList) {
        options.unshift({
          value: empInFullList.id,
          label: `${empInFullList.employeeId} -- ${empInFullList.employeeName}`,
          description: empInFullList.departmentName || undefined,
        });
      } else if (user?.employee) {
        options.unshift({
          value: loginId as string,
          label: `${user.employee.employeeId} -- ${user.firstName || ""} ${user.lastName || ""}`,
          description: user.employee.department?.name || undefined,
        });
      }
    }

    return options;
  }, [filteredEmployees, employees, user, loginId]);

  const handleSearch = async () => {
    if (!filters.encashmentDate) {
      toast.error("Encashment Date is required");
      return;
    }

    setIsSearching(true);
    try {
      const selectedEmployees = filters.employeeId
        ? filteredEmployees.filter((e) => e.id === filters.employeeId)
        : filteredEmployees;

      if (selectedEmployees.length === 0) {
        toast.error("No employees found for the selected filters");
        setIsSearching(false);
        return;
      }

      // Fetch employee details including salary
      const results: LeaveEncashmentResult[] = await Promise.all(
        selectedEmployees.map(async (emp) => {
          try {
            const empResult = await getEmployeeById(emp.id);
            const employeeData = empResult.data;

            const grossSalary = employeeData?.employeeSalary || 0;
            const annualSalary = grossSalary * 12;
            const perDayAmount = annualSalary / 365; // Per day calculation

            return {
              id: emp.id,
              employeeId: emp.id,
              employeeCode: emp.employeeId,
              employeeName: emp.employeeName,
              country: employeeData?.countryName || "—",
              province: employeeData?.provinceName || "—",
              city: employeeData?.cityName || "—",
              area: employeeData?.locationName || "—",
              station: employeeData?.locationName || "—",
              department: emp.departmentName || "—",
              subDepartment: emp.subDepartmentName || "—",
              designation: emp.designationName || "—",
              encashmentDate: filters.encashmentDate,
              encashmentDays: 0,
              gross: grossSalary,
              annual: annualSalary,
              perDay: perDayAmount,
              totalEncashment: 0,
            };
          } catch (error) {
            console.error(`Error fetching employee ${emp.id}:`, error);
            return {
              id: emp.id,
              employeeId: emp.id,
              employeeCode: emp.employeeId,
              employeeName: emp.employeeName,
              country: "—",
              province: "—",
              city: "—",
              area: "—",
              station: "—",
              department: emp.departmentName || "—",
              subDepartment: emp.subDepartmentName || "—",
              designation: "—",
              encashmentDate: filters.encashmentDate,
              encashmentDays: 0,
              gross: 0,
              annual: 0,
              perDay: 0,
              totalEncashment: 0,
            };
          }
        })
      );

      setSearchResults(results);
      toast.success(`Found ${results.length} employee(s)`);
    } catch (error) {
      console.error("Error:", error);
      toast.error("Failed to search leave encashment records");
    } finally {
      setIsSearching(false);
    }
  };

  const handleEncashmentDaysChangeById = (id: string, delta: number) => {
    setSearchResults((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const newDays = Math.max(0, r.encashmentDays + delta);
        const newTotal = r.perDay > 0 ? newDays * r.perDay : r.totalEncashment;
        return { ...r, encashmentDays: newDays, totalEncashment: newTotal };
      })
    );
  };

  const handleEncashmentDaysInputChangeById = (id: string, value: string) => {
    const days = Math.max(0, parseFloat(value) || 0);
    setSearchResults((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        const newTotal = r.perDay > 0 ? days * r.perDay : r.totalEncashment;
        return { ...r, encashmentDays: days, totalEncashment: newTotal };
      })
    );
  };

  const handleTotalEncashmentChangeById = (id: string, value: string) => {
    const amount = parseFloat(value) || 0;
    setSearchResults((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        // If total encashment is changed, update days based on per day amount
        const newDays = r.perDay > 0 ? amount / r.perDay : r.encashmentDays;
        return { ...r, totalEncashment: amount, encashmentDays: newDays };
      })
    );
  };

  const handleSubmit = async () => {
    if (searchResults.length === 0) {
      toast.error("No leave encashment records to submit");
      return;
    }

    // Validate all records have required data
    const invalidRecords = searchResults.filter(
      (r) => !r.encashmentDays || r.encashmentDays <= 0 || !r.totalEncashment || r.totalEncashment <= 0
    );

    if (invalidRecords.length > 0) {
      toast.error("Please fill in all encashment days and amounts");
      return;
    }

    setIsSubmitting(true);
    try {
      // Get payment month/year from encashment date
      const encashmentDate = new Date(searchResults[0].encashmentDate);
      const paymentYear = encashmentDate.getFullYear().toString();
      const paymentMonth = String(encashmentDate.getMonth() + 1).padStart(2, '0');
      const paymentMonthYear = `${paymentYear}-${paymentMonth}`;

      const leaveEncashments = searchResults.map((r) => ({
        employeeId: r.employeeId,
        encashmentDate: r.encashmentDate,
        encashmentDays: r.encashmentDays,
        encashmentAmount: r.totalEncashment,
        paymentMonthYear: paymentMonthYear,
        grossSalary: r.gross,
        annualSalary: r.annual,
        perDayAmount: r.perDay,
      }));

      const result = await createLeaveEncashment({ leaveEncashments });

      if (result.status) {
        toast.success(
          `Successfully created ${result.data?.length || leaveEncashments.length} leave encashment record(s)`
        );
        // Clear form and redirect
        handleClearForm();
        router.push("/hr/payroll-setup/leave-encashment/list");
      } else {
        toast.error(result.message || "Failed to create leave encashment records");
      }
    } catch (error) {
      console.error("Error submitting leave encashment:", error);
      toast.error("Failed to submit leave encashment records");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (searchResults.length === 0) {
      toast.error("No data to export");
      return;
    }

    const headers = [
      "S.No",
      "Employee Name",
      "Employee Code",
      "Encashment Date",
      "Encashment Days",
      "Total Encashment",
    ];

    const rows = searchResults.map((result, index) => [
      index + 1,
      `(${result.employeeCode}) ${result.employeeName}`,
      result.employeeCode,
      result.encashmentDate
        ? format(new Date(result.encashmentDate), "dd-MMM-yyyy")
        : "—",
      result.encashmentDays.toString(),
      result.totalEncashment.toString(),
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `leave_encashment_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    toast.success("Data exported successfully");
  };

  const handleClearForm = () => {
    setFilters({
      departmentId: "",
      subDepartmentId: "",
      employeeId: "",
      encashmentDate: "",
    });
    setSearchResults([]);
  };

  const tableData: LeaveEncashmentRow[] = useMemo(
    () =>
      searchResults.map((r, i) => ({
        ...r,
        sNo: i + 1,
      })),
    [searchResults]
  );

  const columns: ColumnDef<LeaveEncashmentRow>[] = useMemo(
    () => [
      {
        header: "S.No",
        accessorKey: "sNo",
        enableSorting: false,
        size: 60,
        cell: ({ row }) => row.original.sNo,
      },
      {
        header: "Employee Name",
        accessorKey: "employeeName",
        size: 220,
        cell: ({ row }) => (
          <HighlightText
            text={`(${row.original.employeeCode}) ${row.original.employeeName}`}
          />
        ),
      },
      {
        header: "Emp Details",
        accessorKey: "department",
        size: 240,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="text-xs space-y-0.5">
            <div>Country: {row.original.country || "—"}</div>
            <div>Province: {row.original.province || "—"}</div>
            <div>City: {row.original.city || "—"}</div>
            <div>Area: {row.original.area || "—"}</div>
            <div>Stn: {row.original.station || "—"}</div>
            <div>Dept: {row.original.department || "—"}</div>
            <div>Sub-Dept: {row.original.subDepartment || "—"}</div>
            <div>Designation: {row.original.designation || "—"}</div>
          </div>
        ),
      },
      {
        header: "Encashment Period",
        accessorKey: "encashmentDate",
        size: 160,
        cell: ({ row }) =>
          `Effected Date: ${row.original.encashmentDate
            ? format(new Date(row.original.encashmentDate), "dd-MMM-yyyy")
            : "—"
          }`,
      },
      {
        header: "Encashment Days",
        accessorKey: "encashmentDays",
        size: 180,
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() =>
                handleEncashmentDaysChangeById(row.original.id, -1)
              }
            >
              <Minus className="h-3 w-3" />
            </Button>
            <Input
              type="number"
              value={row.original.encashmentDays}
              onChange={(e) =>
                handleEncashmentDaysInputChangeById(
                  row.original.id,
                  e.target.value
                )
              }
              className="w-16 h-8 text-center"
              min="0"
              step="0.5"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleEncashmentDaysChangeById(row.original.id, 1)}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        ),
      },
      {
        header: "Salary Details",
        accessorKey: "gross",
        size: 180,
        enableSorting: false,
        cell: ({ row }) => (
          <div className="text-xs space-y-0.5">
            <div>Gross: {row.original.gross.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
            <div>Annual: {row.original.annual.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
            <div>PerDay: {row.original.perDay.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
          </div>
        ),
      },
      {
        header: "Total Encashment",
        accessorKey: "totalEncashment",
        size: 160,
        cell: ({ row }) => (
          <Input
            type="number"
            value={row.original.totalEncashment}
            onChange={(e) =>
              handleTotalEncashmentChangeById(row.original.id, e.target.value)
            }
            min="0"
          />
        ),
      },
    ],
    []
  );

  return (
    <div className="max-w-7xl mx-auto pb-10">
      <div className="mb-6">
        <Link href="/hr/payroll-setup/leave-encashment/list">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
      </div>

      <Card className="border-0 shadow-none">
        <CardHeader className="pb-4 ">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl font-bold text-foreground">
                Leave Encashment Form
              </CardTitle>
              <CardDescription className="mt-1 text-muted-foreground">
                Filter and view leave encashment records
              </CardDescription>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>

              <Button variant="outline" size="sm" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {/* Filter Section */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Department */}
            <div className="space-y-2">
              <Label htmlFor="department">Department</Label>
              {loading ? (
                <div className="h-10 bg-muted rounded-md animate-pulse" />
              ) : (
                <Autocomplete
                  options={[
                    { value: "", label: "Select Department" },
                    ...departments.map((dept) => ({
                      value: dept.id,
                      label: dept.name,
                    })),
                  ]}
                  value={filters.departmentId}
                  onValueChange={(value) => {
                    setFilters({
                      ...filters,
                      departmentId: value || "",
                      subDepartmentId: "",
                      employeeId: isRestrictedToOwnEmployee ? user?.employee?.id || "" : "",
                    });
                  }}
                  placeholder="Select Department"
                  searchPlaceholder="Search department..."
                  emptyMessage="No departments found"
                  disabled={isRestrictedToOwnEmployee}
                />
              )}
            </div>

            {/* Sub Department */}
            <div className="space-y-2">
              <Label htmlFor="subDepartment">Sub Department</Label>
              {loadingSubDepartments ? (
                <div className="h-10 bg-muted rounded-md animate-pulse" />
              ) : (
                <Autocomplete
                  options={[
                    {
                      value: "",
                      label:
                        subDepartments.length === 0
                          ? "No Record Found"
                          : "Select Sub Department",
                    },
                    ...subDepartments.map((subDept) => ({
                      value: subDept.id,
                      label: subDept.name,
                    })),
                  ]}
                  value={filters.subDepartmentId}
                  onValueChange={(value) => {
                    setFilters({
                      ...filters,
                      subDepartmentId: value || "",
                      employeeId: isRestrictedToOwnEmployee ? user?.employee?.id || "" : "",
                    });
                  }}
                  placeholder={
                    !filters.departmentId
                      ? "Select department first"
                      : subDepartments.length === 0
                        ? "No Record Found"
                        : "Select Sub Department"
                  }
                  searchPlaceholder="Search sub department..."
                  emptyMessage="No sub departments found"
                  disabled={
                    isRestrictedToOwnEmployee || !filters.departmentId || subDepartments.length === 0
                  }
                />
              )}
            </div>

            {/* Employee */}
            <div className="space-y-2">
              <Label htmlFor="employee">
                Employee <span className="text-destructive">*</span>
              </Label>
              <Autocomplete
                options={employeeOptions}
                value={filters.employeeId}
                onValueChange={(value) => {
                  setFilters({ ...filters, employeeId: value || "" });
                }}
                placeholder={
                  isRestrictedToOwnEmployee
                    ? user?.employee?.id
                      ? `${user.employee.employeeId || ""} -- ${user.firstName} ${user.lastName}`
                      : "Loading..."
                    : filters.employeeId
                      ? `All selected (${filteredEmployees.length})`
                      : "Select Employee"
                }
                searchPlaceholder="Search employees..."
                emptyMessage="No employees found"
                disabled={isRestrictedToOwnEmployee}
              />
            </div>

            {/* Encashment Date */}
            <div className="space-y-2">
              <Label htmlFor="encashmentDate">
                Encashment Date <span className="text-destructive">*</span>
              </Label>
              <DatePicker
                value={filters.encashmentDate}
                onChange={(value) => {
                  setFilters({ ...filters, encashmentDate: value || "" });
                }}
                placeholder="Select Encashment Date"
              />
            </div>
          </div>

          {/* Search Button */}
          <div className="flex justify-end gap-2">
            <Button
              onClick={handleSearch}
              disabled={isSearching}
              variant="outline"
            >
              <Search className="h-4 w-4 mr-2" />
              {isSearching ? "Searching..." : "Search"}
            </Button>
            {searchResults.length > 0 && (
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSubmitting ? "Submitting..." : "Submit Leave Encashment"}
              </Button>
            )}
          </div>

          {tableData.length > 0 && (
            <DataTable<LeaveEncashmentRow>
              columns={columns}
              data={tableData}
              searchFields={[
                { key: "employeeName", label: "Employee Name" },
                { key: "employeeCode", label: "Employee Code" },
              ]}
              tableId="leave-encashment-create"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
