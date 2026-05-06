"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

export function PosClock() {
  const [date, setDate] = useState<Date | null>(null);

  useEffect(() => {
    setDate(new Date());
    const timer = setInterval(() => {
      setDate(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  if (!date) return null;

  const formattedDate = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const formattedTime = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground mr-4 hidden lg:flex bg-muted/30 px-3 py-1.5 rounded-md border border-border/50">
      <Clock className="h-4 w-4" />
      <span className="font-medium">{formattedDate}</span>
      <span className="w-px h-4 bg-border mx-1"></span>
      <span className="font-mono">{formattedTime}</span>
    </div>
  );
}
