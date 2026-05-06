"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import DataTable from "@/components/common/data-table";
import { columns, type LeaveEncashmentRow } from "./columns";
import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface LeaveEncashmentListProps {
  initialData?: any[]; // TODO: Replace with proper LeaveEncashment type when backend is ready
}

export function LeaveEncashmentList({ initialData = [] }: LeaveEncashmentListProps) {
  const router = useRouter();

  // Transform API data to row format
  const transformToRows = (encashments: any[]): LeaveEncashmentRow[] => {
    return encashments.map((encashment, index) => ({
      id: encashment.id || `temp-${index}`,
      sNo: index + 1,
      employeeId: encashment.employeeId || "",
      employeeName: encashment.employee?.employeeName || encashment.employeeName || "—",
      employeeCode: encashment.employee?.employeeId || encashment.employeeCode || "—",
      encashmentDate: encashment.encashmentDate || "",
      encashmentDays: encashment.encashmentDays ? Number(encashment.encashmentDays) : 0,
      encashmentAmount: encashment.encashmentAmount ? Number(encashment.encashmentAmount) : 0,
      approvalStatus: encashment.approvalStatus || "pending",
      status: encashment.status || "active",
      createdAt: encashment.createdAt || new Date().toISOString(),
      createdById: encashment.createdById,
    }));
  };

  // Transform initial data to row format
  const data = useMemo(() => transformToRows(initialData), [initialData]);

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
      "Employee Name",
      "Encashment Date",
      "Encashment Days",
      "Encashment Amount",
      "Approval 1",
    ];

    const rows = data.map((row) => [
      row.sNo,
      row.employeeName,
      row.encashmentDate ? format(new Date(row.encashmentDate), "dd-MMM-yyyy") : "—",
      row.encashmentDays.toString(),
      row.encashmentAmount.toLocaleString("en-US"),
      row.approvalStatus,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `leave_encashment_list_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    toast.success("Data exported successfully");
  };

  const handleToggle = () => {
    router.push("/hr/payroll-setup/leave-encashment/create");
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center justify-between flex-wrap gap-4 mb-2">
          <h2 className="text-2xl font-bold tracking-tight">Leave Encashment Request List</h2>
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
          View and manage leave encashment records
        </p>
      </div>

      <DataTable<LeaveEncashmentRow>
        columns={columns}
        data={data}
        actionText="Create Leave Encashment"
        toggleAction={handleToggle}
        searchFields={[
          { key: "employeeName", label: "Employee Name" },
          { key: "employeeCode", label: "Employee Code" },
        ]}
        tableId="leave-encashment-list"
      />
    </div>
  );
}

