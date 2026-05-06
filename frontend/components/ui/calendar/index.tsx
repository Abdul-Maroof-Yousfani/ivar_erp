"use client";

import { CalendarProvider } from "./contexts/calendar-context";
import { ClientContainer } from "./components/client-container";
import { DndProviderWrapper } from "./components/dnd/dnd-provider";

import type { IEvent, IUser } from "./interfaces";
import type { TCalendarView } from "./types";

interface CalendarProps {
  view: TCalendarView;
  users: IUser[];
  events: IEvent[];
}

export function Calendar({ view, users, events }: CalendarProps) {
  return (
    <DndProviderWrapper>
      <CalendarProvider users={users} events={events}>
        <div className="mx-auto flex max-w-screen-2xl flex-col gap-4 px-8 py-4">
          <ClientContainer view={view} />
        </div>
      </CalendarProvider>
    </DndProviderWrapper>
  );
}

export * from "./types";
export * from "./interfaces";
export * from "./contexts/calendar-context";
export * from "./components/client-container";

