"use client";

import { useMemo } from "react";
import { isToday, startOfDay, format } from "date-fns";
import { useCalendar } from "@/components/ui/calendar/contexts/calendar-context";
import { getCalendarCells, getMonthCellEvents, calculateMonthEventPositions } from "@/components/ui/calendar/helpers";
import { DndProviderWrapper } from "./dnd/dnd-provider";
import { DroppableDayCell } from "./dnd/droppable-day-cell";
import { cn } from "@/lib/utils";
import type { IEvent } from "@/components/ui/calendar/interfaces";

interface PolicyAssignmentCalendarProps {
  onDateClick: (date: Date) => void;
}

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function PolicyAssignmentCalendar({ onDateClick }: PolicyAssignmentCalendarProps) {
  const { selectedDate, events } = useCalendar();

  const cells = useMemo(() => getCalendarCells(selectedDate), [selectedDate]);

  const singleDayEvents = events.filter(event => {
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    return start.toDateString() === end.toDateString();
  });

  const multiDayEvents = events.filter(event => {
    const start = new Date(event.startDate);
    const end = new Date(event.endDate);
    return start.toDateString() !== end.toDateString();
  });

  const eventPositions = useMemo(
    () => calculateMonthEventPositions(multiDayEvents, singleDayEvents, selectedDate),
    [multiDayEvents, singleDayEvents, selectedDate]
  );

  const allEvents = [...multiDayEvents, ...singleDayEvents];

  return (
    <DndProviderWrapper>
    <div>
      <div className="grid grid-cols-7 divide-x">
        {WEEK_DAYS.map(day => (
          <div key={day} className="flex items-center justify-center py-2">
            <span className="text-xs font-medium text-muted-foreground">{day}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 overflow-hidden">
        {cells.map(cell => {
          const { day, currentMonth, date } = cell;
          const cellEvents = getMonthCellEvents(date, allEvents, eventPositions);
          const isSunday = date.getDay() === 0;

          return (
            <DroppableDayCell key={date.toISOString()} cell={cell}>
              <div
                className={cn(
                  "flex h-full min-h-[100px] flex-col gap-1 border-l border-t py-1.5 lg:pb-2 lg:pt-1 cursor-pointer hover:bg-accent/50 transition-colors",
                  isSunday && "border-l-0"
                )}
                onClick={() => onDateClick(date)}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDateClick(date);
                  }}
                  className={cn(
                    "flex size-6 translate-x-1 items-center justify-center rounded-full text-xs font-semibold hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring lg:px-2",
                    !currentMonth && "opacity-20",
                    isToday(date) && "bg-primary font-bold text-primary-foreground hover:bg-primary"
                  )}
                >
                  {day}
                </button>

                <div className={cn("flex flex-col gap-1 px-2 flex-1", !currentMonth && "opacity-50")}>
                  {cellEvents.slice(0, 3).map((event, index) => {
                    const colorMap: Record<string, string> = {
                      blue: "bg-blue-500",
                      green: "bg-green-500",
                      red: "bg-red-500",
                      yellow: "bg-yellow-500",
                      purple: "bg-purple-500",
                      orange: "bg-orange-500",
                      gray: "bg-gray-500",
                    };

                    return (
                      <div
                        key={`${event.id}-${index}`}
                        className={cn(
                          "text-xs px-2 py-1 rounded truncate text-white font-medium",
                          colorMap[event.color] || "bg-gray-500"
                        )}
                        title={event.title}
                      >
                        {event.title}
                      </div>
                    );
                  })}
                  {cellEvents.length > 3 && (
                    <p className="text-xs text-muted-foreground px-2">
                      +{cellEvents.length - 3} more
                    </p>
                  )}
                </div>
              </div>
            </DroppableDayCell>
          );
        })}
      </div>
    </div>
    </DndProviderWrapper>
  );
}

