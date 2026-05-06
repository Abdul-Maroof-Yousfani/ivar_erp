"use client";

import { useState, useEffect, useMemo } from "react";
import DataTable from "@/components/common/data-table";
import { columns, type DeductionRow } from "./columns";
import { DeductionFilters } from "./deduction-filters";
import { Button } from "@/components/ui/button";
import { Printer, Download, Plus } from "lucide-react";
import { getEmployeesForDropdown, type EmployeeDropdownOption } from "@/lib/actions/employee";
import { getDepartments, getSubDepartmentsByDepartment, type Department, type SubDepartment } from "@/lib/actions/department";
import { getDeductionHeads, type Deduction, type DeductionHead } from "@/lib/actions/deduction";
import { toast } from "sonner";
import { format } from "date-fns";
import Link from "next/link";

interface DeductionListProps {
  initialData?: Deduction[];
}

const formatMonthYear = (month: string, year: string) => {
  if (!month || !year) return "—";
  const monthNames = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];
  const monthIndex = parseInt(month) - 1;
  return `${monthNames[monthIndex] || month} ${year}`;
};

export function DeductionList({ initialData = [] }: DeductionListProps) {
  const [employees, setEmployees] = useState<EmployeeDropdownOption[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([]);
  const [deductionHeads, setDeductionHeads] = useState<DeductionHead[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSubDepartments, setLoadingSubDepartments] = useState(false);

  const [filters, setFilters] = useState({
    departmentId: "all",
    subDepartmentId: "all",
    employeeId: "all",
    deductionHeadId: "all",
    status: "all",
    month: "all",
    year: "all",
  });

  // Transform API data to row format
  const transformToRows = (deductions: Deduction[]): DeductionRow[] => {
    return deductions.map((deduction, index) => ({
      id: deduction.id,
      sNo: index + 1,
      employeeId: deduction.employeeId,
      employeeName: deduction.employee?.employeeName || "—",
      employeeCode: deduction.employee?.employeeId || "—",
      department: deduction.employee?.department?.name || "—",
      departmentId: deduction.employee?.department?.id,
      subDepartment: deduction.employee?.subDepartment?.name || "—",
      subDepartmentId: deduction.employee?.subDepartment?.id,
      deductionHeadId: deduction.deductionHeadId,
      deductionHeadName: deduction.deductionHead?.name || "—",
      amount: Number(deduction.amount),
      month: deduction.month || "",
      year: deduction.year || "",
      monthYear: formatMonthYear(deduction.month || "", deduction.year || ""),
      notes: deduction.notes || null,
      status: deduction.status || "active",
      createdAt: deduction.createdAt,
    }));
  };

  // Transform initial data to row format
  const allData = useMemo(() => transformToRows(initialData), [initialData]);

  // Apply filters to data
  const data = useMemo(() => {
    return allData.filter((row) => {
      // Department filter: if filter is set and row has departmentId, they must match
      if (filters.departmentId !== "all") {
        if (!row.departmentId || row.departmentId !== filters.departmentId) {
          return false;
        }
      }

      // Sub Department filter: only apply if department is selected and matches
      if (filters.subDepartmentId !== "all") {
        if (!row.subDepartmentId || row.subDepartmentId !== filters.subDepartmentId) {
          return false;
        }
      }

      // Employee filter
      if (filters.employeeId !== "all" && row.employeeId !== filters.employeeId) {
        return false;
      }

      // Deduction Head filter
      if (filters.deductionHeadId !== "all" && row.deductionHeadId !== filters.deductionHeadId) {
        return false;
      }

      // Status filter
      if (filters.status !== "all" && row.status?.toLowerCase() !== filters.status.toLowerCase()) {
        return false;
      }

      // Month filter
      if (filters.month !== "all" && row.month !== filters.month) {
        return false;
      }

      // Year filter
      if (filters.year !== "all" && row.year !== filters.year) {
        return false;
      }

      return true;
    });
  }, [allData, filters]);

  // Fetch departments and deduction heads on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [deptResult, headsResult] = await Promise.all([
          getDepartments(),
          getDeductionHeads(),
        ]);
        if (deptResult.status && deptResult.data) {
          setDepartments(deptResult.data);
        }
        if (headsResult.status && headsResult.data) {
          setDeductionHeads(headsResult.data.filter((h) => h.status === "active"));
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
      if (filters.departmentId && filters.departmentId !== "all") {
        setLoadingSubDepartments(true);
        try {
          const result = await getSubDepartmentsByDepartment(filters.departmentId);
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
  }, [filters.departmentId]);

  const handleFiltersChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
  };

  const handleResetFilters = () => {
    setFilters({
      departmentId: "all",
      subDepartmentId: "all",
      employeeId: "all",
      deductionHeadId: "all",
      status: "all",
      month: "all",
      year: "all",
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
      "Employee ID",
      "Employee Name",
      "Department",
      "Sub Department",
      "Deduction Type",
      "Amount",
      "Month-Year",
      "Status",
      "Notes",
    ];

    const rows = data.map((row) => [
      row.sNo,
      row.employeeCode,
      row.employeeName,
      row.department,
      row.subDepartment,
      row.deductionHeadName,
      row.amount.toString(),
      row.monthYear,
      row.status,
      row.notes || "—",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `deduction_list_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    toast.success("Data exported successfully");
  };


  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            View Employee Deduction List
          </h2>
          <p className="text-muted-foreground">
            Search and view employee deduction records
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/hr/payroll-setup/deduction/create">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Deduction
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

      <DeductionFilters
        departments={departments}
        subDepartments={subDepartments}
        employees={employees}
        deductionHeads={deductionHeads}
        loading={loading}
        loadingSubDepartments={loadingSubDepartments}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onReset={handleResetFilters}
      />

      <DataTable<DeductionRow>
        columns={columns}
        data={data}
        searchFields={[
          { key: "employeeName", label: "Employee Name" },
          { key: "employeeCode", label: "Employee ID" },
          { key: "department", label: "Department" },
          { key: "deductionHeadName", label: "Deduction Type" },
        ]}
        tableId="deduction-list" />
    </div>
  );
}
