"use client";

import { useState, useEffect, useMemo } from "react";
import DataTable from "@/components/common/data-table";
import { columns, type BonusRow } from "./columns";
import { BonusFilters } from "./bonus-filters";
import { Button } from "@/components/ui/button";
import { Printer, Download, Plus, Gift } from "lucide-react";
import { getEmployeesForDropdown, type EmployeeDropdownOption } from "@/lib/actions/employee";
import { getDepartments, getSubDepartmentsByDepartment, type Department, type SubDepartment } from "@/lib/actions/department";
import { getBonusTypes, type BonusType } from "@/lib/actions/bonus-type";
import { type Bonus } from "@/lib/actions/bonus";
import { toast } from "sonner";
import { format } from "date-fns";
import Link from "next/link";
import { useAuth } from "@/components/providers/auth-provider";

interface BonusListProps {
  initialData?: Bonus[];
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

export function BonusList({ initialData = [] }: BonusListProps) {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission("hr.bonus.create");
  const [employees, setEmployees] = useState<EmployeeDropdownOption[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [subDepartments, setSubDepartments] = useState<SubDepartment[]>([]);
  const [bonusTypes, setBonusTypes] = useState<BonusType[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSubDepartments, setLoadingSubDepartments] = useState(false);
  
  const [filters, setFilters] = useState({
    departmentId: "all",
    subDepartmentId: "all",
    employeeId: "all",
    bonusTypeId: "all",
    status: "all",
    month: "all",
    year: "all",
    paymentMethod: "all",
  });

  // Transform API data to row format
  const transformToRows = (bonuses: Bonus[]): BonusRow[] => {
    return bonuses.map((bonus, index) => ({
      id: bonus.id,
      sNo: index + 1,
      employeeId: bonus.employeeId,
      employeeName: bonus.employee?.employeeName || "—",
      employeeCode: bonus.employee?.employeeId || "—",
      department: bonus.employee?.department?.name || "—",
      departmentId: bonus.employee?.department?.id,
      subDepartment: bonus.employee?.subDepartment?.name || "—",
      subDepartmentId: bonus.employee?.subDepartment?.id,
      bonusTypeId: bonus.bonusTypeId,
      bonusTypeName: bonus.bonusType?.name || "—",
      amount: Number(bonus.amount),
      percentage: bonus.percentage ? Number(bonus.percentage) : null,
      calculationType: bonus.calculationType || bonus.bonusType?.calculationType || "Amount",
      bonusMonth: bonus.bonusMonth || "",
      bonusYear: bonus.bonusYear || "",
      bonusMonthYear: formatMonthYear(bonus.bonusMonth || "", bonus.bonusYear || ""),
      paymentMethod: bonus.paymentMethod || "with_salary",
      adjustmentMethod: bonus.adjustmentMethod || "distributed-remaining-months",
      notes: bonus.notes || null,
      status: bonus.status || "active",
      createdAt: bonus.createdAt,
    }));
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
      
      // Bonus Type filter
      if (filters.bonusTypeId !== "all" && row.bonusTypeId !== filters.bonusTypeId) {
        return false;
      }
      
      // Status filter
      if (filters.status !== "all" && row.status?.toLowerCase() !== filters.status.toLowerCase()) {
        return false;
      }
      
      // Month filter
      if (filters.month !== "all" && row.bonusMonth !== filters.month) {
        return false;
      }
      
      // Year filter
      if (filters.year !== "all" && row.bonusYear !== filters.year) {
        return false;
      }
      
      // Payment Method filter
      if (filters.paymentMethod !== "all" && row.paymentMethod !== filters.paymentMethod) {
        return false;
      }
      
      return true;
    });
  }, [allData, filters]);

  // Fetch departments and bonus types on mount
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [deptResult, typesResult] = await Promise.all([
          getDepartments(),
          getBonusTypes(),
        ]);
        if (deptResult.status && deptResult.data) {
          setDepartments(deptResult.data);
        }
        if (typesResult.status && typesResult.data) {
          setBonusTypes(typesResult.data.filter((t) => t.status === "active"));
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
    if (data.length === 0) {
      toast.error("No data to print");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("Please allow popups to print");
      return;
    }

    // Calculate totals
    const totalBonusAmount = data.reduce((sum, row) => sum + Number(row.amount), 0);
    const totalTaxAmount = data.reduce((sum, row) => {
      // Calculate tax if applicable (assuming 0% for now, can be enhanced)
      return sum + 0;
    }, 0);
    const totalNet = totalBonusAmount - totalTaxAmount;

    // Count by status
    const activeCount = data.filter(row => row.status?.toLowerCase() === "active").length;

    const currentDate = new Date();
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const printDay = dayNames[currentDate.getDay()];
    const printDate = format(currentDate, "dd-MMM-yyyy hh:mm:ss a");

    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Bonus Report - ${format(new Date(), "MMMM dd, yyyy")}</title>
          <meta charset="UTF-8">
          <style>
            @media print {
              @page { 
                margin: 10mm 15mm;
                size: A4 landscape;
              }
              body { 
                margin: 0;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .no-print {
                display: none !important;
              }
              thead {
                display: table-header-group;
              }
              tbody {
                display: table-row-group;
              }
              tr {
                page-break-inside: avoid;
              }
              .header {
                page-break-after: avoid;
              }
              .summary {
                page-break-after: avoid;
              }
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              padding: 15px;
              font-size: 11px;
              color: #1f2937;
              background: white;
            }
            .header {
              margin-bottom: 20px;
              border-bottom: 3px solid #1f2937;
              padding-bottom: 12px;
            }
            .header-top {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 15px;
            }
            .header-info {
              font-size: 10px;
              color: #6b7280;
              text-decoration: underline;
            }
            .header-title {
              text-align: center;
              margin-top: 10px;
            }
            .header-title h1 {
              font-size: 28px;
              font-weight: 700;
              color: #4b5563;
              margin: 0;
              letter-spacing: 1px;
            }
            .header-title p {
              font-size: 12px;
              color: #6b7280;
              margin-top: 5px;
            }
            .summary {
              display: grid;
              grid-template-columns: repeat(5, 1fr);
              gap: 12px;
              margin-bottom: 20px;
              padding: 15px;
              background: #f9fafb;
              border-radius: 6px;
              border: 1px solid #e5e7eb;
            }
            .summary-item {
              text-align: center;
            }
            .summary-label {
              font-size: 9px;
              color: #6b7280;
              text-transform: uppercase;
              margin-bottom: 5px;
              font-weight: 600;
            }
            .summary-value {
              font-size: 16px;
              font-weight: 700;
              color: #1f2937;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 20px;
            }
            thead {
              background: #374151;
              color: white;
            }
            th {
              padding: 10px 8px;
              text-align: left;
              font-weight: 600;
              font-size: 10px;
              text-transform: uppercase;
              border: 1px solid #1f2937;
            }
            th.text-center {
              text-align: center;
            }
            th.text-right {
              text-align: right;
            }
            td {
              padding: 8px;
              border: 1px solid #e5e7eb;
              font-size: 10px;
            }
            tbody tr:nth-child(even) {
              background: #f9fafb;
            }
            tbody tr:hover {
              background: #f3f4f6;
            }
            .text-right {
              text-align: right;
            }
            .text-center {
              text-align: center;
            }
            .text-bold {
              font-weight: 700;
            }
            .total-row {
              background: #1f2937 !important;
              color: white;
              font-weight: 700;
            }
            .total-row td {
              border-color: #374151;
              padding: 10px 8px;
            }
            .footer {
              margin-top: 30px;
              padding-top: 15px;
              border-top: 2px solid #e5e7eb;
              font-size: 10px;
              color: #6b7280;
              text-align: center;
            }
            .badge {
              display: inline-block;
              padding: 3px 8px;
              border-radius: 4px;
              font-size: 9px;
              font-weight: 600;
            }
            .badge-with-salary {
              background: #dbeafe;
              color: #1e40af;
            }
            .badge-separately {
              background: #dcfce7;
              color: #166534;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="header-top">
              <div class="header-info">Printed On Date : ${printDate}</div>
              <div class="header-info">Printed On Day : ${printDay}</div>
            </div>
            <div class="header-title">
              <h1>Employee Bonus Report</h1>
              <p>Generated on ${format(new Date(), "MMMM dd, yyyy 'at' hh:mm a")}</p>
            </div>
          </div>

          <div class="summary">
            <div class="summary-item">
              <div class="summary-label">Total Employees</div>
              <div class="summary-value">${data.length}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Bonus Amount</div>
              <div class="summary-value">${new Intl.NumberFormat("en-PK", {
                style: "currency",
                currency: "PKR",
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }).format(totalBonusAmount)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Tax Amount</div>
              <div class="summary-value">${new Intl.NumberFormat("en-PK", {
                style: "currency",
                currency: "PKR",
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }).format(totalTaxAmount)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Net Amount</div>
              <div class="summary-value">${new Intl.NumberFormat("en-PK", {
                style: "currency",
                currency: "PKR",
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }).format(totalNet)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Active Bonuses</div>
              <div class="summary-value">${activeCount}</div>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th class="text-center">S.No</th>
                <th>EMP ID</th>
                <th>Emp Name</th>
                <th>Department</th>
                <th>Bonus Type</th>
                <th class="text-center">Bonus Pay</th>
                <th class="text-right">Bonus Amount</th>
                <th class="text-right">Tax Amount</th>
                <th class="text-right">Total Net</th>
                <th class="text-center">Month-Year</th>
                <th class="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              ${data.map((row, index) => {
                const taxAmount = 0; // Can be calculated based on taxPercentage if available
                const netAmount = Number(row.amount) - taxAmount;
                const paymentMethodLabel = row.paymentMethod === "with_salary" ? "With Salary" : "Separately";
                const statusLabel = row.status?.charAt(0).toUpperCase() + row.status?.slice(1) || "Active";
                
                return `
                  <tr>
                    <td class="text-center">${index + 1}</td>
                    <td>${row.employeeCode}</td>
                    <td>${row.employeeName}</td>
                    <td>${row.department}${row.subDepartment ? ` / ${row.subDepartment}` : ""}</td>
                    <td>${row.bonusTypeName}</td>
                    <td class="text-center">
                      <span class="badge ${row.paymentMethod === "with_salary" ? "badge-with-salary" : "badge-separately"}">
                        ${paymentMethodLabel}
                      </span>
                    </td>
                    <td class="text-right text-bold">${new Intl.NumberFormat("en-PK", {
                      style: "currency",
                      currency: "PKR",
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }).format(Number(row.amount))}</td>
                    <td class="text-right">${new Intl.NumberFormat("en-PK", {
                      style: "currency",
                      currency: "PKR",
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }).format(taxAmount)}</td>
                    <td class="text-right text-bold">${new Intl.NumberFormat("en-PK", {
                      style: "currency",
                      currency: "PKR",
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    }).format(netAmount)}</td>
                    <td class="text-center">${row.bonusMonthYear}</td>
                    <td class="text-center">${statusLabel}</td>
                  </tr>
                `;
              }).join('')}
              <tr class="total-row">
                <td colspan="6" class="text-bold">Total</td>
                <td class="text-right text-bold">${new Intl.NumberFormat("en-PK", {
                  style: "currency",
                  currency: "PKR",
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }).format(totalBonusAmount)}</td>
                <td class="text-right text-bold">${new Intl.NumberFormat("en-PK", {
                  style: "currency",
                  currency: "PKR",
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }).format(totalTaxAmount)}</td>
                <td class="text-right text-bold">${new Intl.NumberFormat("en-PK", {
                  style: "currency",
                  currency: "PKR",
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }).format(totalNet)}</td>
                <td colspan="2"></td>
              </tr>
            </tbody>
          </table>

          <div class="footer">
            <p><strong>This is a system-generated document. Confidential and for internal use only.</strong></p>
            <p>Generated by Speed Limit HR System | ${format(new Date(), "dd MMMM yyyy 'at' hh:mm a")}</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    
    // Wait for content to load, then print
    setTimeout(() => {
      printWindow.print();
    }, 300);
    
    toast.success("Print dialog opened");
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
      "Bonus Type",
      "Amount",
      "Percentage",
      "Payment Method",
      "Adjustment Method",
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
      row.bonusTypeName,
      row.amount.toString(),
      row.percentage?.toString() || "—",
      row.paymentMethod === "with_salary" ? "Pay with Salary" : "Separately",
      row.adjustmentMethod === "distributed-remaining-months" ? "Distributed" : "Deduct Current",
      row.bonusMonthYear,
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
    link.download = `bonus_list_${format(new Date(), "yyyy-MM-dd")}.csv`;
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
      bonusTypeId: "all",
      status: "all",
      month: "all",
      year: "all",
      paymentMethod: "all",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Gift className="h-6 w-6" />
            View Employee Bonus List
          </h2>
          <p className="text-muted-foreground">
            Search and view employee bonus records
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canCreate && (
            <Link href="/hr/payroll-setup/bonus/issue">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Issue Bonus
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

      <BonusFilters
        departments={departments}
        subDepartments={subDepartments}
        employees={employees}
        bonusTypes={bonusTypes}
        loading={loading}
        loadingSubDepartments={loadingSubDepartments}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onReset={handleResetFilters}
      />

      <DataTable<BonusRow>
        columns={columns}
        data={data}
        searchFields={[
          { key: "employeeName", label: "Employee Name" },
          { key: "employeeCode", label: "Employee ID" },
          { key: "department", label: "Department" },
          { key: "bonusTypeName", label: "Bonus Type" },
        ]}
        tableId="bonus-list"
      />
    </div>
  );
}

