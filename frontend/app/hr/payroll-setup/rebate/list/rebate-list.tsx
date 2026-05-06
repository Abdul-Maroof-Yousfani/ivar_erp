"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import DataTable from "@/components/common/data-table";
import { columns, type RebateRow } from "./columns";
import { RebateFilters } from "./rebate-filters";
import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";
import { getEmployeesForDropdown, type EmployeeDropdownOption } from "@/lib/actions/employee";
import { getDepartments, getSubDepartmentsByDepartment, type Department, type SubDepartment } from "@/lib/actions/department";
import { toast } from "sonner";
import { format } from "date-fns";

interface RebateListProps {
  initialData?: any[]; // TODO: Replace with proper Rebate type when backend is ready
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

export function RebateList({ initialData = [] }: RebateListProps) {
  const router = useRouter();
  const [employees, setEmployees] = useState<EmployeeDropdownOption[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSubDepartments, setLoadingSubDepartments] = useState(false);
  
  const [filters, setFilters] = useState({
    departmentId: "all",
    subDepartmentId: "all",
    employeeId: "all",
  });


  // Transform API data to row format
  const transformToRows = (rebates: any[]): RebateRow[] => {
    return rebates.map((rebate, index) => {
      // Parse monthYear (YYYY-MM format)
      const monthYearParts = rebate.monthYear ? rebate.monthYear.split("-") : [];
      const year = monthYearParts[0] || "";
      const month = monthYearParts[1] || "";

      // Determine rebate type from rebate nature
      const rebateType = rebate.rebateNature?.type || "other";
      const isFixed = rebateType === "fixed";

      return {
        id: rebate.id || `temp-${index}`,
        sNo: index + 1,
        employeeId: rebate.employeeId || "",
        employeeName: rebate.employee?.employeeName || "—",
        employeeCode: rebate.employee?.employeeId || "—",
        department: rebate.employee?.department?.name || "—",
        departmentId: rebate.employee?.department?.id,
        subDepartment: rebate.employee?.subDepartment?.name || "—",
        subDepartmentId: rebate.employee?.subDepartment?.id,
        month,
        year,
        monthYear: rebate.monthYear ? formatMonthYear(month, year) : "—",
        rebateType: rebateType.charAt(0).toUpperCase() + rebateType.slice(1),
        rebateNature: rebate.rebateNature?.name || "—",
        actualInvestment: isFixed ? null : (rebate.rebateAmount ? Number(rebate.rebateAmount) : null),
        rebateAmount: rebate.rebateAmount ? Number(rebate.rebateAmount) : 0,
        documentUrl: rebate.attachment || null,
        status: rebate.status || "pending",
        createdAt: rebate.createdAt || new Date().toISOString(),
      };
    });
  };

  // Transform initial data to row format
  const allData = useMemo(() => transformToRows(initialData), [initialData]);

  // Apply filters to data
  const data = useMemo(() => {
    return allData.filter((row) => {
      // Department filter
      if (filters.departmentId !== "all") {
        if (!row.departmentId || row.departmentId !== filters.departmentId) {
          return false;
        }
      }
      
      // Sub Department filter
      if (filters.subDepartmentId !== "all") {
        if (!row.subDepartmentId || row.subDepartmentId !== filters.subDepartmentId) {
          return false;
        }
      }
      
      // Employee filter
      if (filters.employeeId !== "all" && row.employeeId !== filters.employeeId) {
        return false;
      }
      
      return true;
    });
  }, [allData, filters]);

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
      "Emp Code",
      "Employee Name",
      "Month - Year",
      "Type",
      "Nature",
      "Actual Investment",
      "Rebate Amount",
      "Status",
    ];

    const rows = data.map((row) => [
      row.sNo,
      row.employeeCode,
      row.employeeName,
      row.monthYear,
      row.rebateType,
      row.rebateNature,
      row.actualInvestment?.toString() || "—",
      row.rebateAmount.toString(),
      row.status,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `rebate_list_${format(new Date(), "yyyy-MM-dd")}.csv`;
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
    });
  };

  const handleToggle = () => {
    router.push("/hr/payroll-setup/rebate/create");
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between flex-wrap gap-4 mb-2">
          <h2 className="text-2xl font-bold tracking-tight">View Rebate Detail</h2>
          <div className="flex gap-2 flex-wrap">
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
        <p className="text-muted-foreground">
          Search and view rebate records
        </p>
      </div>

      <RebateFilters
        departments={departments}
        subDepartments={subDepartments}
        employees={employees}
        loading={loading}
        loadingSubDepartments={loadingSubDepartments}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onReset={handleResetFilters}
      />

      <DataTable<RebateRow>
        columns={columns}
        data={data}
        actionText="Create Rebate"
        toggleAction={handleToggle}
        searchFields={[
          { key: "employeeName", label: "Employee Name" },
          { key: "employeeCode", label: "Employee Code" },
          { key: "department", label: "Department" },
        ]}
        tableId="rebate-list"
      />
    </div>
  );
}

