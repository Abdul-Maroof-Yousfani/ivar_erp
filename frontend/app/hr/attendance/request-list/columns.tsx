"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { AttendanceRequestQuery } from "@/lib/actions/attendance-request-query";
import { format } from "date-fns";

export interface AttendanceRequestQueryRow extends AttendanceRequestQuery {
  sNo: number;
}

const statusVariant = (status: string): "default" | "secondary" | "destructive" => {
  if (status === "approved") return "default";
  if (status === "rejected") return "destructive";
  return "secondary";
};

const formatTime = (time: string | null | undefined): string => {
  if (!time) return "-";
  try {
    // Assuming time is in HH:mm format
    const [hours, minutes] = time.split(":");
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  } catch {
    return time;
  }
};

const formatDate = (date: string): string => {
  try {
    return format(new Date(date), "MMM dd, yyyy");
  } catch {
    return date;
  }
};

export const columns: ColumnDef<AttendanceRequestQueryRow>[] = [
  {
    accessorKey: "sNo", 
    header: "S.No",
    size: 60,
  },
  {
    accessorKey: "employeeName",
    header: "Employee",
    cell: ({ row }) => {
      const employeeName = row.original.employeeName || "-";
      const employeeId = row.original.employeeId || "";
      return (
        <div>
          <div className="font-medium">{employeeName}</div>
          {employeeId && <div className="text-xs text-muted-foreground">{employeeId}</div>}
        </div>
      );
    },
    size: 150,
  },
  // {
  //   accessorKey: "employeeId",
  //   header: "Employee ID",
  //   enableHiding: true,
  //   size: 0, // Hidden column, only used for filtering
  // },
  {
    accessorKey: "attendanceDate",
    header: "Att Date",
    cell: ({ row }) => {
      return formatDate(row.original.attendanceDate);
    },
    size: 120,
    enableHiding:true,
    
  },
  {
    accessorKey: "clockInTimeRequest",
    header: "In/Out Request",
    cell: ({ row }) => {
      const inTime = formatTime(row.original.clockInTimeRequest);
      const outTime = formatTime(row.original.clockOutTimeRequest);
      return `${inTime} - ${outTime}`;
    },
    size: 150,
  },
  {
    accessorKey: "breakIn",
    header: "Break In/Out",
    cell: ({ row }) => {
      const breakIn = formatTime(row.original.breakIn);
      const breakOut = formatTime(row.original.breakOut);
      return `${breakIn} - ${breakOut}`;
    },
    size: 150,
  },
  {
    accessorKey: "approvalStatus",
    header: "Approval",
    cell: ({ row }) => {
      const status = row.original.approvalStatus || "pending";
      return (
        <Badge variant={statusVariant(status)}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </Badge>
      );
    },
    size: 100,
  },
  {
    accessorKey: "query",
    header: "Query",
    cell: ({ row }) => {
      const query = row.original.query || "-";
      return (
        <div className="max-w-[300px] truncate" title={query}>
          {query}
        </div>
      );
    },
    size: 200,
  },
];

