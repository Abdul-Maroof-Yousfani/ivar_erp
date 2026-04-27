"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, useEffect, startTransition, addTransitionType } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { toast } from "sonner";
import { ArrowLeft, Clock, Loader2, ChevronDown } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { createWorkingHoursPolicy } from "@/lib/actions/working-hours-policy";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export default function CreateWorkingHoursPolicyPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Working Hours Details
  const [policyName, setPolicyName] = useState("");
  const [startWorkingHours, setStartWorkingHours] = useState("");
  const [endWorkingHours, setEndWorkingHours] = useState("");
  const [shortDayUnit, setShortDayUnit] = useState<"hours" | "mins">("mins");
  const [shortDayValue, setShortDayValue] = useState("");
  const [startBreakTime, setStartBreakTime] = useState("");
  const [endBreakTime, setEndBreakTime] = useState("");
  const [halfDayStartTime, setHalfDayStartTime] = useState("");
  const [lateStartTime, setLateStartTime] = useState("");

  // Deductions For Late
  const [lateDeductionType, setLateDeductionType] = useState("");
  const [applyDeductionAfterLates, setApplyDeductionAfterLates] = useState("");
  const [lateDeductionPercent, setLateDeductionPercent] = useState("");

  // Deductions For Half-Day
  const [halfDayDeductionType, setHalfDayDeductionType] = useState("");
  const [applyDeductionAfterHalfDays, setApplyDeductionAfterHalfDays] =
    useState("");
  const [halfDayDeductionAmount, setHalfDayDeductionAmount] = useState("");

  // Deductions For Short-Day
  const [shortDayDeductionType, setShortDayDeductionType] = useState("");
  const [applyDeductionAfterShortDays, setApplyDeductionAfterShortDays] =
    useState("");
  const [shortDayDeductionAmount, setShortDayDeductionAmount] = useState("");

  // Overtime Rates
  const [overtimeRate, setOvertimeRate] = useState("");
  const [gazzetedOvertimeRate, setGazzetedOvertimeRate] = useState("");

  // Day-wise Overrides
  const [dayOverrides, setDayOverrides] = useState<{
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
  }>({
    monday: {
      enabled: true,
      overrideHours: false,
      startTime: "",
      endTime: "",
      overrideBreak: false,
      startBreakTime: "",
      endBreakTime: "",
      dayType: "full",
    },
    tuesday: {
      enabled: true,
      overrideHours: false,
      startTime: "",
      endTime: "",
      overrideBreak: false,
      startBreakTime: "",
      endBreakTime: "",
      dayType: "full",
    },
    wednesday: {
      enabled: true,
      overrideHours: false,
      startTime: "",
      endTime: "",
      overrideBreak: false,
      startBreakTime: "",
      endBreakTime: "",
      dayType: "full",
    },
    thursday: {
      enabled: true,
      overrideHours: false,
      startTime: "",
      endTime: "",
      overrideBreak: false,
      startBreakTime: "",
      endBreakTime: "",
      dayType: "full",
    },
    friday: {
      enabled: true,
      overrideHours: false,
      startTime: "",
      endTime: "",
      overrideBreak: false,
      startBreakTime: "",
      endBreakTime: "",
      dayType: "full",
    },
    saturday: {
      enabled: false,
      overrideHours: false,
      startTime: "",
      endTime: "",
      overrideBreak: false,
      startBreakTime: "",
      endBreakTime: "",
      dayType: "full",
    },
    sunday: {
      enabled: false,
      overrideHours: false,
      startTime: "",
      endTime: "",
      overrideBreak: false,
      startBreakTime: "",
      endBreakTime: "",
      dayType: "full",
    },
  });

  const daysOfWeek = [
    { key: "monday", label: "Monday" },
    { key: "tuesday", label: "Tuesday" },
    { key: "wednesday", label: "Wednesday" },
    { key: "thursday", label: "Thursday" },
    { key: "friday", label: "Friday" },
    { key: "saturday", label: "Saturday" },
    { key: "sunday", label: "Sunday" },
  ];

  const overtimeRateOptions = [
    { value: "0", label: "None" },
    { value: "0.5", label: "x0.5" },
    { value: "1", label: "x1" },
    { value: "1.5", label: "x1.5" },
    { value: "2", label: "x2" },
    { value: "2.5", label: "x2.5" },
    { value: "3", label: "x3" },
  ];

  const calculateShortDayMins = (): number => {
    if (!shortDayValue) return 0;
    const value = parseFloat(shortDayValue);
    if (isNaN(value)) return 0;
    return shortDayUnit === "hours" ? value * 60 : value;
  };

  // Helper function to create a config key for grouping
  const getDayConfigKey = (dayData: {
    enabled: boolean;
    overrideHours: boolean;
    startTime: string;
    endTime: string;
    overrideBreak: boolean;
    startBreakTime: string;
    endBreakTime: string;
    dayType: "full" | "half" | "custom";
  }): string => {
    return JSON.stringify({
      enabled: dayData.enabled,
      overrideHours: dayData.overrideHours,
      startTime: dayData.startTime,
      endTime: dayData.endTime,
      overrideBreak: dayData.overrideBreak,
      startBreakTime: dayData.startBreakTime,
      endBreakTime: dayData.endBreakTime,
      dayType: dayData.dayType,
    });
  };

  // Group days with the same configuration
  const groupDayOverrides = () => {
    const groups: {
      days: string[];
      enabled: boolean;
      overrideHours: boolean;
      startTime: string;
      endTime: string;
      overrideBreak: boolean;
      startBreakTime: string;
      endBreakTime: string;
      dayType: "full" | "half" | "custom";
    }[] = [];

    const configMap = new Map<string, string[]>();

    // Group days by their configuration
    daysOfWeek.forEach((day) => {
      const dayData = dayOverrides[day.key];
      const configKey = getDayConfigKey(dayData);

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

  // Format day group label (e.g., "Mon-Thu" or "Friday")
  const formatDayGroupLabel = (days: string[]): string => {
    if (days.length === 1) {
      return daysOfWeek.find((d) => d.key === days[0])?.label || days[0];
    }

    const dayIndices = days
      .map((day) => daysOfWeek.findIndex((d) => d.key === day))
      .sort((a, b) => a - b);

    // Check if days are consecutive
    const isConsecutive = dayIndices.every(
      (idx, i) => i === 0 || idx === dayIndices[i - 1] + 1
    );

    if (isConsecutive && dayIndices.length > 1) {
      const firstDay = daysOfWeek[dayIndices[0]].label;
      const lastDay = daysOfWeek[dayIndices[dayIndices.length - 1]].label;
      return `${firstDay.substring(0, 3)}-${lastDay.substring(0, 3)}`;
    }

    // Non-consecutive days
    return days
      .map((day) =>
        daysOfWeek.find((d) => d.key === day)?.label.substring(0, 3)
      )
      .join(", ");
  };

  // Time picker helper functions
  const formatTimeForDisplay = (time: string): string => {
    if (!time) return "--:--";
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!policyName.trim()) {
      toast.error("Working Hours Policy Name is required");
      return;
    }

    // Validate default working hours
    if (!startWorkingHours) {
      toast.error("Start Working Hours Time is required");
      return;
    }

    if (!endWorkingHours) {
      toast.error("End Working Hours Time is required");
      return;
    }

    // Validate day overrides
    const enabledDays = Object.entries(dayOverrides).filter(
      ([_, day]) => day.enabled
    );

    if (enabledDays.length === 0) {
      toast.error("At least one day must be enabled");
      return;
    }

    // Validate days that override hours
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

    const shortDayMins = calculateShortDayMins();

    const formData = {
      name: policyName.trim(),
      startWorkingHours,
      endWorkingHours,
      shortDayMins,
      startBreakTime: startBreakTime || null,
      endBreakTime: endBreakTime || null,
      halfDayStartTime: halfDayStartTime || null,
      lateStartTime: lateStartTime || null,
      lateDeductionType: lateDeductionType || null,
      applyDeductionAfterLates: applyDeductionAfterLates
        ? parseInt(applyDeductionAfterLates)
        : null,
      lateDeductionPercent: lateDeductionPercent
        ? parseFloat(lateDeductionPercent)
        : null,
      halfDayDeductionType: halfDayDeductionType || null,
      applyDeductionAfterHalfDays: applyDeductionAfterHalfDays
        ? parseInt(applyDeductionAfterHalfDays)
        : null,
      halfDayDeductionAmount: halfDayDeductionAmount
        ? parseFloat(halfDayDeductionAmount)
        : null,
      shortDayDeductionType: shortDayDeductionType || null,
      applyDeductionAfterShortDays: applyDeductionAfterShortDays
        ? parseInt(applyDeductionAfterShortDays)
        : null,
      shortDayDeductionAmount: shortDayDeductionAmount
        ? parseFloat(shortDayDeductionAmount)
        : null,
      overtimeRate:
        overtimeRate && overtimeRate !== "0" ? parseFloat(overtimeRate) : null,
      gazzetedOvertimeRate:
        gazzetedOvertimeRate && gazzetedOvertimeRate !== "0"
          ? parseFloat(gazzetedOvertimeRate)
          : null,
      dayOverrides: groupDayOverrides(),
    };

    startTransition(async () => {
      const result = await createWorkingHoursPolicy(formData);
      if (result.status) {
        toast.success(
          result.message || "Working Hours Policy created successfully"
        );
        startTransition(() => {
          addTransitionType("nav-back");
          router.push("/hr/working-hours/view");
        });
      } else {
        toast.error(result.message || "Failed to create working hours policy");
      }
    });
  };

  const handleClear = () => {
    setPolicyName("");
    setStartWorkingHours("");
    setEndWorkingHours("");
    setShortDayUnit("mins");
    setShortDayValue("");
    setStartBreakTime("");
    setEndBreakTime("");
    setHalfDayStartTime("");
    setLateStartTime("");
    setLateDeductionType("");
    setApplyDeductionAfterLates("");
    setLateDeductionPercent("");
    setHalfDayDeductionType("");
    setApplyDeductionAfterHalfDays("");
    setHalfDayDeductionAmount("");
    setShortDayDeductionType("");
    setApplyDeductionAfterShortDays("");
    setShortDayDeductionAmount("");
    setOvertimeRate("");
    setGazzetedOvertimeRate("");
    setDayOverrides({
      monday: {
        enabled: true,
        overrideHours: false,
        startTime: "",
        endTime: "",
        overrideBreak: false,
        startBreakTime: "",
        endBreakTime: "",
        dayType: "full",
      },
      tuesday: {
        enabled: true,
        overrideHours: false,
        startTime: "",
        endTime: "",
        overrideBreak: false,
        startBreakTime: "",
        endBreakTime: "",
        dayType: "full",
      },
      wednesday: {
        enabled: true,
        overrideHours: false,
        startTime: "",
        endTime: "",
        overrideBreak: false,
        startBreakTime: "",
        endBreakTime: "",
        dayType: "full",
      },
      thursday: {
        enabled: true,
        overrideHours: false,
        startTime: "",
        endTime: "",
        overrideBreak: false,
        startBreakTime: "",
        endBreakTime: "",
        dayType: "full",
      },
      friday: {
        enabled: true,
        overrideHours: false,
        startTime: "",
        endTime: "",
        overrideBreak: false,
        startBreakTime: "",
        endBreakTime: "",
        dayType: "full",
      },
      saturday: {
        enabled: false,
        overrideHours: false,
        startTime: "",
        endTime: "",
        overrideBreak: false,
        startBreakTime: "",
        endBreakTime: "",
        dayType: "full",
      },
      sunday: {
        enabled: false,
        overrideHours: false,
        startTime: "",
        endTime: "",
        overrideBreak: false,
        startBreakTime: "",
        endBreakTime: "",
        dayType: "full",
      },
    });
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <Link href="/hr/working-hours/view" transitionTypes={["nav-back"]}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to List
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Create Working Hours Policy Form</CardTitle>
          <CardDescription>
            Define working hours, deductions, and overtime rates for your
            organization
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Working Hours Details Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Default Working Hours</h3>
              <p className="text-sm text-muted-foreground">
                Set default working hours that will apply to all days. You can
                override specific days in the "Day-wise Overrides" section
                below.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>
                    Working Hours Policy Name{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="Enter policy name"
                    value={policyName}
                    onChange={(e) => setPolicyName(e.target.value)}
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
                    value={startWorkingHours}
                    onChange={setStartWorkingHours}
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    Default End Working Hours{" "}
                    <span className="text-destructive">*</span>
                  </Label>
                  <TimePicker
                    value={endWorkingHours}
                    onChange={setEndWorkingHours}
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Default Start Break Time</Label>
                  <TimePicker
                    value={startBreakTime}
                    onChange={setStartBreakTime}
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Default End Break Time</Label>
                  <TimePicker
                    value={endBreakTime}
                    onChange={setEndBreakTime}
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Short Day Mins</Label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="eg: 270"
                      value={shortDayValue}
                      onChange={(e) => setShortDayValue(e.target.value)}
                      disabled={isPending}
                      className="flex-1"
                    />
                    <Select
                      value={shortDayUnit}
                      onValueChange={(value: "hours" | "mins") =>
                        setShortDayUnit(value)
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
                  {shortDayValue && (
                    <p className="text-xs text-muted-foreground">
                      Will be saved as: {calculateShortDayMins()} minutes
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Half Day Start Time</Label>
                  <TimePicker
                    value={halfDayStartTime}
                    onChange={setHalfDayStartTime}
                    disabled={isPending}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Late Start Time</Label>
                  <TimePicker
                    value={lateStartTime}
                    onChange={setLateStartTime}
                    disabled={isPending}
                  />
                </div>
              </div>
            </div>

            {/* Day-wise Overrides Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Day-wise Overrides</h3>
              <p className="text-sm text-muted-foreground">
                Override default settings for specific days. Enable/disable
                days, override hours or break times individually. Days with the
                same configuration will be automatically grouped together when
                saved.
              </p>

              {/* Preview of grouped configuration */}
              <div className="p-4 border rounded-lg bg-muted/50">
                <h4 className="text-sm font-semibold mb-2">
                  Preview: How days will be grouped
                </h4>
                <div className="space-y-2 text-xs">
                  {(() => {
                    const groups = groupDayOverrides();
                    if (groups.length === 0)
                      return (
                        <p className="text-muted-foreground">
                          No days configured
                        </p>
                      );
                    return groups.map((group, idx) => {
                      const groupLabel = formatDayGroupLabel(group.days);
                      return (
                        <div key={idx} className="flex items-center gap-2">
                          <Badge
                            variant={group.enabled ? "default" : "secondary"}
                            className="text-xs"
                          >
                            {groupLabel}
                            {!group.enabled && " (Off Day)"}
                          </Badge>
                          {group.enabled && (
                            <span className="text-muted-foreground">
                              {group.overrideHours
                                ? `${formatTimeForDisplay(
                                    group.startTime
                                  )} - ${formatTimeForDisplay(group.endTime)}`
                                : "Default hours"}
                              {group.overrideBreak && " [Custom Break]"}
                            </span>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              <Accordion type="multiple" className="w-full">
                {daysOfWeek.map((day) => {
                  const dayData = dayOverrides[day.key];
                  const effectiveStartTime = dayData.overrideHours
                    ? dayData.startTime
                    : startWorkingHours;
                  const effectiveEndTime = dayData.overrideHours
                    ? dayData.endTime
                    : endWorkingHours;
                  const effectiveStartBreak = dayData.overrideBreak
                    ? dayData.startBreakTime
                    : startBreakTime;
                  const effectiveEndBreak = dayData.overrideBreak
                    ? dayData.endBreakTime
                    : endBreakTime;

                  return (
                    <AccordionItem key={day.key} value={day.key}>
                      <AccordionTrigger className="hover:no-underline">
                        <div className="flex items-center gap-3 w-full pr-4">
                          <Checkbox
                            checked={dayData.enabled}
                            onCheckedChange={(checked) => {
                              setDayOverrides((prev) => ({
                                ...prev,
                                [day.key]: {
                                  ...prev[day.key],
                                  enabled: checked === true,
                                },
                              }));
                            }}
                            onClick={(e) => e.stopPropagation()}
                            disabled={isPending}
                          />
                          <span
                            className={cn(
                              "font-medium",
                              !dayData.enabled && "text-muted-foreground"
                            )}
                          >
                            {day.label}
                          </span>
                          {dayData.enabled && (
                            <span className="text-xs text-muted-foreground ml-auto">
                              {effectiveStartTime && effectiveEndTime
                                ? `${formatTimeForDisplay(
                                    effectiveStartTime
                                  )} - ${formatTimeForDisplay(
                                    effectiveEndTime
                                  )}`
                                : "Using default"}
                              {dayData.overrideHours && " (Custom)"}
                              {dayData.overrideBreak && " [Break Override]"}
                            </span>
                          )}
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 pt-2 pl-7">
                          <div className="flex items-center gap-2 pb-2 border-b">
                            <Checkbox
                              id={`${day.key}-override-hours`}
                              checked={dayData.overrideHours}
                              onCheckedChange={(checked) => {
                                setDayOverrides((prev) => ({
                                  ...prev,
                                  [day.key]: {
                                    ...prev[day.key],
                                    overrideHours: checked === true,
                                    startTime: checked
                                      ? prev[day.key].startTime
                                      : "",
                                    endTime: checked
                                      ? prev[day.key].endTime
                                      : "",
                                  },
                                }));
                              }}
                              disabled={isPending || !dayData.enabled}
                            />
                            <Label
                              htmlFor={`${day.key}-override-hours`}
                              className="text-sm font-normal cursor-pointer"
                            >
                              Override Working Hours (Use custom times instead
                              of default)
                            </Label>
                          </div>

                          {dayData.overrideHours && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>
                                  Start Time{" "}
                                  <span className="text-destructive">*</span>
                                </Label>
                                <TimePicker
                                  value={dayData.startTime}
                                  onChange={(value) => {
                                    setDayOverrides((prev) => ({
                                      ...prev,
                                      [day.key]: {
                                        ...prev[day.key],
                                        startTime: value,
                                      },
                                    }));
                                  }}
                                  disabled={isPending || !dayData.enabled}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>
                                  End Time{" "}
                                  <span className="text-destructive">*</span>
                                </Label>
                                <TimePicker
                                  value={dayData.endTime}
                                  onChange={(value) => {
                                    setDayOverrides((prev) => ({
                                      ...prev,
                                      [day.key]: {
                                        ...prev[day.key],
                                        endTime: value,
                                      },
                                    }));
                                  }}
                                  disabled={isPending || !dayData.enabled}
                                />
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-2 pt-2 border-t">
                            <Checkbox
                              id={`${day.key}-override-break`}
                              checked={dayData.overrideBreak}
                              onCheckedChange={(checked) => {
                                setDayOverrides((prev) => ({
                                  ...prev,
                                  [day.key]: {
                                    ...prev[day.key],
                                    overrideBreak: checked === true,
                                    startBreakTime: checked
                                      ? prev[day.key].startBreakTime
                                      : "",
                                    endBreakTime: checked
                                      ? prev[day.key].endBreakTime
                                      : "",
                                  },
                                }));
                              }}
                              disabled={isPending || !dayData.enabled}
                            />
                            <Label
                              htmlFor={`${day.key}-override-break`}
                              className="text-sm font-normal cursor-pointer"
                            >
                              Override Break Times (Use custom break times
                              instead of default)
                            </Label>
                          </div>

                          {dayData.overrideBreak && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Start Break Time</Label>
                                <TimePicker
                                  value={dayData.startBreakTime}
                                  onChange={(value) => {
                                    setDayOverrides((prev) => ({
                                      ...prev,
                                      [day.key]: {
                                        ...prev[day.key],
                                        startBreakTime: value,
                                      },
                                    }));
                                  }}
                                  disabled={isPending || !dayData.enabled}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>End Break Time</Label>
                                <TimePicker
                                  value={dayData.endBreakTime}
                                  onChange={(value) => {
                                    setDayOverrides((prev) => ({
                                      ...prev,
                                      [day.key]: {
                                        ...prev[day.key],
                                        endBreakTime: value,
                                      },
                                    }));
                                  }}
                                  disabled={isPending || !dayData.enabled}
                                />
                              </div>
                            </div>
                          )}

                          <div className="space-y-2 pt-2 border-t">
                            <Label>Day Type</Label>
                            <Select
                              value={dayData.dayType}
                              onValueChange={(
                                value: "full" | "half" | "custom"
                              ) => {
                                setDayOverrides((prev) => ({
                                  ...prev,
                                  [day.key]: {
                                    ...prev[day.key],
                                    dayType: value,
                                  },
                                }));
                              }}
                              disabled={isPending || !dayData.enabled}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="full">Full Day</SelectItem>
                                <SelectItem value="half">Half Day</SelectItem>
                                <SelectItem value="custom">
                                  Custom Hours
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </div>

            {/* Deductions For Late/Half/Short-Day Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">
                Deductions For Late/Half/Short-Day
              </h3>

              {/* Late Deduction */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg">
                <div className="space-y-2">
                  <Label>Late Deduction Type</Label>
                  <Select
                    value={lateDeductionType || undefined}
                    onValueChange={(value) => {
                      if (value === "__none__") {
                        setLateDeductionType("");
                        setLateDeductionPercent("");
                        setApplyDeductionAfterLates("");
                      } else {
                        setLateDeductionType(value);
                      }
                    }}
                    disabled={isPending}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Deduction Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        Select Deduction Type
                      </SelectItem>
                      <SelectItem value="percentage">
                        Deduct as Percentage
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Apply Deduction After (Number of Lates)</Label>
                  <Select
                    value={applyDeductionAfterLates}
                    onValueChange={setApplyDeductionAfterLates}
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
                    value={lateDeductionPercent}
                    onChange={(e) => setLateDeductionPercent(e.target.value)}
                    disabled={isPending || !lateDeductionType}
                  />
                </div>
              </div>

              {/* Half-Day Deduction */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg">
                <div className="space-y-2">
                  <Label>Half-Day Deduction Type</Label>
                  <Select
                    value={halfDayDeductionType || undefined}
                    onValueChange={(value) => {
                      if (value === "__none__") {
                        setHalfDayDeductionType("");
                        setHalfDayDeductionAmount("");
                        setApplyDeductionAfterHalfDays("");
                      } else {
                        setHalfDayDeductionType(value);
                      }
                    }}
                    disabled={isPending}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Deduction Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        Select Deduction Type
                      </SelectItem>
                      <SelectItem value="percentage">
                        Deduct as Percentage
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Apply Deduction After (Number of Half-Days)</Label>
                  <Select
                    value={applyDeductionAfterHalfDays}
                    onValueChange={setApplyDeductionAfterHalfDays}
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
                    value={halfDayDeductionAmount}
                    onChange={(e) => setHalfDayDeductionAmount(e.target.value)}
                    disabled={isPending || !halfDayDeductionType}
                  />
                </div>
              </div>

              {/* Short-Day Deduction */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg">
                <div className="space-y-2">
                  <Label>Short-Day Deduction Type</Label>
                  <Select
                    value={shortDayDeductionType || undefined}
                    onValueChange={(value) => {
                      if (value === "__none__") {
                        setShortDayDeductionType("");
                        setShortDayDeductionAmount("");
                        setApplyDeductionAfterShortDays("");
                      } else {
                        setShortDayDeductionType(value);
                      }
                    }}
                    disabled={isPending}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Deduction Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        Select Deduction Type
                      </SelectItem>
                      <SelectItem value="percentage">
                        Deduct as Percentage
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Apply Deduction After (Number of Short-Days)</Label>
                  <Select
                    value={applyDeductionAfterShortDays}
                    onValueChange={setApplyDeductionAfterShortDays}
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
                    value={shortDayDeductionAmount}
                    onChange={(e) => setShortDayDeductionAmount(e.target.value)}
                    disabled={isPending || !shortDayDeductionType}
                  />
                </div>
              </div>
            </div>

            {/* Overtime Rates Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Overtime Rates</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Overtime Rate</Label>
                  <Select
                    value={overtimeRate}
                    onValueChange={setOvertimeRate}
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
                    value={gazzetedOvertimeRate}
                    onValueChange={setGazzetedOvertimeRate}
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

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClear}
                disabled={isPending}
              >
                Clear Form
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Submit
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
