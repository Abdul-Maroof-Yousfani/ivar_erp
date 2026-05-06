import { useMemo } from "react";
import { formatDate } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { useCalendar } from "@/components/ui/calendar/contexts/calendar-context";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { getEventsCount, navigateDate, rangeText } from "@/components/ui/calendar/helpers";

import type { IEvent } from "@/components/ui/calendar/interfaces";
import type { TCalendarView } from "@/components/ui/calendar/types";

interface PolicyCalendarHeaderProps {
  events: IEvent[];
}

export function PolicyCalendarHeader({ events }: PolicyCalendarHeaderProps) {
  const { selectedDate, setSelectedDate } = useCalendar();
  const view: TCalendarView = "month";

  const month = formatDate(selectedDate, "MMMM");
  const year = selectedDate.getFullYear();

  const eventCount = useMemo(() => getEventsCount(events, selectedDate, view), [events, selectedDate, view]);

  const handlePrevious = () => setSelectedDate(navigateDate(selectedDate, view, "previous"));
  const handleNext = () => setSelectedDate(navigateDate(selectedDate, view, "next"));

  return (
    <div className="flex flex-col gap-4 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3">
        <button
          className="flex size-14 flex-col items-start overflow-hidden rounded-lg border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring hover:bg-accent"
          onClick={() => setSelectedDate(new Date())}
        >
          <p className="flex h-6 w-full items-center justify-center bg-primary text-center text-xs font-semibold text-primary-foreground">
            {formatDate(new Date(), "MMM").toUpperCase()}
          </p>
          <p className="flex w-full items-center justify-center text-lg font-bold">{new Date().getDate()}</p>
        </button>
        
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">
              {month} {year}
            </span>
            <Badge variant="outline" className="px-1.5">
              {eventCount} assignments
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" className="size-6.5 px-0 [&_svg]:size-4.5" onClick={handlePrevious}>
              <ChevronLeft />
            </Button>

            <p className="text-sm text-muted-foreground">{rangeText(view, selectedDate)}</p>

            <Button variant="outline" className="size-6.5 px-0 [&_svg]:size-4.5" onClick={handleNext}>
              <ChevronRight />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

