"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  User, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  CalendarOff, 
  Timer, 
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Briefcase
} from "lucide-react";

export interface AttendanceProgressRow {
  id: string;
  sNo: number;
  employeeId: string;
  employeeName: string;
  department: string;
  departmentName?: string;
  subDepartment?: string;
  subDepartmentName?: string;
  designation?: string;
  designationName?: string;
  days: number;
  scheduleDays: number;
  offDays: number;
  present: number;
  presentOnHoliday: number;
  leaves: number;
  absents: number;
  late: number;
  halfDay: number;
  shortDays: number;
  scheduleTime: string;
  actualWorkedTime: string;
  breakTime: string;
  absentTime: string;
  overtimeBeforeTime: string;
  overtimeAfterTime: string;
  shortExcessTime: string;
}

export const columns: ColumnDef<AttendanceProgressRow>[] = [
  {
    accessorKey: "sNo",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        #
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm font-medium text-muted-foreground w-8">
        {row.original.sNo}
      </div>
    ),
    size: 60,
  },
  {
    accessorKey: "employee",
    header: () => (
      <div className="flex items-center gap-2">
        <User className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Employee
        </span>
      </div>
    ),
    cell: ({ row }) => {
      const employeeName = row.original.employeeName || "-";
      return (
        <div className="font-semibold text-sm">{employeeName}</div>
      );
    },
    size: 160,
  },
  {
    accessorKey: "empDetail",
    header: () => (
      <div className="flex items-center gap-2">
        <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Details
        </span>
      </div>
    ),
    cell: ({ row }) => {
      const employeeId = row.original.employeeId || "-";
      const department = row.original.departmentName || "-";
      const designation = row.original.designationName || "-";
      return (
        <div className="space-y-0.5">
          <div className="text-xs font-medium text-foreground">ID: <span className="text-muted-foreground">{employeeId}</span></div>
          <div className="text-xs text-muted-foreground truncate max-w-[150px]" title={department}>
            {department}
          </div>
          <div className="text-xs text-muted-foreground truncate max-w-[150px]" title={designation}>
            {designation}
          </div>
        </div>
      );
    },
    size: 180,
  },
  {
    accessorKey: "days",
    header: () => (
      <div className="flex items-center gap-2">
        <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Days
        </span>
      </div>
    ),
    cell: ({ row }) => (
      <div className="text-sm font-medium">
        {row.original.days || 0}
      </div>
    ),
    size: 80,
  },
  {
    accessorKey: "scheduleDays",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Scheduled
      </div>
    ),
    cell: ({ row }) => (
      <Badge variant="outline" className="font-medium">
        {row.original.scheduleDays || 0}
      </Badge>
    ),
    size: 110,
  },
  {
    accessorKey: "offDays",
    header: () => (
      <div className="flex items-center gap-2">
        <CalendarOff className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Off Days
        </span>
      </div>
    ),
    cell: ({ row }) => (
      <Badge variant="secondary" className="font-medium">
        {row.original.offDays || 0}
      </Badge>
    ),
    size: 110,
  },
  {
    accessorKey: "present",
    header: () => (
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Present
        </span>
      </div>
    ),
    cell: ({ row }) => {
      const value = row.original.present || 0;
      return (
        <Badge className="bg-green-500 hover:bg-green-600 text-white font-medium">
          {value}
        </Badge>
      );
    },
    size: 100,
  },
  {
    accessorKey: "presentOnHoliday",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Holiday Work
      </div>
    ),
    cell: ({ row }) => {
      const value = row.original.presentOnHoliday || 0;
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-medium">
          {value}
        </Badge>
      );
    },
    size: 120,
  },
  {
    accessorKey: "leaves",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Leaves
      </div>
    ),
    cell: ({ row }) => {
      const value = row.original.leaves || 0;
      return (
        <Badge className="bg-blue-500 hover:bg-blue-600 text-white font-medium">
          {value}
        </Badge>
      );
    },
    size: 90,
  },
  {
    accessorKey: "absents",
    header: () => (
      <div className="flex items-center gap-2">
        <XCircle className="h-3.5 w-3.5 text-red-600" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Absent
        </span>
      </div>
    ),
    cell: ({ row }) => {
      const value = row.original.absents || 0;
      return (
        <Badge variant="destructive" className="font-medium">
          {value}
        </Badge>
      );
    },
    size: 100,
  },
  {
    accessorKey: "late",
    header: () => (
      <div className="flex items-center gap-2">
        <AlertCircle className="h-3.5 w-3.5 text-yellow-600" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Late
        </span>
      </div>
    ),
    cell: ({ row }) => {
      const value = row.original.late || 0;
      return (
        <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white font-medium">
          {value}
        </Badge>
      );
    },
    size: 80,
  },
  {
    accessorKey: "halfDay",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Half Day
      </div>
    ),
    cell: ({ row }) => {
      const value = row.original.halfDay || 0;
      return (
        <Badge className="bg-orange-500 hover:bg-orange-600 text-white font-medium">
          {value}
        </Badge>
      );
    },
    size: 100,
  },
  {
    accessorKey: "shortDays",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Short Days
      </div>
    ),
    cell: ({ row }) => {
      const value = row.original.shortDays || 0;
      return (
        <Badge variant="outline" className="font-medium border-orange-300 text-orange-700 dark:text-orange-400">
          {value}
        </Badge>
      );
    },
    size: 110,
  },
  {
    accessorKey: "scheduleTime",
    header: () => (
      <div className="flex items-center gap-2">
        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Scheduled
        </span>
      </div>
    ),
    cell: ({ row }) => {
      const value = row.original.scheduleTime || "0h";
      return (
        <div className="text-sm font-medium text-foreground">
          {value}
        </div>
      );
    },
    size: 110,
  },
  {
    accessorKey: "actualWorkedTime",
    header: () => (
      <div className="flex items-center gap-2">
        <Timer className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Worked
        </span>
      </div>
    ),
    cell: ({ row }) => {
      const value = row.original.actualWorkedTime || "0h";
      return (
        <div className="text-sm font-semibold text-green-600 dark:text-green-400">
          {value}
        </div>
      );
    },
    size: 110,
  },
  {
    accessorKey: "breakTime",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Break
      </div>
    ),
    cell: ({ row }) => {
      const value = row.original.breakTime || "0h";
      return (
        <div className="text-sm font-medium text-muted-foreground">
          {value}
        </div>
      );
    },
    size: 90,
  },
  {
    accessorKey: "absentTime",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Absent Time
      </div>
    ),
    cell: ({ row }) => {
      const value = row.original.absentTime || "0h";
      return (
        <div className="text-sm font-medium text-red-600 dark:text-red-400">
          {value}
        </div>
      );
    },
    size: 110,
  },
  {
    accessorKey: "overtimeBeforeTime",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        OT Before
      </div>
    ),
    cell: ({ row }) => {
      const value = row.original.overtimeBeforeTime || "0h";
      const hasOvertime = value !== "0h" && parseFloat(value) > 0;
      return (
        <div className={cn(
          "text-sm font-medium",
          hasOvertime ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
        )}>
          {value}
        </div>
      );
    },
    size: 100,
  },
  {
    accessorKey: "overtimeAfterTime",
    header: () => (
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        OT After
      </div>
    ),
    cell: ({ row }) => {
      const value = row.original.overtimeAfterTime || "0h";
      const hasOvertime = value !== "0h" && parseFloat(value) > 0;
      return (
        <div className={cn(
          "text-sm font-medium",
          hasOvertime ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
        )}>
          {value}
        </div>
      );
    },
    size: 100,
  },
  {
    accessorKey: "shortExcessTime",
    header: () => (
      <div className="flex items-center gap-2">
        {parseFloat("0") >= 0 ? (
          <TrendingUp className="h-3.5 w-3.5 text-green-600" />
        ) : (
          <TrendingDown className="h-3.5 w-3.5 text-red-600" />
        )}
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Short/Excess
        </span>
      </div>
    ),
    cell: ({ row }) => {
      const value = row.original.shortExcessTime || "0h";
      const numValue = parseFloat(value.replace('h', ''));
      const isPositive = numValue >= 0;
      return (
        <div className={cn(
          "text-sm font-semibold flex items-center gap-1",
          isPositive 
            ? "text-green-600 dark:text-green-400" 
            : "text-red-600 dark:text-red-400"
        )}>
          {isPositive ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          {value}
        </div>
      );
    },
    size: 130,
  },
];

