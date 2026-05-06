"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import type { AttendanceExemptionRow } from "./attendance-exemptions-list";
import { format } from "date-fns";

const statusVariant = (status: string): "default" | "secondary" | "destructive" => {
  if (status === "approved") return "default";
  if (status === "rejected") return "destructive";
  return "secondary";
};

const getExemptionTypeVariant = (exemptionType: string | null | undefined): "default" | "secondary" | "destructive" | "outline" => {
  if (!exemptionType) return "secondary";
  const type = exemptionType.toLowerCase();
  
  // Map different exemption types to badge variants
  if (type.includes("late") || type.includes("arrival")) return "destructive";
  if (type.includes("early") || type.includes("departure")) return "outline";
  if (type.includes("absent") || type.includes("missing")) return "destructive";
  if (type.includes("present") || type.includes("attendance")) return "default";
  
  return "secondary";
};

const getExemptionTypeColor = (exemptionType: string | null | undefined): string => {
  if (!exemptionType) return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200";
  const type = exemptionType.toLowerCase();
  
  // Map different exemption types to distinct Tailwind colors
  if (type.includes("late") || type.includes("arrival")) {
    return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-300 dark:border-red-700";
  }
  if (type.includes("early") || type.includes("departure")) {
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-300 dark:border-amber-700";
  }
  if (type.includes("absent") || type.includes("missing")) {
    return "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border border-rose-300 dark:border-rose-700";
  }
  if (type.includes("present") || type.includes("attendance")) {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700";
  }
  if (type.includes("break") || type.includes("lunch")) {
    return "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-700";
  }
  if (type.includes("overtime") || type.includes("extra")) {
    return "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border border-violet-300 dark:border-violet-700";
  }
  if (type.includes("sick") || type.includes("medical")) {
    return "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300 border border-pink-300 dark:border-pink-700";
  }
  if (type.includes("holiday") || type.includes("vacation")) {
    return "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-700";
  }
  if (type.includes("emergency")) {
    return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border border-orange-300 dark:border-orange-700";
  }
  
  // Default color - use teal for unknown types
  return "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 border border-teal-300 dark:border-teal-700";
};

const formatDate = (date: string): string => {
  try {
    return format(new Date(date), "MMM dd, yyyy");
  } catch {
    return date;
  }
};

export const columns: ColumnDef<AttendanceExemptionRow>[] = [
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
  {
    accessorKey: "department",
    header: "Department",
    cell: ({ row }) => {
      return row.original.department || "-";
    },
    size: 120,
  },
  {
    accessorKey: "subDepartment",
    header: "Sub Department",
    cell: ({ row }) => {
      return row.original.subDepartment || "-";
    },
    size: 140,
  },
  {
    accessorKey: "attendanceDate",
    header: "Attendance Date",
    cell: ({ row }) => {
      return formatDate(row.original.attendanceDate);
    },
    size: 140,
  },
  {
    accessorKey: "flagType",
    header: "Flag Type",
    cell: ({ row }) => {
      return row.original.flagType || "-";
    },
    size: 120,
  },
  {
    accessorKey: "exemptionType",
    header: "Exemption Type",
    cell: ({ row }) => {
      const exemptionType = row.original.exemptionType || "-";
      if (exemptionType === "-") {
        return "-";
      }
      return (
        <Badge className={getExemptionTypeColor(exemptionType)}>
          {exemptionType}
        </Badge>
      );
    },
    size: 150,
  },
  {
    accessorKey: "reason",
    header: "Reason",
    cell: ({ row }) => {
      const reason = row.original.reason || "-";
      return (
        <div className="max-w-[300px] truncate" title={reason}>
          {reason}
        </div>
      );
    },
    size: 200,
  },
  {
    accessorKey: "approvalStatus",
    header: "Approval Status",
    cell: ({ row }) => {
      // Always show "Approved" by default
      return (
        <Badge variant="default">
          Approved
        </Badge>
      );
    },
    size: 120,
  },
];

