"use client";

import { ColumnDef, Row } from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HighlightText } from "@/components/common/data-table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { EllipsisIcon, Loader2, Pencil, Trash2, Clock, Eye } from "lucide-react";
import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { WorkingHoursPolicy, updateWorkingHoursPolicy, deleteWorkingHoursPolicy, getWorkingHoursPolicyById } from "@/lib/actions/working-hours-policy";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useAuth } from "@/components/providers/auth-provider";

export type WorkingHoursPolicyRow = WorkingHoursPolicy & { id: string; sno?: number };

export const columns: ColumnDef<WorkingHoursPolicyRow>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
    enableHiding: false,
    size: 28,
  },
  {
    header: "S.No",
    accessorKey: "sno",
    size: 60,
    cell: ({ row, table }) => {
      const pageIndex = table.getState().pagination.pageIndex;
      const pageSize = table.getState().pagination.pageSize;
      return pageIndex * pageSize + row.index + 1;
    },
    enableSorting: false,
  },
  {
    header: "Policy Name",
    accessorKey: "name",
    size: 200,
    enableSorting: true,
    cell: ({ row }) => <HighlightText text={row.original.name} />,
  },
  {
    header: "Start Time",
    accessorKey: "startWorkingHours",
    size: 120,
    enableSorting: true,
    cell: ({ row }) => (
      <HighlightText text={row.original.startWorkingHours || "N/A"} />
    ),
  },
  {
    header: "End Time",
    accessorKey: "endWorkingHours",
    size: 120,
    enableSorting: true,
    cell: ({ row }) => (
      <HighlightText text={row.original.endWorkingHours || "N/A"} />
    ),
  },
  {
    header: "Late Time",
    accessorKey: "lateStartTime",
    size: 120,
    enableSorting: true,
    cell: ({ row }) => (
      <HighlightText text={row.original.lateStartTime || "N/A"} />
    ),
  },
  {
    header: "Half Day Time",
    accessorKey: "halfDayStartTime",
    size: 130,
    enableSorting: true,
    cell: ({ row }) => (
      <HighlightText text={row.original.halfDayStartTime || "N/A"} />
    ),
  },
  {
    header: "Created By",
    accessorKey: "createdBy",
    size: 150,
    enableSorting: true,
    cell: ({ row }) => (
      <HighlightText text={row.original.createdBy || "N/A"} />
    ),
  },
  {
    header: "Status",
    accessorKey: "status",
    size: 100,
    enableSorting: true,
    cell: ({ row }) => (
      <Badge
        variant={row.original.status === "inactive" ? "secondary" : "default"}
      >
        {row.original.status || "active"}
      </Badge>
    ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => <RowActions row={row} />,
    size: 60,
    enableHiding: false,
  },
];

type RowActionsProps = {
  row: Row<WorkingHoursPolicyRow>;
};

// Time picker helper functions
const formatTimeForDisplay = (time: string, showNA: boolean = false): string => {
  if (!time) return showNA ? "N/A" : "--:--";
  const [hours, minutes] = time.split(":");
  const hour24 = parseInt(hours, 10);
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  const ampm = hour24 >= 12 ? "PM" : "AM";
  return `${hour12.toString().padStart(2, "0")}:${minutes} ${ampm}`;
};

// Convert 24-hour to 12-hour format
const convert24To12 = (
  time24: string
): { hour: string; minute: string; ampm: string } => {
  if (!time24) return { hour: "", minute: "", ampm: "AM" };
  const [h, m] = time24.split(":");
  const hour24 = parseInt(h, 10);
  const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  const ampm = hour24 >= 12 ? "PM" : "AM";
  return {
    hour: hour12.toString().padStart(2, "0"),
    minute: m || "00",
    ampm,
  };
};

// Convert 12-hour to 24-hour format
const convert12To24 = (
  hour12: string,
  minute: string,
  ampm: string
): string => {
  if (!hour12 || !minute) return "";
  let hour24 = parseInt(hour12, 10);
  if (ampm === "PM" && hour24 !== 12) {
    hour24 += 12;
  } else if (ampm === "AM" && hour24 === 12) {
    hour24 = 0;
  }
  return `${hour24.toString().padStart(2, "0")}:${minute.padStart(2, "0")}`;
};

// Convert grouped dayOverrides to individual day format for editing
const convertGroupedToIndividual = (
  dayOverrides: WorkingHoursPolicy["dayOverrides"]
): {
  [key: string]: {
    enabled: boolean;
    overrideHours: boolean;
    startTime: string;
    endTime: string;
    overrideBreak: boolean;
    startBreakTime: string;
    endBreakTime: string;
    dayType: "full" | "half" | "custom";
  };
} => {
  if (!dayOverrides) {
    return {
      monday: { enabled: true, overrideHours: false, startTime: "", endTime: "", overrideBreak: false, startBreakTime: "", endBreakTime: "", dayType: "full" },
      tuesday: { enabled: true, overrideHours: false, startTime: "", endTime: "", overrideBreak: false, startBreakTime: "", endBreakTime: "", dayType: "full" },
      wednesday: { enabled: true, overrideHours: false, startTime: "", endTime: "", overrideBreak: false, startBreakTime: "", endBreakTime: "", dayType: "full" },
      thursday: { enabled: true, overrideHours: false, startTime: "", endTime: "", overrideBreak: false, startBreakTime: "", endBreakTime: "", dayType: "full" },
      friday: { enabled: true, overrideHours: false, startTime: "", endTime: "", overrideBreak: false, startBreakTime: "", endBreakTime: "", dayType: "full" },
      saturday: { enabled: false, overrideHours: false, startTime: "", endTime: "", overrideBreak: false, startBreakTime: "", endBreakTime: "", dayType: "full" },
      sunday: { enabled: false, overrideHours: false, startTime: "", endTime: "", overrideBreak: false, startBreakTime: "", endBreakTime: "", dayType: "full" },
    };
  }

  // If it's already in individual format (object), return as is
  if (!Array.isArray(dayOverrides)) {
    return dayOverrides;
  }

  // Convert grouped array to individual format
  const result: {
    [key: string]: {
      enabled: boolean;
      overrideHours: boolean;
      startTime: string;
      endTime: string;
      overrideBreak: boolean;
      startBreakTime: string;
      endBreakTime: string;
      dayType: "full" | "half" | "custom";
    };
  } = {};

  dayOverrides.forEach((group) => {
    group.days.forEach((dayKey) => {
      result[dayKey] = {
        enabled: group.enabled,
        overrideHours: group.overrideHours,
        startTime: group.startTime || "",
        endTime: group.endTime || "",
        overrideBreak: group.overrideBreak,
        startBreakTime: group.startBreakTime || "",
        endBreakTime: group.endBreakTime || "",
        dayType: group.dayType,
      };
    });
  });

  return result;
};

// Format day group label (e.g., "Mon-Thu" or "Friday")
const formatDayGroupLabel = (days: string[], daysOfWeek: { key: string; label: string }[]): string => {
  if (days.length === 1) {
    return daysOfWeek.find((d) => d.key === days[0])?.label || days[0];
  }
  
  const dayIndices = days.map((day) => 
    daysOfWeek.findIndex((d) => d.key === day)
  ).sort((a, b) => a - b);
  
  // Check if days are consecutive
  const isConsecutive = dayIndices.every((idx, i) => 
    i === 0 || idx === dayIndices[i - 1] + 1
  );
  
  if (isConsecutive && dayIndices.length > 1) {
    const firstDay = daysOfWeek[dayIndices[0]].label;
    const lastDay = daysOfWeek[dayIndices[dayIndices.length - 1]].label;
    return `${firstDay.substring(0, 3)}-${lastDay.substring(0, 3)}`;
  }
  
  // Non-consecutive days
  return days
    .map((day) => daysOfWeek.find((d) => d.key === day)?.label.substring(0, 3))
    .join(", ");
};

// Group days with the same configuration
const groupDayOverrides = (
  dayOverrides: {
    [key: string]: {
      enabled: boolean;
      overrideHours: boolean;
      startTime: string;
      endTime: string;
      overrideBreak: boolean;
      startBreakTime: string;
      endBreakTime: string;
      dayType: "full" | "half" | "custom";
    };
  },
  daysOfWeek: { key: string; label: string }[]
): Array<{
  days: string[];
  enabled: boolean;
  overrideHours: boolean;
  startTime: string;
  endTime: string;
  overrideBreak: boolean;
  startBreakTime: string;
  endBreakTime: string;
  dayType: "full" | "half" | "custom";
}> => {
  const groups: Array<{
    days: string[];
    enabled: boolean;
    overrideHours: boolean;
    startTime: string;
    endTime: string;
    overrideBreak: boolean;
    startBreakTime: string;
    endBreakTime: string;
    dayType: "full" | "half" | "custom";
  }> = [];

  const configMap = new Map<string, string[]>();

  // Group days by their configuration
  daysOfWeek.forEach((day) => {
    const dayData = dayOverrides[day.key];
    if (!dayData) return;
    
    const configKey = JSON.stringify({
      enabled: dayData.enabled,
      overrideHours: dayData.overrideHours,
      startTime: dayData.startTime,
      endTime: dayData.endTime,
      overrideBreak: dayData.overrideBreak,
      startBreakTime: dayData.startBreakTime,
      endBreakTime: dayData.endBreakTime,
      dayType: dayData.dayType,
    });
    
    if (!configMap.has(configKey)) {
      configMap.set(configKey, []);
    }
    configMap.get(configKey)!.push(day.key);
  });

  // Create groups from the map
  configMap.forEach((days, configKey) => {
    const firstDay = days[0];
    const dayData = dayOverrides[firstDay];
    groups.push({
      days,
      enabled: dayData.enabled,
      overrideHours: dayData.overrideHours,
      startTime: dayData.startTime,
      endTime: dayData.endTime,
      overrideBreak: dayData.overrideBreak,
      startBreakTime: dayData.startBreakTime,
      endBreakTime: dayData.endBreakTime,
      dayType: dayData.dayType,
    });
  });

  return groups;
};

const TimePicker = ({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const time12 = convert24To12(value);
  const [hours, setHours] = useState(time12.hour);
  const [minutes, setMinutes] = useState(time12.minute);
  const [ampm, setAmpm] = useState<"AM" | "PM">(time12.ampm as "AM" | "PM");

  // Update local state when value prop changes
  useEffect(() => {
    const time12 = convert24To12(value);
    setHours(time12.hour);
    setMinutes(time12.minute);
    setAmpm(time12.ampm as "AM" | "PM");
  }, [value]);

  const handleHourChange = (h: string) => {
    setHours(h);
    if (h && minutes) {
      const time24 = convert12To24(h, minutes, ampm);
      onChange(time24);
    } else if (h && !minutes) {
      setMinutes("00");
      const time24 = convert12To24(h, "00", ampm);
      onChange(time24);
    }
  };

  const handleMinuteChange = (m: string) => {
    setMinutes(m);
    if (hours && m) {
      const time24 = convert12To24(hours, m, ampm);
      onChange(time24);
    } else if (!hours && m) {
      setHours("12");
      const time24 = convert12To24("12", m, ampm);
      onChange(time24);
    }
  };

  const handleAmpmChange = (value: "AM" | "PM") => {
    setAmpm(value);
    if (hours && minutes) {
      const time24 = convert12To24(hours, minutes, value);
      onChange(time24);
    }
  };

  const hourOptions = Array.from({ length: 12 }, (_, i) =>
    (i + 1).toString().padStart(2, "0")
  );
  const minuteOptions = Array.from({ length: 60 }, (_, i) =>
    i.toString().padStart(2, "0")
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground"
          )}
          disabled={disabled}
        >
          <Clock className="mr-2 h-4 w-4" />
          {value ? formatTimeForDisplay(value) : "--:--"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4" align="start">
        <div className="flex gap-2 items-center">
          <div className="space-y-2">
            <Label className="text-xs">Hour</Label>
            <Select
              value={hours}
              onValueChange={handleHourChange}
              disabled={disabled}
            >
              <SelectTrigger className="w-20">
                <SelectValue placeholder="HH" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                {hourOptions.map((h) => (
                  <SelectItem key={h} value={h}>
                    {h}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="text-2xl font-bold mt-6">:</span>
          <div className="space-y-2">
            <Label className="text-xs">Minute</Label>
            <Select
              value={minutes}
              onValueChange={handleMinuteChange}
              disabled={disabled}
            >
              <SelectTrigger className="w-20">
                <SelectValue placeholder="MM" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px]">
                {minuteOptions.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Period</Label>
            <Select
              value={ampm}
              onValueChange={handleAmpmChange}
              disabled={disabled}
            >
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AM">AM</SelectItem>
                <SelectItem value="PM">PM</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

function RowActions({ row }: RowActionsProps) {
  const policy = row.original;
  const { hasPermission } = useAuth();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editDialog, setEditDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [viewDialog, setViewDialog] = useState(false);
  const [viewPolicy, setViewPolicy] = useState<WorkingHoursPolicy | null>(null);
  const [loadingView, setLoadingView] = useState(false);
  
  const daysOfWeek = [
    { key: "monday", label: "Monday" },
    { key: "tuesday", label: "Tuesday" },
    { key: "wednesday", label: "Wednesday" },
    { key: "thursday", label: "Thursday" },
    { key: "friday", label: "Friday" },
    { key: "saturday", label: "Saturday" },
    { key: "sunday", label: "Sunday" },
  ];

  const initializeDayOverrides = () => {
    return convertGroupedToIndividual(policy.dayOverrides);
  };

  const [editData, setEditData] = useState({
    name: policy.name,
    startWorkingHours: policy.startWorkingHours,
    endWorkingHours: policy.endWorkingHours,
    shortDayUnit: "mins" as "hours" | "mins",
    shortDayValue: policy.shortDayMins ? policy.shortDayMins.toString() : "",
    startBreakTime: policy.startBreakTime || "",
    endBreakTime: policy.endBreakTime || "",
    halfDayStartTime: policy.halfDayStartTime || "",
    lateStartTime: policy.lateStartTime || "",
    lateDeductionType: policy.lateDeductionType || "",
    applyDeductionAfterLates: policy.applyDeductionAfterLates?.toString() || "",
    lateDeductionPercent: policy.lateDeductionPercent?.toString() || "",
    halfDayDeductionType: policy.halfDayDeductionType || "",
    applyDeductionAfterHalfDays: policy.applyDeductionAfterHalfDays?.toString() || "",
    halfDayDeductionAmount: policy.halfDayDeductionAmount?.toString() || "",
    shortDayDeductionType: policy.shortDayDeductionType || "",
    applyDeductionAfterShortDays: policy.applyDeductionAfterShortDays?.toString() || "",
    shortDayDeductionAmount: policy.shortDayDeductionAmount?.toString() || "",
    overtimeRate: policy.overtimeRate?.toString() || "",
    gazzetedOvertimeRate: policy.gazzetedOvertimeRate?.toString() || "",
    status: policy.status,
    dayOverrides: initializeDayOverrides(),
  });

  useEffect(() => {
    if (policy.shortDayMins) {
      if (policy.shortDayMins % 60 === 0) {
        setEditData(prev => ({
          ...prev,
          shortDayUnit: "hours",
          shortDayValue: (policy.shortDayMins! / 60).toString(),
        }));
      } else {
        setEditData(prev => ({
          ...prev,
          shortDayUnit: "mins",
          shortDayValue: policy.shortDayMins!.toString(),
        }));
      }
    }
  }, [policy.shortDayMins]);

  const calculateShortDayMins = (): number | null => {
    if (!editData.shortDayValue) return null;
    const value = parseFloat(editData.shortDayValue);
    if (isNaN(value)) return null;
    return editData.shortDayUnit === "hours" ? value * 60 : value;
  };

  const overtimeRateOptions = [
    { value: "0", label: "None" },
    { value: "0.5", label: "x0.5" },
    { value: "1", label: "x1" },
    { value: "1.5", label: "x1.5" },
    { value: "2", label: "x2" },
    { value: "2.5", label: "x2.5" },
    { value: "3", label: "x3" },
  ];

  const handleEditSubmit = async () => {
    if (!editData.name.trim()) {
      toast.error("Policy name is required");
      return;
    }

    if (!editData.startWorkingHours || !editData.endWorkingHours) {
      toast.error("Start and end working hours are required");
      return;
    }

    const shortDayMins = calculateShortDayMins();

    // Validate day overrides
    const enabledDays = Object.entries(editData.dayOverrides).filter(
      ([_, day]) => day.enabled
    );

    if (enabledDays.length === 0) {
      toast.error("At least one day must be enabled");
      return;
    }

    for (const [dayKey, day] of enabledDays) {
      if (day.overrideHours && (!day.startTime || !day.endTime)) {
        toast.error(
          `Please set start and end times for ${
            daysOfWeek.find((d) => d.key === dayKey)?.label
          } or uncheck "Override Hours"`
        );
        return;
      }
    }

    startTransition(async () => {
      const result = await updateWorkingHoursPolicy(policy.id, {
        name: editData.name.trim(),
        startWorkingHours: editData.startWorkingHours,
        endWorkingHours: editData.endWorkingHours,
        shortDayMins,
        startBreakTime: editData.startBreakTime || null,
        endBreakTime: editData.endBreakTime || null,
        halfDayStartTime: editData.halfDayStartTime || null,
        lateStartTime: editData.lateStartTime || null,
        lateDeductionType: editData.lateDeductionType || null,
        applyDeductionAfterLates: editData.applyDeductionAfterLates ? parseInt(editData.applyDeductionAfterLates) : null,
        lateDeductionPercent: editData.lateDeductionPercent ? parseFloat(editData.lateDeductionPercent) : null,
        halfDayDeductionType: editData.halfDayDeductionType || null,
        applyDeductionAfterHalfDays: editData.applyDeductionAfterHalfDays ? parseInt(editData.applyDeductionAfterHalfDays) : null,
        halfDayDeductionAmount: editData.halfDayDeductionAmount ? parseFloat(editData.halfDayDeductionAmount) : null,
        shortDayDeductionType: editData.shortDayDeductionType || null,
        applyDeductionAfterShortDays: editData.applyDeductionAfterShortDays ? parseInt(editData.applyDeductionAfterShortDays) : null,
        shortDayDeductionAmount: editData.shortDayDeductionAmount ? parseFloat(editData.shortDayDeductionAmount) : null,
        overtimeRate: editData.overtimeRate && editData.overtimeRate !== "0" ? parseFloat(editData.overtimeRate) : null,
        gazzetedOvertimeRate: editData.gazzetedOvertimeRate && editData.gazzetedOvertimeRate !== "0" ? parseFloat(editData.gazzetedOvertimeRate) : null,
        status: editData.status,
        dayOverrides: groupDayOverrides(editData.dayOverrides, daysOfWeek),
      });
      if (result.status) {
        toast.success(result.message || "Working hours policy updated successfully");
        setEditDialog(false);
        router.refresh();
      } else {
        toast.error(result.message || "Failed to update working hours policy");
      }
    });
  };

  const handleDeleteConfirm = async () => {
    startTransition(async () => {
      const result = await deleteWorkingHoursPolicy(policy.id);
      if (result.status) {
        toast.success(result.message || "Working hours policy deleted successfully");
        setDeleteDialog(false);
        router.refresh();
      } else {
        toast.error(result.message || "Failed to delete working hours policy");
      }
    });
  };

  const handleView = async () => {
    setViewDialog(true);
    setLoadingView(true);
    try {
      const result = await getWorkingHoursPolicyById(policy.id);
      if (result.status && result.data) {
        setViewPolicy(result.data);
      } else {
        toast.error(result.message || "Failed to load policy details");
        setViewDialog(false);
      }
    } catch (error) {
      toast.error("Failed to load policy details");
      setViewDialog(false);
    } finally {
      setLoadingView(false);
    }
  };


  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <div className="flex justify-end">
            <Button
              size="icon"
              variant="ghost"
              className="shadow-none"
              aria-label="Actions"
            >
              <EllipsisIcon size={16} />
            </Button>
          </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={handleView}>
            <Eye className="h-4 w-4 mr-2" />
            View
          </DropdownMenuItem>
          {hasPermission("hr.working-hour-policy.update") && (
            <DropdownMenuItem onClick={() => setEditDialog(true)}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit
            </DropdownMenuItem>
          )}
          {hasPermission("hr.working-hour-policy.delete") && (
            <DropdownMenuItem
              onClick={() => setDeleteDialog(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Working Hours Policy</DialogTitle>
            <DialogDescription>
              Update the working hours policy details
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Default Working Hours */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Default Working Hours</h3>
              <p className="text-sm text-muted-foreground">
                Set default working hours that will apply to all days. You can
                override specific days in the "Day-wise Overrides" section below.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>
                    Working Hours Policy Name{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={editData.name}
                    onChange={(e) =>
                      setEditData({ ...editData, name: e.target.value })
                    }
                    disabled={isPending}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    Default Start Working Hours{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <TimePicker
                    value={editData.startWorkingHours}
                    onChange={(value) =>
                      setEditData({ ...editData, startWorkingHours: value })
                    }
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    Default End Working Hours{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <TimePicker
                    value={editData.endWorkingHours}
                    onChange={(value) =>
                      setEditData({ ...editData, endWorkingHours: value })
                    }
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Default Start Break Time</Label>
                  <TimePicker
                    value={editData.startBreakTime}
                    onChange={(value) =>
                      setEditData({ ...editData, startBreakTime: value })
                    }
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Default End Break Time</Label>
                  <TimePicker
                    value={editData.endBreakTime}
                    onChange={(value) =>
                      setEditData({ ...editData, endBreakTime: value })
                    }
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Short Day Mins</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="eg: 270"
                      value={editData.shortDayValue}
                      onChange={(e) =>
                        setEditData({ ...editData, shortDayValue: e.target.value })
                      }
                      disabled={isPending}
                      className="flex-1"
                    />
                    <Select
                      value={editData.shortDayUnit}
                      onValueChange={(value: "hours" | "mins") =>
                        setEditData({ ...editData, shortDayUnit: value })
                      }
                      disabled={isPending}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hours">Hours</SelectItem>
                        <SelectItem value="mins">Mins</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Start Break Time</Label>
                  <TimePicker
                    value={editData.startBreakTime}
                    onChange={(value) =>
                      setEditData({ ...editData, startBreakTime: value })
                    }
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Break Time</Label>
                  <TimePicker
                    value={editData.endBreakTime}
                    onChange={(value) =>
                      setEditData({ ...editData, endBreakTime: value })
                    }
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Half Day Start Time</Label>
                  <TimePicker
                    value={editData.halfDayStartTime}
                    onChange={(value) =>
                      setEditData({ ...editData, halfDayStartTime: value })
                    }
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Late Start Time</Label>
                  <TimePicker
                    value={editData.lateStartTime}
                    onChange={(value) =>
                      setEditData({ ...editData, lateStartTime: value })
                    }
                    disabled={isPending}
                  />
                </div>
              </div>
            </div>

            {/* Day-wise Overrides */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Day-wise Overrides</h3>
              <p className="text-sm text-muted-foreground">
                Configure working hours for specific days. Days with the same
                configuration will be grouped together automatically.
              </p>
              <Accordion type="multiple" className="w-full">
                {(() => {
                  const groups = groupDayOverrides(editData.dayOverrides, daysOfWeek);
                  return groups.map((group, groupIndex) => {
                    const groupKey = `edit-group-${groupIndex}`;
                    const groupLabel = formatDayGroupLabel(group.days, daysOfWeek);
                    return (
                      <AccordionItem key={groupKey} value={groupKey}>
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center gap-3 w-full pr-4">
                            <Checkbox
                              checked={group.enabled}
                              onCheckedChange={(checked) => {
                                setEditData((prev) => {
                                  const updated = { ...prev };
                                  group.days.forEach((dayKey) => {
                                    updated.dayOverrides[dayKey] = {
                                      ...updated.dayOverrides[dayKey],
                                      enabled: checked === true,
                                    };
                                  });
                                  return updated;
                                });
                              }}
                              onClick={(e) => e.stopPropagation()}
                              disabled={isPending}
                            />
                            <span
                              className={cn(
                                "font-medium",
                                !group.enabled && "text-muted-foreground"
                              )}
                            >
                              {groupLabel}
                              {!group.enabled && " (Off Day)"}
                            </span>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-4 pt-2 pl-7">
                            <div className="mb-2">
                              <p className="text-xs text-muted-foreground">
                                Applies to:{" "}
                                {group.days
                                  .map(
                                    (dayKey) =>
                                      daysOfWeek.find((d) => d.key === dayKey)
                                        ?.label
                                  )
                                  .join(", ")}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 pb-2 border-b">
                              <Checkbox
                                id={`edit-${groupKey}-override-hours`}
                                checked={group.overrideHours}
                                onCheckedChange={(checked) => {
                                  setEditData((prev) => {
                                    const updated = { ...prev };
                                    group.days.forEach((dayKey) => {
                                      updated.dayOverrides[dayKey] = {
                                        ...updated.dayOverrides[dayKey],
                                        overrideHours: checked === true,
                                        startTime: checked
                                          ? group.startTime
                                          : "",
                                        endTime: checked ? group.endTime : "",
                                      };
                                    });
                                    return updated;
                                  });
                                }}
                                disabled={isPending || !group.enabled}
                              />
                              <Label
                                htmlFor={`edit-${groupKey}-override-hours`}
                                className="text-sm font-normal cursor-pointer"
                              >
                                Override Working Hours
                              </Label>
                            </div>

                            {group.overrideHours && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>
                                    Start Time <span className="text-destructive">*</span>
                                  </Label>
                                  <TimePicker
                                    value={group.startTime}
                                    onChange={(value) => {
                                      setEditData((prev) => {
                                        const updated = { ...prev };
                                        group.days.forEach((dayKey) => {
                                          updated.dayOverrides[dayKey] = {
                                            ...updated.dayOverrides[dayKey],
                                            startTime: value,
                                          };
                                        });
                                        return updated;
                                      });
                                    }}
                                    disabled={isPending || !group.enabled}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>
                                    End Time <span className="text-destructive">*</span>
                                  </Label>
                                  <TimePicker
                                    value={group.endTime}
                                    onChange={(value) => {
                                      setEditData((prev) => {
                                        const updated = { ...prev };
                                        group.days.forEach((dayKey) => {
                                          updated.dayOverrides[dayKey] = {
                                            ...updated.dayOverrides[dayKey],
                                            endTime: value,
                                          };
                                        });
                                        return updated;
                                      });
                                    }}
                                    disabled={isPending || !group.enabled}
                                  />
                                </div>
                              </div>
                            )}

                            <div className="flex items-center gap-2 pt-2 border-t">
                              <Checkbox
                                id={`edit-${groupKey}-override-break`}
                                checked={group.overrideBreak}
                                onCheckedChange={(checked) => {
                                  setEditData((prev) => {
                                    const updated = { ...prev };
                                    group.days.forEach((dayKey) => {
                                      updated.dayOverrides[dayKey] = {
                                        ...updated.dayOverrides[dayKey],
                                        overrideBreak: checked === true,
                                        startBreakTime: checked
                                          ? group.startBreakTime
                                          : "",
                                        endBreakTime: checked
                                          ? group.endBreakTime
                                          : "",
                                      };
                                    });
                                    return updated;
                                  });
                                }}
                                disabled={isPending || !group.enabled}
                              />
                              <Label
                                htmlFor={`edit-${groupKey}-override-break`}
                                className="text-sm font-normal cursor-pointer"
                              >
                                Override Break Times
                              </Label>
                            </div>

                            {group.overrideBreak && (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>Start Break Time</Label>
                                  <TimePicker
                                    value={group.startBreakTime}
                                    onChange={(value) => {
                                      setEditData((prev) => {
                                        const updated = { ...prev };
                                        group.days.forEach((dayKey) => {
                                          updated.dayOverrides[dayKey] = {
                                            ...updated.dayOverrides[dayKey],
                                            startBreakTime: value,
                                          };
                                        });
                                        return updated;
                                      });
                                    }}
                                    disabled={isPending || !group.enabled}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>End Break Time</Label>
                                  <TimePicker
                                    value={group.endBreakTime}
                                    onChange={(value) => {
                                      setEditData((prev) => {
                                        const updated = { ...prev };
                                        group.days.forEach((dayKey) => {
                                          updated.dayOverrides[dayKey] = {
                                            ...updated.dayOverrides[dayKey],
                                            endBreakTime: value,
                                          };
                                        });
                                        return updated;
                                      });
                                    }}
                                    disabled={isPending || !group.enabled}
                                  />
                                </div>
                              </div>
                            )}

                            <div className="space-y-2 pt-2 border-t">
                              <Label>Day Type</Label>
                              <Select
                                value={group.dayType}
                                onValueChange={(value: "full" | "half" | "custom") => {
                                  setEditData((prev) => {
                                    const updated = { ...prev };
                                    group.days.forEach((dayKey) => {
                                      updated.dayOverrides[dayKey] = {
                                        ...updated.dayOverrides[dayKey],
                                        dayType: value,
                                      };
                                    });
                                    return updated;
                                  });
                                }}
                                disabled={isPending || !group.enabled}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="full">Full Day</SelectItem>
                                  <SelectItem value="half">Half Day</SelectItem>
                                  <SelectItem value="custom">Custom Hours</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    );
                  });
                })()}
              </Accordion>
            </div>

            {/* Deductions */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Deductions</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg">
                <div className="space-y-2">
                  <Label>Late Deduction Type</Label>
                  <Select
                    value={editData.lateDeductionType || undefined}
                    onValueChange={(value) =>
                      setEditData({ ...editData, lateDeductionType: value })
                    }
                    disabled={isPending}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Deduction Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Deduct as Percentage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Apply Deduction After (Number of Lates)</Label>
                  <Select
                    value={editData.applyDeductionAfterLates || undefined}
                    onValueChange={(value) =>
                      setEditData({ ...editData, applyDeductionAfterLates: value })
                    }
                    disabled={isPending}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((num) => (
                        <SelectItem key={num} value={num.toString()}>
                          After {num} Late{num > 1 ? "s" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Late Deduction Percent</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Enter percentage"
                    value={editData.lateDeductionPercent}
                    onChange={(e) =>
                      setEditData({ ...editData, lateDeductionPercent: e.target.value })
                    }
                    disabled={isPending || !editData.lateDeductionType}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg">
                <div className="space-y-2">
                  <Label>Half-Day Deduction Type</Label>
                  <Select
                    value={editData.halfDayDeductionType || undefined}
                    onValueChange={(value) =>
                      setEditData({ ...editData, halfDayDeductionType: value })
                    }
                    disabled={isPending}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Deduction Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Deduct as Percentage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Apply Deduction After (Number of Half-Days)</Label>
                  <Select
                    value={editData.applyDeductionAfterHalfDays || undefined}
                    onValueChange={(value) =>
                      setEditData({ ...editData, applyDeductionAfterHalfDays: value })
                    }
                    disabled={isPending}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((num) => (
                        <SelectItem key={num} value={num.toString()}>
                          After {num} Half-Day{num > 1 ? "s" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Deduction Percent</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Enter deduction percent"
                    value={editData.halfDayDeductionAmount}
                    onChange={(e) =>
                      setEditData({ ...editData, halfDayDeductionAmount: e.target.value })
                    }
                    disabled={isPending || !editData.halfDayDeductionType}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg">
                <div className="space-y-2">
                  <Label>Short-Day Deduction Type</Label>
                  <Select
                    value={editData.shortDayDeductionType || undefined}
                    onValueChange={(value) =>
                      setEditData({ ...editData, shortDayDeductionType: value })
                    }
                    disabled={isPending}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Deduction Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Deduct as Percentage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Apply Deduction After (Number of Short-Days)</Label>
                  <Select
                    value={editData.applyDeductionAfterShortDays || undefined}
                    onValueChange={(value) =>
                      setEditData({ ...editData, applyDeductionAfterShortDays: value })
                    }
                    disabled={isPending}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((num) => (
                        <SelectItem key={num} value={num.toString()}>
                          After {num} Short-Day{num > 1 ? "s" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Deduction Percent</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Enter deduction percent"
                    value={editData.shortDayDeductionAmount}
                    onChange={(e) =>
                      setEditData({ ...editData, shortDayDeductionAmount: e.target.value })
                    }
                    disabled={isPending || !editData.shortDayDeductionType}
                  />
                </div>
              </div>
            </div>

            {/* Overtime Rates */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Overtime Rates</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Overtime Rate</Label>
                  <Select
                    value={editData.overtimeRate || undefined}
                    onValueChange={(value) =>
                      setEditData({ ...editData, overtimeRate: value })
                    }
                    disabled={isPending}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select overtime rate" />
                    </SelectTrigger>
                    <SelectContent>
                      {overtimeRateOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Gazzeted Overtime Rate</Label>
                  <Select
                    value={editData.gazzetedOvertimeRate || undefined}
                    onValueChange={(value) =>
                      setEditData({ ...editData, gazzetedOvertimeRate: value })
                    }
                    disabled={isPending}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select gazzeted overtime rate" />
                    </SelectTrigger>
                    <SelectContent>
                      {overtimeRateOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEditDialog(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleEditSubmit} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Working Hours Policy</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{policy.name}&quot;? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* View Dialog */}
      <Dialog open={viewDialog} onOpenChange={setViewDialog}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>View Working Hours Policy</DialogTitle>
            <DialogDescription>
              Complete details of the working hours policy
            </DialogDescription>
          </DialogHeader>
          {loadingView ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : viewPolicy ? (
            <div className="space-y-6 py-4">
              {/* Basic Information */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Basic Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Policy Name</Label>
                    <p className="font-medium">{viewPolicy.name}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Status</Label>
                    <div>
                      <Badge variant={viewPolicy.status === "inactive" ? "secondary" : "default"}>
                        {viewPolicy.status || "active"}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Created By</Label>
                    <p className="font-medium">{viewPolicy.createdBy || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Created At</Label>
                    <p className="font-medium">
                      {new Date(viewPolicy.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Default Working Hours */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Default Working Hours</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Start Time</Label>
                    <p className="font-medium">{formatTimeForDisplay(viewPolicy.startWorkingHours, true)}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">End Time</Label>
                    <p className="font-medium">{formatTimeForDisplay(viewPolicy.endWorkingHours, true)}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Start Break Time</Label>
                    <p className="font-medium">{formatTimeForDisplay(viewPolicy.startBreakTime || "", true)}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">End Break Time</Label>
                    <p className="font-medium">{formatTimeForDisplay(viewPolicy.endBreakTime || "", true)}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Short Day Minutes</Label>
                    <p className="font-medium">{viewPolicy.shortDayMins || "N/A"}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Half Day Start Time</Label>
                    <p className="font-medium">{formatTimeForDisplay(viewPolicy.halfDayStartTime || "", true)}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Late Start Time</Label>
                    <p className="font-medium">{formatTimeForDisplay(viewPolicy.lateStartTime || "", true)}</p>
                  </div>
                </div>
              </div>

              {/* Day-wise Overrides */}
              <Separator />
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Day-wise Overrides</h3>
                {viewPolicy.dayOverrides ? (
                  <div className="space-y-3">
                    {(() => {
                      // Convert to grouped format if needed
                      const individualFormat = convertGroupedToIndividual(viewPolicy.dayOverrides);
                      const groups = groupDayOverrides(individualFormat, daysOfWeek);
                      
                      return groups.map((group, index) => {
                        const groupLabel = formatDayGroupLabel(group.days, daysOfWeek);
                        const effectiveStartTime = group.overrideHours
                          ? group.startTime
                          : viewPolicy.startWorkingHours;
                        const effectiveEndTime = group.overrideHours
                          ? group.endTime
                          : viewPolicy.endWorkingHours;
                        const effectiveStartBreak = group.overrideBreak
                          ? group.startBreakTime
                          : viewPolicy.startBreakTime;
                        const effectiveEndBreak = group.overrideBreak
                          ? group.endBreakTime
                          : viewPolicy.endBreakTime;

                        return (
                          <div
                            key={`group-${index}`}
                            className={cn(
                              "p-4 border rounded-lg",
                              !group.enabled && "opacity-50"
                            )}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div>
                                <h4 className="font-medium">
                                  {groupLabel}
                                  {!group.enabled && " (Off Day)"}
                                </h4>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Applies to: {group.days.map(dayKey => daysOfWeek.find(d => d.key === dayKey)?.label).join(", ")}
                                </p>
                              </div>
                              <div className="flex gap-2">
                                {!group.enabled && (
                                  <Badge variant="secondary">Off Day</Badge>
                                )}
                                {group.enabled && group.overrideHours && (
                                  <Badge variant="outline">Custom Hours</Badge>
                                )}
                                {group.enabled && group.overrideBreak && (
                                  <Badge variant="outline">Custom Break</Badge>
                                )}
                                {group.enabled && (
                                  <Badge variant="outline">
                                    {group.dayType === "full"
                                      ? "Full Day"
                                      : group.dayType === "half"
                                      ? "Half Day"
                                      : "Custom"}
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {group.enabled && (
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                <div>
                                  <Label className="text-xs text-muted-foreground">Working Hours</Label>
                                  <p className="font-medium">
                                    {formatTimeForDisplay(effectiveStartTime, true)} - {formatTimeForDisplay(effectiveEndTime, true)}
                                  </p>
                                </div>
                                {(effectiveStartBreak || effectiveEndBreak) && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Break Time</Label>
                                    <p className="font-medium">
                                      {formatTimeForDisplay(effectiveStartBreak || "", true)} - {formatTimeForDisplay(effectiveEndBreak || "", true)}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      No day-wise overrides configured. All days use default working hours.
                    </p>
                    <div className="mt-4 space-y-2">
                      <p className="text-sm font-medium">Default Schedule:</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <Label className="text-xs text-muted-foreground">Working Hours</Label>
                          <p className="font-medium">
                            {formatTimeForDisplay(viewPolicy.startWorkingHours, true)} - {formatTimeForDisplay(viewPolicy.endWorkingHours, true)}
                          </p>
                        </div>
                        {(viewPolicy.startBreakTime || viewPolicy.endBreakTime) && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Break Time</Label>
                            <p className="font-medium">
                              {formatTimeForDisplay(viewPolicy.startBreakTime || "", true)} - {formatTimeForDisplay(viewPolicy.endBreakTime || "", true)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <Separator />

              {/* Deductions */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Deductions</h3>
                {viewPolicy.lateDeductionType && (
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-3">Late Deduction</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <Label className="text-xs text-muted-foreground">Type</Label>
                        <p className="font-medium capitalize">{viewPolicy.lateDeductionType}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Apply After</Label>
                        <p className="font-medium">
                          {viewPolicy.applyDeductionAfterLates} Late{viewPolicy.applyDeductionAfterLates !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Percentage</Label>
                        <p className="font-medium">{viewPolicy.lateDeductionPercent}%</p>
                      </div>
                    </div>
                  </div>
                )}
                {viewPolicy.halfDayDeductionType && (
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-3">Half-Day Deduction</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <Label className="text-xs text-muted-foreground">Type</Label>
                        <p className="font-medium capitalize">{viewPolicy.halfDayDeductionType}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Apply After</Label>
                        <p className="font-medium">
                          {viewPolicy.applyDeductionAfterHalfDays} Half-Day{viewPolicy.applyDeductionAfterHalfDays !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Amount</Label>
                        <p className="font-medium">{viewPolicy.halfDayDeductionAmount}%</p>
                      </div>
                    </div>
                  </div>
                )}
                {viewPolicy.shortDayDeductionType && (
                  <div className="p-4 border rounded-lg">
                    <h4 className="font-medium mb-3">Short-Day Deduction</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <Label className="text-xs text-muted-foreground">Type</Label>
                        <p className="font-medium capitalize">{viewPolicy.shortDayDeductionType}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Apply After</Label>
                        <p className="font-medium">
                          {viewPolicy.applyDeductionAfterShortDays} Short-Day{viewPolicy.applyDeductionAfterShortDays !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Amount</Label>
                        <p className="font-medium">{viewPolicy.shortDayDeductionAmount}%</p>
                      </div>
                    </div>
                  </div>
                )}
                {!viewPolicy.lateDeductionType &&
                  !viewPolicy.halfDayDeductionType &&
                  !viewPolicy.shortDayDeductionType && (
                    <p className="text-sm text-muted-foreground">No deductions configured</p>
                  )}
              </div>

              <Separator />

              {/* Overtime Rates */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Overtime Rates</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Overtime Rate</Label>
                    <p className="font-medium">
                      {viewPolicy.overtimeRate ? `x${viewPolicy.overtimeRate}` : "None"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Gazzeted Overtime Rate</Label>
                    <p className="font-medium">
                      {viewPolicy.gazzetedOvertimeRate ? `x${viewPolicy.gazzetedOvertimeRate}` : "None"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

