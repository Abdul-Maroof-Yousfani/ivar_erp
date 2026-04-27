"use client";

import DataTable from "@/components/common/data-table";
import { columns, type OvertimeRow } from "./columns";
import { Button } from "@/components/ui/button";
import { Printer, Download } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface OvertimeListProps {
  initialData?: OvertimeRow[];
}

export function OvertimeList({ initialData = [] }: OvertimeListProps) {
  const data: OvertimeRow[] = initialData;

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
      "Overtime Type",
      "Weekday Overtime Hours",
      "Holiday Overtime Hours",
      "Date",
      "Approval 1",
    ];

    const rows = data.map((row) => [
      row.sNo,
      row.employeeName,
      row.overtimeType,
      row.weekdayOvertimeHours.toFixed(2),
      row.holidayOvertimeHours.toFixed(2),
      row.date,
      row.approval1,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `overtime_request_list_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    toast.success("Data exported successfully");
  };

  return (
    <div className="space-y-6 w-full max-w-full overflow-x-hidden">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Overtime Request List
          </h2>
          <p className="text-muted-foreground">
            View and manage overtime requests
          </p>
        </div>
        <div className="flex gap-2">
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

      <div className="w-full max-w-full overflow-x-hidden">
        <DataTable
          columns={columns}
          data={data}
          searchFields={[
            { key: "employeeName", label: "Employee Name" },
            { key: "overtimeType", label: "Overtime Type" },
          ]}tableId="overtime-list"
        />
      </div>
    </div>
  );
}

