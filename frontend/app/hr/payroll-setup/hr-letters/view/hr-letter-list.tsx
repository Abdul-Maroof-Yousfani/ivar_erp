"use client";

import { useState, useTransition, useEffect } from "react";
import DataTable from "@/components/common/data-table";
import { columns, type HrLetterRow } from "./columns";
import { Button } from "@/components/ui/button";
import { Printer, Download, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  getDepartments,
  getSubDepartmentsByDepartment,
  type Department,
  type SubDepartment,
} from "@/lib/actions/department";
import {
  getEmployeesForDropdown,
  type EmployeeDropdownOption,
} from "@/lib/actions/employee";
import { getHrLetterTypes, getHrLetters, type HrLetterType } from "@/lib/actions/hr-letter";

interface HrLetterListProps {
  initialData?: HrLetterRow[];
}

export function HrLetterList({ initialData = [] }: HrLetterListProps) {
  const [isPending, startTransition] = useTransition();
  const [data, setData] = useState<HrLetterRow[]>(initialData);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([]);
  const [employees, setEmployees] = useState<EmployeeDropdownOption[]>([]);
  const [letterTypes, setLetterTypes] = useState<HrLetterType[]>([]);
  const [loadingSubDepartments, setLoadingSubDepartments] = useState(false);

  const [filters, setFilters] = useState({
    department: "",
    subDepartment: "",
    employeeId: "",
    letterTypeId: "",
  });

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      const [deptResult, empResult, letterTypesResult] = await Promise.all([
        getDepartments(),
        getEmployeesForDropdown(),
        getHrLetterTypes(),
      ]);

      if (deptResult.status && deptResult.data) {
        setDepartments(deptResult.data);
      }
      if (empResult.status && empResult.data) {
        setEmployees(empResult.data);
      }
      if (letterTypesResult.status && letterTypesResult.data) {
        setLetterTypes(letterTypesResult.data.filter((lt) => lt.status === "active"));
      }
    };
    fetchData();
  }, []);

  // Fetch sub-departments when department changes
  useEffect(() => {
    const fetchSubDepartments = async () => {
      if (filters.department) {
        setLoadingSubDepartments(true);
        try {
          const result = await getSubDepartmentsByDepartment(filters.department);
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
      }
    };
    fetchSubDepartments();
  }, [filters.department]);

  const handleSearch = () => {
    startTransition(async () => {
      try {
        const result = await getHrLetters({
          departmentId: filters.department || undefined,
          subDepartmentId: filters.subDepartment || undefined,
          employeeId: filters.employeeId || undefined,
          letterTypeId: filters.letterTypeId || undefined,
        });

        if (result.status && result.data) {
          const formattedData: HrLetterRow[] = result.data.map((letter, index) => ({
            id: letter.id,
            sNo: index + 1,
            empId: letter.employeeName?.split(" ")[0] || "",
            empName: letter.employeeName || "",
            department: "",
            subDepartment: "",
            letterType: letter.letterTypeName || "",
            createdAt: new Date(letter.createdAt).toLocaleDateString(),
            status: letter.status || "Active",
          }));
          setData(formattedData);
          if (formattedData.length === 0) {
            toast.info("No records found");
          }
        } else {
          toast.error(result.message || "Failed to fetch HR letters");
        }
      } catch (error) {
        console.error("Error:", error);
        toast.error("Failed to search HR letters");
      }
    });
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (data.length === 0) {
      toast.error("No data to export");
      return;
    }

    const headers = [
      "S.No",
      "EMP ID",
      "Employee Name",
      "Department",
      "Sub Department",
      "Letter Type",
      "Created Date",
      "Status",
    ];

    const rows = data.map((row) => [
      row.sNo,
      row.empId,
      row.empName,
      row.department,
      row.subDepartment,
      row.letterType,
      row.createdAt,
      row.status,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `hr_letters_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    toast.success("Data exported successfully");
  };

  // Filter employees based on department and sub-department
  const filteredEmployees = employees.filter((emp) => {
    if (filters.department) {
      if (emp.departmentId !== filters.department) return false;
    }
    if (filters.subDepartment) {
      if (emp.subDepartmentId !== filters.subDepartment) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            View Hr Letters
          </h2>
          <p className="text-muted-foreground">
            View and manage HR letters
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/hr/payroll-setup/hr-letters/create">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create HR Letter
            </Button>
          </Link>
          <Button variant="secondary" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button variant="secondary" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Search/Filter Section */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Department */}
            <div className="space-y-2">
              <Label htmlFor="searchDepartment">Department</Label>
              <Select
                value={filters.department}
                onValueChange={(value) => {
                  setFilters((prev) => ({
                    ...prev,
                    department: value,
                    subDepartment: "",
                    employeeId: "",
                  }));
                }}
                disabled={isPending}
              >
                <SelectTrigger id="searchDepartment">
                  <SelectValue placeholder="Select Department" />
                </SelectTrigger>
                <SelectContent>
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
              <Label htmlFor="searchSubDepartment">
                Sub Department <span className="text-destructive">*</span>
              </Label>
              <Select
                value={filters.subDepartment}
                onValueChange={(value) => {
                  setFilters((prev) => ({
                    ...prev,
                    subDepartment: value,
                    employeeId: "",
                  }));
                }}
                disabled={isPending || !filters.department || loadingSubDepartments}
              >
                <SelectTrigger id="searchSubDepartment">
                  <SelectValue placeholder="Select Department" />
                </SelectTrigger>
                <SelectContent>
                  {subDepartments.length === 0 ? (
                    <SelectItem value="no-subdept" disabled>
                      {!filters.department
                        ? "Select department first"
                        : "No sub departments found"}
                    </SelectItem>
                  ) : (
                    subDepartments.map((subDept) => (
                      <SelectItem key={subDept.id} value={subDept.id}>
                        {subDept.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Employee */}
            <div className="space-y-2">
              <Label htmlFor="searchEmployee">
                Employee <span className="text-destructive">*</span>
              </Label>
              <Select
                value={filters.employeeId}
                onValueChange={(value) => {
                  setFilters((prev) => ({ ...prev, employeeId: value }));
                }}
                disabled={isPending || !filters.department}
              >
                <SelectTrigger id="searchEmployee">
                  <SelectValue placeholder="Select Employee" />
                </SelectTrigger>
                <SelectContent>
                  {filteredEmployees.length === 0 ? (
                    <SelectItem value="no-employee" disabled>
                      {!filters.department
                        ? "Select department first"
                        : "No employees found"}
                    </SelectItem>
                  ) : (
                    filteredEmployees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.employeeId} -- {emp.employeeName}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Letter Type */}
            <div className="space-y-2">
              <Label htmlFor="searchLetterType">
                Letter <span className="text-destructive">*</span>
              </Label>
              <Select
                value={filters.letterTypeId}
                onValueChange={(value) => {
                  setFilters((prev) => ({ ...prev, letterTypeId: value }));
                }}
                disabled={isPending}
              >
                <SelectTrigger id="searchLetterType">
                  <SelectValue placeholder="Select Letter" />
                </SelectTrigger>
                <SelectContent>
                  {letterTypes.length > 0 ? (
                    letterTypes.map((letterType) => (
                      <SelectItem key={letterType.id} value={letterType.id}>
                        {letterType.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-letters" disabled>
                      No letter types available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Search Button */}
          <div className="flex justify-start mt-4">
            <Button onClick={handleSearch} disabled={isPending}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <div className="w-full max-w-full overflow-x-hidden">
        {data.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <p className="text-destructive font-medium">Record Not Found !</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <DataTable
            columns={columns}
            data={data}
            searchFields={[
              { key: "empName", label: "Employee Name" },
              { key: "empId", label: "Employee ID" },
              { key: "letterType", label: "Letter Type" },
            ]}
            tableId="hr-letter-list"
          />
        )}
      </div>
    </div>
  );
}

