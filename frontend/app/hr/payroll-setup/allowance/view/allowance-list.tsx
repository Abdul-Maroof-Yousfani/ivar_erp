"use client";

import { useState, useEffect, useMemo } from "react";
import DataTable from "@/components/common/data-table";
import { columns, type AllowanceRow } from "./columns";
import { AllowanceFilters } from "./allowance-filters";
import { Button } from "@/components/ui/button";
import { Printer, Download, Plus } from "lucide-react";
import { getEmployeesForDropdown, type EmployeeDropdownOption } from "@/lib/actions/employee";
import { getDepartments, getSubDepartmentsByDepartment, type Department, type SubDepartment } from "@/lib/actions/department";
import { getAllowanceHeads, type Allowance, type AllowanceHead } from "@/lib/actions/allowance";
import { toast } from "sonner";
import { format } from "date-fns";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";

interface AllowanceListProps {
  initialData?: Allowance[];
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

export function AllowanceList({ initialData = [] }: AllowanceListProps) {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("hr.allowance.create");
  const [employees, setEmployees] = useState<EmployeeDropdownOption[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([]);
  const [allowanceHeads, setAllowanceHeads] = useState<AllowanceHead[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSubDepartments, setLoadingSubDepartments] = useState(false);

  const [filters, setFilters] = useState({
    departmentId: "all",
    subDepartmentId: "all",
    employeeId: "all",
    allowanceHeadId: "all",
    status: "all",
    paymentMethod: "all",
    month: "all",
    year: "all",
  });

  // Transform API data to row format
  const transformToRows = (allowances: Allowance[]): AllowanceRow[] => {
    return allowances.map((allowance, index) => ({
      id: allowance.id,
      sNo: index + 1,
      employeeId: allowance.employeeId,
      employeeName: allowance.employee?.employeeName || allowance.employeeName || "—",
      employeeCode: allowance.employee?.employeeId || "—",
      department: allowance.employee?.department?.name || "—",
      departmentId: allowance.employee?.department?.id,
      subDepartment: allowance.employee?.subDepartment?.name || "—",
      subDepartmentId: allowance.employee?.subDepartment?.id,
      allowanceHeadId: allowance.allowanceHeadId,
      allowanceHeadName: allowance.allowanceHead?.name || allowance.allowanceHeadName || "—",
      amount: Number(allowance.amount),
      month: allowance.month || "",
      year: allowance.year || "",
      monthYear: formatMonthYear(allowance.month || "", allowance.year || ""),
      type: allowance.type || "specific",
      paymentMethod: allowance.paymentMethod || "with_salary",
      notes: allowance.notes || null,
      status: allowance.status || "active",
      createdAt: allowance.createdAt,
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

      // Allowance Head filter
      if (filters.allowanceHeadId !== "all" && row.allowanceHeadId !== filters.allowanceHeadId) {
        return false;
      }

      // Status filter
      if (filters.status !== "all" && row.status?.toLowerCase() !== filters.status.toLowerCase()) {
        return false;
      }

      // Payment Method filter
      if (filters.paymentMethod !== "all" && row.paymentMethod !== filters.paymentMethod) {
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

  // Fetch departments and allowance heads on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [deptResult, headsResult] = await Promise.all([
          getDepartments(),
          getAllowanceHeads(),
        ]);
        if (deptResult.status && deptResult.data) {
          setDepartments(deptResult.data);
        }
        if (headsResult.status && headsResult.data) {
          setAllowanceHeads(headsResult.data.filter((h) => h.status === "active"));
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
      "Allowance Type",
      "Amount",
      "Payment Method",
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
      row.allowanceHeadName,
      row.amount.toString(),
      row.paymentMethod === "with_salary" ? "With Salary" : "Separately",
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
    link.download = `allowance_list_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    toast.success("Data exported successfully");
  };

  const handleFiltersChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
  };

  const handleResetFilters = () => {
    setFilters({
      departmentId: "all",
      subDepartmentId: "all",
      employeeId: "all",
      allowanceHeadId: "all",
      status: "all",
      paymentMethod: "all",
      month: "all",
      year: "all",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            View Employee Allowance List
          </h2>
          <p className="text-muted-foreground">
            Search and view employee allowance records
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canCreate && (
            <Link href="/hr/payroll-setup/allowance/create">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Create Allowance
              </Button>
            </Link>
          )}
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

      <AllowanceFilters
        departments={departments}
        subDepartments={subDepartments}
        employees={employees}
        allowanceHeads={allowanceHeads}
        loading={loading}
        loadingSubDepartments={loadingSubDepartments}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onReset={handleResetFilters}
      />

      <DataTable<AllowanceRow>
        columns={columns}
        data={data}
        searchFields={[
          { key: "employeeName", label: "Employee Name" },
          { key: "employeeCode", label: "Employee ID" },
          { key: "department", label: "Department" },
          { key: "allowanceHeadName", label: "Allowance Type" },
        ]}
        tableId="allowance-list"
      />
    </div>
  );
}
