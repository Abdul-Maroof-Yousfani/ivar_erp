"use client";

import * as React from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

export function DatePicker({ value, onChange, disabled, className, placeholder, name, fromYear = 1970, toYear = new Date().getFullYear() + 10 }: { value?: string; onChange?: (value: string) => void; disabled?: boolean; className?: string; placeholder?: string; name?: string; fromYear?: number; toYear?: number }) {
  const [date, setDate] = React.useState<Date | undefined>(value ? new Date(value) : undefined);
  const [viewMonth, setViewMonth] = React.useState<Date | undefined>(value ? new Date(value) : new Date());

  React.useEffect(() => {
    setDate(value ? new Date(value) : undefined);
  }, [value]);

  const handleSelect = (d: Date | undefined) => {
    setDate(d);
    if (onChange) onChange(d ? format(d, "yyyy-MM-dd") : "");
  };

  return (
    <>
      {name && <input type="hidden" name={name} value={date ? format(date, "yyyy-MM-dd") : ""} />}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground", className)}
            disabled={disabled}
            type="button"
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(date, "PPP") : (placeholder || "Pick a date")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleSelect}
            captionLayout="dropdown"
            fromYear={fromYear}
            toYear={toYear}
            month={viewMonth}
            onMonthChange={setViewMonth}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </>
  );
}
