"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion, AnimatePresence } from "motion/react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

interface MonthYearPickerProps {
  value?: string | string[]; // Format: "YYYY-MM" or ["YYYY-MM", ...]
  onChange?: (value: string | string[]) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  fromYear?: number;
  toYear?: number;
  multiple?: boolean; // Enable multiple month selection
}

export function MonthYearPicker({
  value,
  onChange,
  disabled,
  className,
  placeholder = "Select month and year",
  fromYear = 2020,
  toYear = new Date().getFullYear() + 5,
  multiple = false,
}: MonthYearPickerProps) {
  const [open, setOpen] = React.useState(false);
  
  // For single selection
  const [selectedMonth, setSelectedMonth] = React.useState<number | null>(
    !multiple && value && typeof value === 'string' ? parseInt(value.split("-")[1]) - 1 : null
  );
  const [selectedYear, setSelectedYear] = React.useState<number | null>(
    !multiple && value && typeof value === 'string' ? parseInt(value.split("-")[0]) : null
  );
  
  // For multiple selection
  const [selectedMonths, setSelectedMonths] = React.useState<Set<string>>(() => {
    if (multiple && Array.isArray(value)) {
      return new Set(value);
    }
    return new Set();
  });
  
  const [viewYear, setViewYear] = React.useState(() => {
    if (value) {
      if (multiple && Array.isArray(value) && value.length > 0) {
        return parseInt(value[0].split("-")[0]);
      } else if (!multiple && typeof value === 'string') {
        return parseInt(value.split("-")[0]);
      }
    }
    return new Date().getFullYear();
  });
  const [viewMonth, setViewMonth] = React.useState(
    value && !multiple && typeof value === 'string' 
      ? parseInt(value.split("-")[1]) - 1 
      : new Date().getMonth()
  );

  React.useEffect(() => {
    if (multiple) {
      if (Array.isArray(value)) {
        setSelectedMonths(new Set(value));
      } else {
        setSelectedMonths(new Set());
      }
    } else {
      if (value && typeof value === 'string') {
        const [year, month] = value.split("-").map(Number);
        setSelectedMonth(month - 1);
        setSelectedYear(year);
        setViewYear(year);
        setViewMonth(month - 1);
      } else {
        setSelectedMonth(null);
        setSelectedYear(null);
      }
    }
  }, [value, multiple]);

  const handleMonthSelect = (month: number) => {
    if (multiple) {
      const monthYearKey = `${viewYear}-${String(month + 1).padStart(2, "0")}`;
      const newSelectedMonths = new Set(selectedMonths);
      
      if (newSelectedMonths.has(monthYearKey)) {
        newSelectedMonths.delete(monthYearKey);
      } else {
        newSelectedMonths.add(monthYearKey);
      }
      
      setSelectedMonths(newSelectedMonths);
      const sortedMonths = Array.from(newSelectedMonths).sort();
      onChange?.(sortedMonths);
      // Keep popover open for multiple selection
    } else {
      setSelectedMonth(month);
      setViewMonth(month);
      const yearToUse = selectedYear !== null ? selectedYear : viewYear;
      setSelectedYear(yearToUse);
      const newValue = `${yearToUse}-${String(month + 1).padStart(2, "0")}`;
      onChange?.(newValue);
      setOpen(false);
    }
  };

  const handleYearSelect = (year: number) => {
    setViewYear(year);
    if (!multiple) {
      setSelectedYear(year);
      if (selectedMonth !== null) {
        const newValue = `${year}-${String(selectedMonth + 1).padStart(2, "0")}`;
        onChange?.(newValue);
        setOpen(false);
      }
    }
  };

  const displayValue = React.useMemo(() => {
    if (multiple) {
      if (selectedMonths.size === 0) return "";
      if (selectedMonths.size === 1) {
        const [year, month] = Array.from(selectedMonths)[0].split("-").map(Number);
        return format(new Date(year, month - 1, 1), "MMMM yyyy");
      }
      return `${selectedMonths.size} months selected`;
    } else {
      if (selectedMonth !== null && selectedYear !== null) {
        return format(new Date(selectedYear, selectedMonth, 1), "MMMM yyyy");
      }
      return "";
    }
  }, [selectedMonth, selectedYear, selectedMonths, multiple]);

  const years = React.useMemo(() => {
    const yearList = [];
    for (let year = fromYear; year <= toYear; year++) {
      yearList.push(year);
    }
    return yearList;
  }, [fromYear, toYear]);

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const handleRemoveMonth = (monthYearKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSelectedMonths = new Set(selectedMonths);
    newSelectedMonths.delete(monthYearKey);
    setSelectedMonths(newSelectedMonths);
    const sortedMonths = Array.from(newSelectedMonths).sort();
    onChange?.(sortedMonths);
  };

  const handleClearAll = () => {
    if (multiple) {
      setSelectedMonths(new Set());
      onChange?.([]);
    } else {
      onChange?.("");
      setSelectedMonth(null);
      setSelectedYear(null);
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !displayValue && "text-muted-foreground",
            multiple && selectedMonths.size > 0 && "h-auto min-h-10 py-2",
            className
          )}
          disabled={disabled}
          type="button"
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <div className="flex flex-wrap gap-1 flex-1">
            {multiple && selectedMonths.size > 0 ? (
              Array.from(selectedMonths)
                .sort()
                .slice(0, 3)
                .map((monthYear) => {
                  const [year, month] = monthYear.split("-").map(Number);
                  return (
                    <Badge
                      key={monthYear}
                      variant="secondary"
                      className="text-xs"
                      onClick={(e) => handleRemoveMonth(monthYear, e)}
                    >
                      {format(new Date(year, month - 1, 1), "MMM yyyy")}
                      <X className="ml-1 h-3 w-3" />
                    </Badge>
                  );
                })
            ) : (
              <span>{displayValue || placeholder}</span>
            )}
            {multiple && selectedMonths.size > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{selectedMonths.size - 3} more
              </Badge>
            )}
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 max-w-[320px]" align="start">
        <div className="p-4">
          {/* Year Navigation */}
          <div className="flex items-center justify-between mb-4">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                const newYear = Math.max(fromYear, viewYear - 1);
                setViewYear(newYear);
              }}
              disabled={viewYear <= fromYear}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-2">
              <Select
                value={viewYear.toString()}
                onValueChange={(val) => {
                  const year = parseInt(val);
                  handleYearSelect(year);
                }}
              >
                <SelectTrigger className="w-[100px] h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                const newYear = Math.min(toYear, viewYear + 1);
                setViewYear(newYear);
              }}
              disabled={viewYear >= toYear}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Selected Months Display (for multiple mode) */}
          {multiple && selectedMonths.size > 0 && (() => {
            const sortedMonths = Array.from(selectedMonths).sort();
            const displayCount = 4; // Show first 4 badges
            const displayedMonths = sortedMonths.slice(0, displayCount);
            const remainingMonths = sortedMonths.slice(displayCount);
            const hasMore = remainingMonths.length > 0;

            return (
              <div className="mb-3 p-2 bg-muted rounded-md">
                <div className="text-xs font-medium mb-1">Selected ({selectedMonths.size}):</div>
                <div className="flex flex-wrap gap-1">
                  {displayedMonths.map((monthYear) => {
                    const [year, month] = monthYear.split("-").map(Number);
                    return (
                      <Badge
                        key={monthYear}
                        variant="secondary"
                        className="text-xs cursor-pointer hover:bg-secondary/80"
                        onClick={(e) => handleRemoveMonth(monthYear, e)}
                      >
                        {format(new Date(year, month - 1, 1), "MMM yyyy")}
                        <X className="ml-1 h-3 w-3" />
                      </Badge>
                    );
                  })}
                  {hasMore && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="secondary"
                          className="text-xs cursor-pointer hover:bg-secondary/80"
                        >
                          +{remainingMonths.length} more
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        className="max-w-[180px] p-2"
                      >
                        <div className="text-xs">
                          <div className="font-medium mb-1.5">Remaining:</div>
                          <div className="grid grid-cols-2 gap-x-2 gap-y-0.5">
                            {remainingMonths.map((monthYear) => {
                              const [year, month] = monthYear.split("-").map(Number);
                              return (
                                <div
                                  key={monthYear}
                                  className="cursor-pointer hover:text-primary/80 truncate"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveMonth(monthYear, e);
                                  }}
                                >
                                  {format(new Date(year, month - 1, 1), "MMM yyyy")}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Month Grid */}
          <div className="grid grid-cols-3 gap-2 w-[280px]">
            <AnimatePresence mode="wait">
              {MONTHS.map((month, index) => {
                const monthYearKey = `${viewYear}-${String(index + 1).padStart(2, "0")}`;
                
                let isSelected = false;
                if (multiple) {
                  isSelected = selectedMonths.has(monthYearKey);
                } else {
                  const yearToCheck = selectedYear !== null ? selectedYear : viewYear;
                  isSelected = selectedMonth === index && yearToCheck === viewYear;
                }
                
                const isCurrent = index === currentMonth && viewYear === currentYear;
                const isPast = viewYear < currentYear || 
                  (viewYear === currentYear && index < currentMonth);

                return (
                  <motion.button
                    key={`${viewYear}-${index}`}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.15 }}
                    type="button"
                    onClick={() => handleMonthSelect(index)}
                    className={cn(
                      "relative h-12 px-3 text-sm font-medium rounded-md transition-all duration-200",
                      "hover:bg-accent hover:text-accent-foreground",
                      "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                      isSelected &&
                        "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md",
                      isCurrent && !isSelected &&
                        "ring-2 ring-primary/20 bg-primary/5",
                      isPast && "opacity-60"
                    )}
                  >
                    <span className="truncate">{month.slice(0, 3)}</span>
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute -top-1 -right-1"
                      >
                        <div className="h-5 w-5 rounded-full bg-primary-foreground flex items-center justify-center">
                          <Check className="h-3 w-3 text-primary" />
                        </div>
                      </motion.div>
                    )}
                  </motion.button>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 mt-4 pt-4 border-t">
            {!multiple && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  const today = new Date();
                  handleYearSelect(today.getFullYear());
                  handleMonthSelect(today.getMonth());
                }}
              >
                Today
              </Button>
            )}
            {(multiple ? selectedMonths.size > 0 : selectedMonth !== null) && (
              <Button
                variant="outline"
                size="sm"
                className={multiple ? "flex-1" : "flex-1"}
                onClick={handleClearAll}
              >
                Clear
              </Button>
            )}
            {multiple && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  // Select first 6 months of current year
                  const today = new Date();
                  const currentYear = today.getFullYear();
                  const firstSixMonths: string[] = [];
                  for (let i = 0; i < 6; i++) {
                    firstSixMonths.push(`${currentYear}-${String(i + 1).padStart(2, "0")}`);
                  }
                  setSelectedMonths(new Set(firstSixMonths));
                  setViewYear(currentYear);
                  onChange?.(firstSixMonths);
                }}
              >
                First 6 Months
              </Button>
            )}
            {multiple && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  // Select all months of current year
                  const today = new Date();
                  const currentYear = today.getFullYear();
                  const allMonths: string[] = [];
                  for (let i = 0; i < 12; i++) {
                    allMonths.push(`${currentYear}-${String(i + 1).padStart(2, "0")}`);
                  }
                  setSelectedMonths(new Set(allMonths));
                  setViewYear(currentYear);
                  onChange?.(allMonths);
                }}
              >
                Full Year
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
