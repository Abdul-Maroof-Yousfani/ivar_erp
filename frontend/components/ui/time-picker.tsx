"use client";

import * as React from "react";
import { format } from "date-fns";
import { Clock, ChevronUp, ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TimePickerProps {
  value?: string; // Format: "HH:mm" (24-hour format)
  onChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  label?: string;
  showAmPm?: boolean; // Enable AM/PM mode
}

export function TimePicker({
  value,
  onChange,
  disabled,
  className,
  placeholder = "Select time",
  label,
  showAmPm = false,
}: TimePickerProps) {
  const [time, setTime] = React.useState<Date | undefined>(
    value ? new Date(`2000-01-01T${value}`) : undefined
  );
  const [open, setOpen] = React.useState(false);
  const [hourInput, setHourInput] = React.useState("");
  const [minuteInput, setMinuteInput] = React.useState("");
  const [focusedField, setFocusedField] = React.useState<"hour" | "minute" | null>(null);
  const [isAm, setIsAm] = React.useState(true);
  const [hourDirection, setHourDirection] = React.useState<"up" | "down" | null>(null);
  const [minuteDirection, setMinuteDirection] = React.useState<"up" | "down" | null>(null);
  const hourInputRef = React.useRef<HTMLInputElement>(null);
  const minuteInputRef = React.useRef<HTMLInputElement>(null);
  const prevHourRef = React.useRef<string>("");
  const prevMinuteRef = React.useRef<string>("");

  // Block body scroll when popover is open
  React.useEffect(() => {
    if (open) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [open]);

  React.useEffect(() => {
    if (value && value.trim() !== "") {
      try {
        const date = new Date(`2000-01-01T${value}`);
        setTime(date);
        const hours = date.getHours();
        if (showAmPm) {
          setIsAm(hours < 12);
          setHourInput(((hours % 12) || 12).toString().padStart(2, "0"));
        } else {
          setHourInput(hours.toString().padStart(2, "0"));
        }
        setMinuteInput(date.getMinutes().toString().padStart(2, "0"));
      } catch (e) {
        setTime(undefined);
        setHourInput("");
        setMinuteInput("");
      }
    } else {
      setTime(undefined);
      setHourInput("");
      setMinuteInput("");
    }
  }, [value, showAmPm]);

  React.useEffect(() => {
    if (open && hourInputRef.current) {
      setTimeout(() => {
        hourInputRef.current?.focus();
        hourInputRef.current?.select();
        setFocusedField("hour");
      }, 100);
    }
  }, [open]);

  const updateTime = (hours: number, minutes: number, am?: boolean) => {
    let finalHours = hours;
    
    if (showAmPm) {
      if (am !== undefined) {
        setIsAm(am);
      }
      const currentAm = am !== undefined ? am : isAm;
      if (currentAm && hours === 12) {
        finalHours = 0;
      } else if (!currentAm && hours !== 12) {
        finalHours = hours + 12;
      } else if (!currentAm && hours === 12) {
        finalHours = 12;
      }
    }
    
    const newTime = new Date("2000-01-01T00:00:00");
    newTime.setHours(Math.max(0, Math.min(23, finalHours)));
    newTime.setMinutes(Math.max(0, Math.min(59, minutes)));
    
    setTime(newTime);
    
    if (showAmPm) {
      const displayHour = (finalHours % 12) || 12;
      setHourInput(displayHour.toString().padStart(2, "0"));
    } else {
      setHourInput(finalHours.toString().padStart(2, "0"));
    }
    setMinuteInput(newTime.getMinutes().toString().padStart(2, "0"));
    
    const timeString = format(newTime, "HH:mm");
    if (onChange) onChange(timeString);
  };

  const handleHourChange = (newHour: number) => {
    const currentMinutes = time ? time.getMinutes() : 0;
    const currentHour = time ? time.getHours() : 0;
    const displayHour = showAmPm ? ((currentHour % 12) || 12) : currentHour;
    
    // Determine direction for sliding animation
    if (newHour > displayHour || (newHour === 1 && displayHour === (showAmPm ? 12 : 23))) {
      setHourDirection("up");
    } else if (newHour < displayHour || (newHour === (showAmPm ? 12 : 23) && displayHour === 1)) {
      setHourDirection("down");
    }
    
    // Reset direction after animation
    setTimeout(() => setHourDirection(null), 300);
    
    updateTime(newHour, currentMinutes);
  };

  const handleMinuteChange = (newMinute: number) => {
    const currentHours = time ? time.getHours() : 0;
    const displayHour = showAmPm ? ((currentHours % 12) || 12) : currentHours;
    const currentMinute = time ? time.getMinutes() : 0;
    
    // Determine direction for sliding animation
    if (newMinute > currentMinute || (newMinute === 0 && currentMinute === 59)) {
      setMinuteDirection("up");
    } else if (newMinute < currentMinute || (newMinute === 59 && currentMinute === 0)) {
      setMinuteDirection("down");
    }
    
    // Reset direction after animation
    setTimeout(() => setMinuteDirection(null), 300);
    
    updateTime(displayHour, newMinute);
  };

  const handleAmPmToggle = (am: boolean) => {
    const currentHours = time ? time.getHours() : 0;
    const displayHour = showAmPm ? ((currentHours % 12) || 12) : currentHours;
    const currentMinutes = time ? time.getMinutes() : 0;
    updateTime(displayHour, currentMinutes, am);
  };

  const handleHourInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "");
    setHourInput(val);
    
    if (val === "") return;
    
    const num = parseInt(val, 10);
    const maxHour = showAmPm ? 12 : 23;
    if (!isNaN(num) && num >= 1 && num <= maxHour) {
      handleHourChange(num);
      if (val.length === 2) {
        setTimeout(() => {
          minuteInputRef.current?.focus();
          minuteInputRef.current?.select();
          setFocusedField("minute");
        }, 50);
      }
    }
  };

  const handleMinuteInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "");
    setMinuteInput(val);
    
    if (val === "") return;
    
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0 && num <= 59) {
      handleMinuteChange(num);
    }
  };

  const handleHourKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      incrementHour();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      decrementHour();
    } else if (e.key === "Tab" && !e.shiftKey && hourInput.length === 2) {
      e.preventDefault();
      minuteInputRef.current?.focus();
      minuteInputRef.current?.select();
      setFocusedField("minute");
    } else if (e.key === "Enter") {
      e.preventDefault();
      setOpen(false);
    }
  };

  const handleMinuteKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      incrementMinute();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      decrementMinute();
    } else if (e.key === "Enter") {
      e.preventDefault();
      setOpen(false);
    }
  };

  const handleHourWheel = (e: React.WheelEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.deltaY < 0) {
      incrementHour();
    } else {
      decrementHour();
    }
  };

  const handleMinuteWheel = (e: React.WheelEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.deltaY < 0) {
      incrementMinute();
    } else {
      decrementMinute();
    }
  };

  const handleHourBlur = () => {
    setFocusedField(null);
    if (hourInput === "") {
      const currentHour = time ? time.getHours() : 0;
      const displayHour = showAmPm ? ((currentHour % 12) || 12) : currentHour;
      setHourInput(displayHour.toString().padStart(2, "0"));
    } else {
      const num = parseInt(hourInput, 10);
      const maxHour = showAmPm ? 12 : 23;
      if (isNaN(num) || num < 1) {
        handleHourChange(1);
      } else if (num > maxHour) {
        handleHourChange(maxHour);
      } else {
        handleHourChange(num);
      }
    }
  };

  const handleMinuteBlur = () => {
    setFocusedField(null);
    if (minuteInput === "") {
      const currentMinute = time ? time.getMinutes() : 0;
      setMinuteInput(currentMinute.toString().padStart(2, "0"));
    } else {
      const num = parseInt(minuteInput, 10);
      if (isNaN(num) || num < 0) {
        handleMinuteChange(0);
      } else if (num > 59) {
        handleMinuteChange(59);
      } else {
        handleMinuteChange(num);
      }
    }
  };

  const incrementHour = () => {
    const currentHour = time ? time.getHours() : 0;
    const displayHour = showAmPm ? ((currentHour % 12) || 12) : currentHour;
    const maxHour = showAmPm ? 12 : 23;
    const nextHour = displayHour === maxHour ? (showAmPm ? 1 : 0) : displayHour + 1;
    handleHourChange(nextHour);
  };

  const decrementHour = () => {
    const currentHour = time ? time.getHours() : 0;
    const displayHour = showAmPm ? ((currentHour % 12) || 12) : currentHour;
    const maxHour = showAmPm ? 12 : 23;
    const prevHour = displayHour === 1 ? (showAmPm ? 12 : maxHour) : displayHour - 1;
    handleHourChange(prevHour);
  };

  const incrementMinute = () => {
    const currentMinute = time ? time.getMinutes() : 0;
    handleMinuteChange((currentMinute + 1) % 60);
  };

  const decrementMinute = () => {
    const currentMinute = time ? time.getMinutes() : 0;
    handleMinuteChange((currentMinute - 1 + 60) % 60);
  };

  const handleQuickTimeSelect = (hour: number, minute: number) => {
    updateTime(hour, minute);
    setOpen(false);
  };

  const displayValue = time 
    ? (showAmPm 
        ? format(time, "hh:mm aa") 
        : format(time, "HH:mm"))
    : placeholder;

  const quickTimes = [
    { label: "9:00", hour: 9, minute: 0 },
    { label: "12:00", hour: 12, minute: 0 },
    { label: "13:00", hour: 13, minute: 0 },
    { label: "17:00", hour: 17, minute: 0 },
    { label: "18:00", hour: 18, minute: 0 },
  ];

  return (
    <div className={cn("space-y-2", className)}>
        {label && (
          <Label className="text-sm font-medium">{label}</Label>
        )}
        <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !time && "text-muted-foreground",
              className
            )}
            disabled={disabled}
            type="button"
          >
            <Clock className="mr-2 h-4 w-4" />
            {displayValue}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="start">
          <div className="space-y-3">
            {/* Time Input Section */}
            <div className="flex items-center gap-2">
              {/* Hours */}
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">Hour</Label>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={incrementHour}
                    type="button"
                    tabIndex={-1}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <div className="relative w-14 h-10 overflow-hidden rounded-md border border-input bg-background">
                    <Input
                      ref={hourInputRef}
                      type="text"
                      inputMode="numeric"
                      value={hourInput}
                      onChange={handleHourInputChange}
                      onBlur={handleHourBlur}
                      onFocus={() => setFocusedField("hour")}
                      onKeyDown={handleHourKeyDown}
                      onWheel={handleHourWheel}
                      className={cn(
                        "w-full text-center text-base font-medium h-10 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0",
                        focusedField === "hour" && "ring-2 ring-ring ring-offset-0"
                      )}
                      style={{
                        transform: hourDirection === "up" 
                          ? "translateY(-100%)" 
                          : hourDirection === "down" 
                          ? "translateY(100%)" 
                          : "translateY(0)",
                        opacity: hourDirection ? 0 : 1,
                        transition: hourDirection ? "transform 0.25s ease-out, opacity 0.25s ease-out" : "none"
                      }}
                      maxLength={2}
                      placeholder="00"
                    />
                    {hourDirection && (
                      <div
                        className="absolute inset-0 flex items-center justify-center text-base font-medium"
                        style={{
                          animation: hourDirection === "up"
                            ? "slideInFromBottom 0.25s ease-out forwards"
                            : "slideInFromTop 0.25s ease-out forwards"
                        }}
                      >
                        {hourInput}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={decrementHour}
                    type="button"
                    tabIndex={-1}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Separator */}
              <div className="flex items-center h-10 pt-6">
                <span className="text-lg text-muted-foreground">:</span>
              </div>

              {/* Minutes */}
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">Minute</Label>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={incrementMinute}
                    type="button"
                    tabIndex={-1}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <div className="relative w-14 h-10 overflow-hidden rounded-md border border-input bg-background">
                    <Input
                      ref={minuteInputRef}
                      type="text"
                      inputMode="numeric"
                      value={minuteInput}
                      onChange={handleMinuteInputChange}
                      onBlur={handleMinuteBlur}
                      onFocus={() => setFocusedField("minute")}
                      onKeyDown={handleMinuteKeyDown}
                      onWheel={handleMinuteWheel}
                      className={cn(
                        "w-full text-center text-base font-medium h-10 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0",
                        focusedField === "minute" && "ring-2 ring-ring ring-offset-0"
                      )}
                      style={{
                        transform: minuteDirection === "up" 
                          ? "translateY(-100%)" 
                          : minuteDirection === "down" 
                          ? "translateY(100%)" 
                          : "translateY(0)",
                        opacity: minuteDirection ? 0 : 1,
                        transition: minuteDirection ? "transform 0.25s ease-out, opacity 0.25s ease-out" : "none"
                      }}
                      maxLength={2}
                      placeholder="00"
                    />
                    {minuteDirection && (
                      <div
                        className="absolute inset-0 flex items-center justify-center text-base font-medium"
                        style={{
                          transform: minuteDirection === "up" 
                            ? "translateY(0)" 
                            : "translateY(0)",
                          ...(minuteDirection === "up" ? {
                            animation: "slideInFromBottom 0.25s ease-out forwards"
                          } : {
                            animation: "slideInFromTop 0.25s ease-out forwards"
                          })
                        }}
                      >
                        {minuteInput}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={decrementMinute}
                    type="button"
                    tabIndex={-1}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* AM/PM Toggle */}
              {showAmPm && (
                <>
                  <div className="flex items-center h-10 pt-6">
                    <span className="text-sm text-muted-foreground mx-1">|</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-xs text-muted-foreground">Period</Label>
                    <div className="flex gap-1">
                      <Button
                        variant={isAm ? "default" : "outline"}
                        size="sm"
                        className="h-8 px-3 text-xs"
                        onClick={() => handleAmPmToggle(true)}
                        type="button"
                      >
                        AM
                      </Button>
                      <Button
                        variant={!isAm ? "default" : "outline"}
                        size="sm"
                        className="h-8 px-3 text-xs"
                        onClick={() => handleAmPmToggle(false)}
                        type="button"
                      >
                        PM
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Quick Select */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Quick Select</Label>
              <div className="flex flex-wrap gap-1.5">
                {quickTimes.map((preset) => {
                  const isSelected =
                    time &&
                    time.getHours() === preset.hour &&
                    time.getMinutes() === preset.minute;
                  return (
                    <Button
                      key={preset.label}
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleQuickTimeSelect(preset.hour, preset.minute)}
                      type="button"
                    >
                      {preset.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}