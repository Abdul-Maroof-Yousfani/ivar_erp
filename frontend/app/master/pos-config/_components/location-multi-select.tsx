"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Search } from "lucide-react";
import { Location } from "@/lib/actions/location";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function LocationMultiSelect({
  locations,
  selected,
  onChange,
  disabled,
  maxHeight = "calc(100vh - 18rem)",
}: {
  locations: Location[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
  maxHeight?: string;
}) {
  const [search, setSearch] = React.useState("");

  const filtered = locations.filter(
    (loc) =>
      loc.name.toLowerCase().includes(search.toLowerCase()) ||
      loc.code.toLowerCase().includes(search.toLowerCase()),
  );

  const toggle = (id: string) => {
    if (disabled) return;
    onChange(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id],
    );
  };

  const isAllSelected =
    filtered.length > 0 && filtered.every((l) => selected.includes(l.id));

  const toggleAll = () => {
    if (isAllSelected) {
      onChange(selected.filter((id) => !filtered.some((l) => l.id === id)));
    } else {
      const newIds = filtered
        .map((l) => l.id)
        .filter((id) => !selected.includes(id));
      onChange([...selected, ...newIds]);
    }
  };

  const clearAll = () => {
    onChange([]);
  };

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      {/* Search header */}
      <div className="p-3 border-b space-y-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9 h-9 text-sm"
            placeholder="Search locations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={disabled}
          />
        </div>

        {/* Selection summary */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {selected.length > 0 ? (
              <span className="font-medium text-foreground">
                {selected.length}
              </span>
            ) : (
              "0"
            )}{" "}
            of {locations.length} selected
          </span>
          <div className="flex gap-1">
            {selected.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2 text-muted-foreground hover:text-foreground"
                onClick={clearAll}
                disabled={disabled}
              >
                Clear All
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-2 text-muted-foreground hover:text-foreground"
              onClick={toggleAll}
              disabled={disabled || filtered.length === 0}
            >
              {isAllSelected ? "Deselect All" : "Select All"}
            </Button>
          </div>
        </div>
      </div>

      {/* Location list */}
      <ScrollArea style={{ height: maxHeight }}>
        {filtered.length === 0 ? (
          <div className="p-8 text-center">
            <MapPin className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No locations found</p>
          </div>
        ) : (
          <div className="p-2 space-y-0.5">
            {filtered.map((loc) => {
              const isSelected = selected.includes(loc.id);
              return (
                <div
                  key={loc.id}
                  onClick={() => toggle(loc.id)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors",
                    "cursor-pointer select-none",
                    disabled && "opacity-50 cursor-not-allowed",
                    !disabled && "hover:bg-muted/70",
                    isSelected && "bg-muted/50",
                  )}
                >
                  <div
                    className={cn(
                      "size-4 shrink-0 rounded-[4px] border shadow-xs transition-all duration-200 ease-in-out flex items-center justify-center",
                      isSelected
                        ? "bg-primary border-primary text-primary-foreground"
                        : "bg-input/80 border-input dark:bg-input/30",
                      disabled && "opacity-50",
                    )}
                  >
                    {isSelected && (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 14 14"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        className="size-3.5 block shrink-0 animate-check-in"
                      >
                        <path
                          d="M3 7L6 10L11 3"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                          strokeDasharray="16"
                          strokeDashoffset="0"
                          className="animate-check-draw"
                        />
                      </svg>
                    )}
                  </div>
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-sm flex-1 font-medium">{loc.name}</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono shrink-0"
                  >
                    {loc.code}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
