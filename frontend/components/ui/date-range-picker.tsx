"use client";

import React, { type FC, useState, useEffect, useRef, JSX } from "react";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Calendar as CalendarIcon, ChevronDownIcon, ChevronUpIcon, Check, X } from "lucide-react";
import { Calendar } from "../ui/calendar";
import { format, startOfDay, endOfDay, isSameDay } from "date-fns";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

export interface DateRangePickerProps {
  /** Click handler for applying the updates from DateRangePicker. */
  onUpdate?: (values: { range: DateRange; rangeCompare?: DateRange }) => void;
  /** Initial value for start date */
  initialDateFrom?: Date | string;
  /** Initial value for end date */
  initialDateTo?: Date | string;
  /** Initial value for start date for compare */
  initialCompareFrom?: Date | string;
  /** Initial value for end date for compare */
  initialCompareTo?: Date | string;
  /** Alignment of popover */
  align?: "start" | "center" | "end";
  /** Option for locale */
  locale?: string;
  /** Option for showing compare feature */
  showCompare?: boolean;
  dateRange?: {
    oldestDate: Date | null;
    latestDate: Date | null;
  };
  range?: DateRange | undefined;
  isPreset?: boolean;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  /** Array of date ranges to disable (e.g., already assigned dates) */
  disabledDateRanges?: Array<{ from: Date; to: Date }>;
}

const formatDate = (date: Date, locale: string = "en-us"): string => {
  return date.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const getDateAdjustedForTimezone = (dateInput: Date | string): Date => {
  if (typeof dateInput === "string") {
    const parts = dateInput.split("-").map((part) => parseInt(part, 10));
    const date = new Date(parts[0], parts[1] - 1, parts[2]);
    return date;
  } else {
    return dateInput;
  }
};

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

interface Preset {
  name: string;
  label: string;
}

// Define presets
const PRESETS: Preset[] = [
  { name: "thisMonth", label: "This Month" },
  { name: "lastMonth", label: "Last Month" },
  { name: "thisWeek", label: "This Week" },
  { name: "last3", label: "Last 3 days" },
  { name: "last15", label: "Last 15 days" },
];

/** The DateRangePicker component allows a user to select a range of dates */
export const DateRangePicker: FC<DateRangePickerProps> & {
  filePath: string;
} = ({
  initialDateFrom,
  initialDateTo,
  initialCompareFrom,
  initialCompareTo,
  onUpdate,
  locale = "en-US",
  showCompare = false,
  dateRange,
  range: passedRange,
  align = "start",
  isPreset = true,
  className,
  disabled,
  placeholder = "Select date range",
  disabledDateRanges = [],
}): JSX.Element => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const isSelectingRef = useRef(false);

  // Temporary range for selection (not confirmed yet)
  const [tempRange, setTempRange] = useState<DateRange>({ from: undefined, to: undefined });
  // Controlled month for calendar navigation
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  // Confirmed range
  const [range, setRange] = useState<DateRange>(() => {
    if (passedRange) {
      return {
        from: passedRange.from ? startOfDay(passedRange.from) : undefined,
        to: passedRange.to ? endOfDay(passedRange.to) : undefined,
      };
    }
    return {
      from: initialDateFrom ? startOfDay(getDateAdjustedForTimezone(initialDateFrom)) : undefined,
      to: initialDateTo ? endOfDay(getDateAdjustedForTimezone(initialDateTo)) : undefined,
    };
  });

  const [rangeCompare, setRangeCompare] = useState<DateRange | undefined>(
    initialCompareFrom
      ? {
          from: startOfDay(getDateAdjustedForTimezone(initialCompareFrom)),
          to: initialCompareTo
            ? endOfDay(getDateAdjustedForTimezone(initialCompareTo))
            : undefined,
        }
      : undefined
  );

  const [selectedPreset, setSelectedPreset] = useState<string | undefined>(undefined);
  const [isSmallScreen, setIsSmallScreen] = useState(
    typeof window !== "undefined" ? window.innerWidth < 960 : false
  );

  // Generate years for dropdown (from oldestDate to latestDate or current year)
  const getAvailableYears = (): number[] => {
    const currentYear = new Date().getFullYear();
    let startYear: number;
    let endYear: number;
    
    if (dateRange?.oldestDate && dateRange?.latestDate) {
      startYear = new Date(dateRange.oldestDate).getFullYear();
      endYear = new Date(dateRange.latestDate).getFullYear();
    } else {
      // Default: show 10 years back and 2 years forward
      startYear = currentYear - 10;
      endYear = currentYear + 2;
    }
    
    const years: number[] = [];
    for (let year = startYear; year <= endYear; year++) {
      years.push(year);
    }
    return years.reverse(); // Most recent first
  };

  const availableYears = getAvailableYears();

  useEffect(() => {
    if (passedRange) {
      setRange({
        from: passedRange.from ? startOfDay(passedRange.from) : undefined,
        to: passedRange.to ? endOfDay(passedRange.to) : undefined,
      });
    }
  }, [passedRange]);

  useEffect(() => {
    const handleResize = (): void => {
      setIsSmallScreen(window.innerWidth < 960);
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const getPresetRange = (presetName: string, selectedYear?: number): { from: Date; to: Date } => {
    const preset = PRESETS.find(({ name }) => name === presetName);
    if (!preset) throw new Error(`Unknown date range preset: ${presetName}`);
    
    const today = new Date();
    const from = new Date();
    const to = new Date();
    
    switch (preset.name) {
      case "thisMonth":
        // Current month of selected year (or current year)
        const thisMonthYear = selectedYear ?? today.getFullYear();
        const thisMonthMonth = selectedYear === today.getFullYear() ? today.getMonth() : today.getMonth();
        from.setFullYear(thisMonthYear, thisMonthMonth, 1);
        from.setHours(0, 0, 0, 0);
        to.setFullYear(thisMonthYear, thisMonthMonth + 1, 0);
        to.setHours(23, 59, 59, 999);
        break;
      case "lastMonth":
        // Previous month of selected year (or current year)
        const lastMonthYear = selectedYear ?? today.getFullYear();
        const lastMonthMonth = selectedYear === today.getFullYear() ? today.getMonth() - 1 : today.getMonth() - 1;
        from.setFullYear(lastMonthYear, lastMonthMonth, 1);
        from.setHours(0, 0, 0, 0);
        to.setFullYear(lastMonthYear, lastMonthMonth + 1, 0);
        to.setHours(23, 59, 59, 999);
        break;
      case "thisWeek":
        // Current week (always relative to today, not year-specific)
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() - today.getDay());
        weekStart.setHours(0, 0, 0, 0);
        from.setTime(weekStart.getTime());
        const weekEnd = new Date(today);
        weekEnd.setDate(today.getDate() - today.getDay() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        to.setTime(weekEnd.getTime());
        break;
      case "last3":
        // Last 3 days from today (always relative to today)
        from.setDate(today.getDate() - 2);
        from.setHours(0, 0, 0, 0);
        to.setTime(today.getTime());
        to.setHours(23, 59, 59, 999);
        break;
      case "last15":
        // Last 15 days from today (always relative to today)
        from.setDate(today.getDate() - 14);
        from.setHours(0, 0, 0, 0);
        to.setTime(today.getTime());
        to.setHours(23, 59, 59, 999);
        break;
    }

    return { from, to };
  };

  const setPreset = (preset: string): void => {
    const presetRange = getPresetRange(preset, currentYear);
    const newRange: DateRange = {
      from: startOfDay(presetRange.from),
      to: endOfDay(presetRange.to),
    };
    setTempRange(newRange);
    setSelectedPreset(preset);
    setIsSelecting(false);
    isSelectingRef.current = false;
  };

  const handleSelect = (selectedRange: { from?: Date; to?: Date } | undefined) => {
    if (!selectedRange) {
      setTempRange({ from: undefined, to: undefined });
      setSelectedPreset(undefined);
      setIsSelecting(false);
      isSelectingRef.current = false;
      return;
    }

    const newRange: DateRange = {
      from: selectedRange.from ? startOfDay(selectedRange.from) : undefined,
      to: selectedRange.to ? endOfDay(selectedRange.to) : undefined,
    };

    setTempRange(newRange);
    setSelectedPreset(undefined);

    // Track if we're in the middle of selecting (have "from" but not "to")
    const hasFromButNotTo = !!newRange.from && !newRange.to;
    isSelectingRef.current = hasFromButNotTo;
    setIsSelecting(hasFromButNotTo);
  };

  const handleConfirm = () => {
    if (tempRange.from) {
      const confirmedRange: DateRange = {
        from: tempRange.from,
        to: tempRange.to || tempRange.from, // If no "to", use "from" as single day
      };
      setRange(confirmedRange);
      setIsOpen(false);
      setIsSelecting(false);
      isSelectingRef.current = false;
      onUpdate?.({ range: confirmedRange, rangeCompare });
    }
  };

  const handleClear = () => {
    const clearedRange: DateRange = { from: undefined, to: undefined };
    setTempRange(clearedRange);
    setRange(clearedRange);
    setSelectedPreset(undefined);
    setIsSelecting(false);
    isSelectingRef.current = false;
    onUpdate?.({ range: clearedRange, rangeCompare });
  };

  const handleCancel = () => {
    // Reset temp range to confirmed range
    setTempRange({
      from: range.from,
      to: range.to,
    });
    setIsOpen(false);
    setIsSelecting(false);
    isSelectingRef.current = false;
  };

  const handleOpenChange = (open: boolean) => {
    if (open) {
      // When opening, initialize temp range with current range
      setTempRange({
        from: range.from,
        to: range.to,
      });
      // Initialize calendar month to show the selected range or current date
      setCalendarMonth(range.from || new Date());
    }
    setIsOpen(open);
    if (!open) {
      setIsSelecting(false);
      isSelectingRef.current = false;
    }
  };

  const formatDateRange = () => {
    if (!range.from && !range.to) {
      return placeholder;
    }
    if (range.from && range.to) {
      if (isSameDay(range.from, range.to)) {
        return format(range.from, "MMM d, yyyy");
      }
      return `${format(range.from, "MMM d, yyyy")} - ${format(range.to, "MMM d, yyyy")}`;
    }
    if (range.from) {
      return `${format(range.from, "MMM d, yyyy")} - ...`;
    }
    return placeholder;
  };

  const handleYearChange = (year: string) => {
    const yearNum = parseInt(year, 10);
    
    // Update the calendar month to the new year
    const newMonth = new Date(yearNum, calendarMonth.getMonth(), 1);
    setCalendarMonth(newMonth);
    
    // If a preset is selected, update the preset range for the new year
    if (selectedPreset) {
      const presetRange = getPresetRange(selectedPreset, yearNum);
      const newRange: DateRange = {
        from: startOfDay(presetRange.from),
        to: endOfDay(presetRange.to),
      };
      setTempRange(newRange);
    }
  };

  const currentYear = calendarMonth.getFullYear();

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal h-9",
            (!range.from || !range.to) && "text-muted-foreground",
            className
          )}
          disabled={disabled}
          type="button"
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="flex-1 truncate text-sm">{formatDateRange()}</span>
          {isOpen ? (
            <ChevronUpIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          ) : (
            <ChevronDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align={align}
        className="w-auto p-3"
        onEscapeKeyDown={() => {
          handleCancel();
        }}
      >
        <div className="flex flex-col gap-3">
          {/* Preset Tabs with Year Selector */}
          {isPreset && (
            <div 
              className="flex items-center gap-2 overflow-x-auto pb-2 scroll-smooth [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [&::-webkit-scrollbar-thumb]:rounded-full"
              onWheel={(e) => {
                e.stopPropagation();
                const element = e.currentTarget;
                element.scrollLeft += e.deltaY;
              }}
            >
              {/* Year Selector as first item */}
              <Select
                value={currentYear.toString()}
                onValueChange={handleYearChange}
              >
                <SelectTrigger className="h-7 w-[85px] text-xs shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent 
                  className="max-h-[200px] [&>div:first-child]:relative [&>div:first-child]:before:content-[''] [&>div:first-child]:before:absolute [&>div:first-child]:before:top-0 [&>div:first-child]:before:left-0 [&>div:first-child]:before:right-0 [&>div:first-child]:before:h-4 [&>div:first-child]:before:bg-[linear-gradient(to_bottom,hsl(var(--popover)),transparent)] [&>div:first-child]:before:pointer-events-none [&>div:first-child]:before:z-10 [&>div:first-child]:after:content-[''] [&>div:first-child]:after:absolute [&>div:first-child]:after:bottom-0 [&>div:first-child]:after:left-0 [&>div:first-child]:after:right-0 [&>div:first-child]:after:h-4 [&>div:first-child]:after:bg-[linear-gradient(to_top,hsl(var(--popover)),transparent)] [&>div:first-child]:after:pointer-events-none [&>div:first-child]:after:z-10"
                  position="popper"
                >
                  {availableYears.length > 0 ? (
                    availableYears.map((year) => (
                      <SelectItem 
                        key={year} 
                        value={year.toString()} 
                        className="text-xs py-2 cursor-pointer hover:bg-accent"
                      >
                        {year}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value={currentYear.toString()} className="text-xs py-2">
                      {currentYear}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>

              {/* Preset Buttons */}
              {PRESETS.map((preset) => (
                <Button
                  key={preset.name}
                  variant={selectedPreset === preset.name ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "h-7 text-xs px-3 transition-all shrink-0",
                    selectedPreset === preset.name 
                      ? "bg-primary text-primary-foreground shadow-sm" 
                      : "hover:bg-accent"
                  )}
                  onClick={() => setPreset(preset.name)}
                  type="button"
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          )}

          {/* Year Selection - Only show if presets are disabled */}
          {!isPreset && (
            <div className="flex items-center gap-2 ">
              <span className="text-xs font-medium text-foreground whitespace-nowrap">Year:</span>
              <Select
                value={currentYear.toString()}
                onValueChange={handleYearChange}
              >
                <SelectTrigger className="h-8 w-[90px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent 
                  className="max-h-[200px] [&>div:first-child]:relative [&>div:first-child]:before:content-[''] [&>div:first-child]:before:absolute [&>div:first-child]:before:top-0 [&>div:first-child]:before:left-0 [&>div:first-child]:before:right-0 [&>div:first-child]:before:h-4 [&>div:first-child]:before:bg-[linear-gradient(to_bottom,hsl(var(--popover)),transparent)] [&>div:first-child]:before:pointer-events-none [&>div:first-child]:before:z-10 [&>div:first-child]:after:content-[''] [&>div:first-child]:after:absolute [&>div:first-child]:after:bottom-0 [&>div:first-child]:after:left-0 [&>div:first-child]:after:right-0 [&>div:first-child]:after:h-4 [&>div:first-child]:after:bg-[linear-gradient(to_top,hsl(var(--popover)),transparent)] [&>div:first-child]:after:pointer-events-none [&>div:first-child]:after:z-10"
                  position="popper"
                >
                  {availableYears.length > 0 ? (
                    availableYears.map((year) => (
                      <SelectItem 
                        key={year} 
                        value={year.toString()} 
                        className="text-xs py-2 cursor-pointer hover:bg-accent"
                      >
                        {year}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value={currentYear.toString()} className="text-xs py-2">
                      {currentYear}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Calendar */}
          <div className="pt-2">
            <Calendar
              mode="range"
              selected={{
                from: tempRange.from,
                to: tempRange.to,
              }}
              onSelect={handleSelect}
              numberOfMonths={isSmallScreen ? 1 : 2}
              fromYear={dateRange?.oldestDate ? new Date(dateRange.oldestDate).getFullYear() : 1970}
              toYear={dateRange?.latestDate ? new Date(dateRange.latestDate).getFullYear() : new Date().getFullYear() + 10}
              month={calendarMonth}
              onMonthChange={setCalendarMonth}
              disabled={(date) => {
                // Check if date is outside allowed range
                if (dateRange?.oldestDate && date < new Date(dateRange.oldestDate)) return true;
                if (dateRange?.latestDate && date > new Date(dateRange.latestDate)) return true;
                
                // Check if date falls within any disabled date ranges
                for (const disabledRange of disabledDateRanges) {
                  const from = new Date(disabledRange.from);
                  const to = new Date(disabledRange.to);
                  from.setHours(0, 0, 0, 0);
                  to.setHours(23, 59, 59, 999);
                  if (date >= from && date <= to) return true;
                }
                
                return false;
              }}
            />
          </div>

          {/* Selection summary */}
          {tempRange.from && (
            <div className="text-xs text-center py-1.5 px-3 bg-muted/50 rounded-md">
              {tempRange.from && tempRange.to ? (
                <span className="font-medium">
                  {format(tempRange.from, "MMM d, yyyy")} — {format(tempRange.to, "MMM d, yyyy")}
                </span>
              ) : tempRange.from ? (
                <span className="text-muted-foreground">
                  {format(tempRange.from, "MMM d, yyyy")} — <span className="italic">Select end date</span>
                </span>
              ) : null}
            </div>
          )}

          {/* Action buttons */}
          <div className={cn(
            "flex gap-2 pt-2 border-t",
            isSmallScreen ? "flex-col" : "flex-row justify-end"
          )}>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className={cn("h-8 text-xs", isSmallScreen && "order-3")}
              type="button"
            >
              Clear
            </Button>
            <div className={cn("flex gap-2", isSmallScreen && "order-1 flex-col")}>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                className="h-8 text-xs"
                type="button"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleConfirm}
                disabled={!tempRange.from}
                className="h-8 text-xs"
                type="button"
              >
                <Check className="h-3.5 w-3.5 mr-1" />
                Done
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

DateRangePicker.displayName = "DateRangePicker";
DateRangePicker.filePath = "components/ui/date-range-picker.tsx";
