"use client";

import * as React from "react";
import { X, ChevronDown, Check, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface MultiSelectOption {
  value: string;
  label: string;
  description?: string;
}

export interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  maxDisplayedItems?: number;
  disabled?: boolean;
  className?: string;
  showSelectAll?: boolean;
  icon?: React.ReactNode;
  /** Optional server-side search callback */
  onSearch?: (search: string) => void;
  /** Optional callback for infinite scrolling */
  onLoadMore?: () => void;
  /** Whether there are more items to load (for infinite scroll) */
  hasMore?: boolean;
  /** Loading state (for initial or load more) */
  isLoading?: boolean;
}

export function MultiSelect({
  options,
  value,
  onValueChange,
  placeholder = "Select items...",
  searchPlaceholder = "Search...",
  emptyMessage = "No items found",
  maxDisplayedItems = 3,
  disabled = false,
  className,
  showSelectAll = true,
  icon,
  onSearch,
  onLoadMore,
  hasMore,
  isLoading,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const loadMoreRef = React.useRef<HTMLDivElement>(null);

  const filteredOptions = React.useMemo(() => {
    // If server-side search is provided, we don't filter locally
    if (onSearch || !search) return options;
    const searchLower = search.toLowerCase();
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(searchLower) ||
        option.description?.toLowerCase().includes(searchLower)
    );
  }, [options, search, onSearch]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    onSearch?.(val);
  };

  const toggleOption = (optionValue: string) => {
    const newValue = value.includes(optionValue)
      ? value.filter((v) => v !== optionValue)
      : [...value, optionValue];
    onValueChange(newValue);
  };

  const selectAll = () => {
    onValueChange(filteredOptions.map((option) => option.value));
  };

  const clearAll = () => {
    onValueChange([]);
  };

  const removeItem = (optionValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onValueChange(value.filter((v) => v !== optionValue));
  };

  // Intersection Observer for Infinite Scroll
  React.useEffect(() => {
    if (!open || !hasMore || !onLoadMore || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [open, hasMore, onLoadMore, isLoading]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between h-auto min-h-9 font-normal",
            className
          )}
        >
          <div className="flex flex-wrap gap-1 flex-1 text-left">
            {value.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : value.length <= maxDisplayedItems ? (
              value.map((v) => {
                const option = options.find((o) => o.value === v);
                return (
                  <Badge key={v} variant="secondary" className="text-xs">
                    {option?.label || v}
                    <X
                      className="ml-1 h-3 w-3 cursor-pointer hover:text-destructive"
                      onClick={(e) => removeItem(v, e)}
                    />
                  </Badge>
                );
              })
            ) : (
              <Badge variant="secondary" className="text-xs">
                {icon || <Users className="h-3 w-3 mr-1" />}
                {value.length} selected
              </Badge>
            )}
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50 transition-transform duration-200" style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <div className="p-3 border-b">
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={handleSearchChange}
            className="w-full px-3 py-2 text-sm border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {showSelectAll && !onSearch && (
          <div className="flex items-center justify-between p-2 border-b bg-muted/50">
            <span className="text-xs text-muted-foreground">
              {filteredOptions.length} items
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={selectAll}
              >
                Select All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={clearAll}
              >
                Clear
              </Button>
            </div>
          </div>
        )}
        <ScrollArea className="h-[250px]">
          <div className="p-2 space-y-1">
            {filteredOptions.map((option) => (
              <div
                key={option.value}
                className={cn(
                  "flex items-center space-x-2 p-2 rounded-md cursor-pointer hover:bg-accent transition-colors",
                  value.includes(option.value) && "bg-accent"
                )}
                onClick={() => toggleOption(option.value)}
              >
                <Checkbox
                  checked={value.includes(option.value)}
                  onCheckedChange={() => toggleOption(option.value)}
                  className="pointer-events-none"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{option.label}</p>
                  {option.description && (
                    <p className="text-xs text-muted-foreground truncate">
                      {option.description}
                    </p>
                  )}
                </div>
                {value.includes(option.value) && (
                  <Check className="h-4 w-4 text-primary shrink-0" />
                )}
              </div>
            ))}

            {hasMore && (
              <div ref={loadMoreRef} className="flex justify-center p-3">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                ) : (
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Load More</span>
                )}
              </div>
            )}

            {filteredOptions.length === 0 && !isLoading && (
              <p className="text-sm text-muted-foreground text-center py-4">
                {emptyMessage}
              </p>
            )}

            {isLoading && filteredOptions.length === 0 && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
