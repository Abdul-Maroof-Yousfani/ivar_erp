"use client"

import * as React from "react"
import { CheckIcon, ChevronDownIcon, Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "./scroll-area"
import { useDebounce } from "@/hooks/use-debounce"

export interface InfiniteAutocompleteOption {
  value: string
  label: string
  description?: string
}

export interface InfiniteAutocompleteProps {
  fetchData: (params: { page: number; limit: number; search: string }) => Promise<{ 
    status: boolean; 
    data?: any[]; 
    meta?: { totalPages: number };
    message?: string;
  }>
  mapOption: (item: any) => InfiniteAutocompleteOption
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: React.ReactNode
  disabled?: boolean
  className?: string
  selectedLabel?: string // Optional initial label if item not in first page
}

// Marquee text — infinite loop on hover, only when content overflows
function MarqueeText({ text, className }: { text: string; className?: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const textRef = React.useRef<HTMLSpanElement>(null)
  const [overflow, setOverflow] = React.useState(0)
  const [hovered, setHovered] = React.useState(false)

  React.useEffect(() => {
    const container = containerRef.current
    const textEl = textRef.current
    if (!container || !textEl) return
    const diff = textEl.scrollWidth - container.clientWidth
    setOverflow(diff > 0 ? diff : 0)
  }, [text])

  const isAnimating = hovered && overflow > 0
  const gap = 48
  const totalShift = overflow + gap

  return (
    <div
      ref={containerRef}
      className={cn("overflow-hidden min-w-0 flex-1", className)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        ref={textRef}
        style={isAnimating ? ({
          '--marquee-shift': `-${totalShift}px`,
          '--marquee-duration': `${Math.max(2, totalShift / 60)}s`,
        } as React.CSSProperties) : undefined}
        className={cn(
          "inline-block whitespace-nowrap",
          isAnimating && "animate-marquee-loop"
        )}
      >
        {text}
        {isAnimating && (
          <span style={{ paddingLeft: gap }}>{text}</span>
        )}
      </span>
    </div>
  )
}

export function InfiniteAutocomplete({
  fetchData,
  mapOption,
  value,
  onValueChange,
  placeholder = "Select option...",
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  disabled = false,
  className,
  selectedLabel: initialLabel,
}: InfiniteAutocompleteProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const debouncedSearch = useDebounce(search, 400)
  
  const [items, setItems] = React.useState<InfiniteAutocompleteOption[]>([])
  const [page, setPage] = React.useState(1)
  const [hasMore, setHasMore] = React.useState(true)
  const [isLoading, setIsLoading] = React.useState(false)
  const [isFetchingMore, setIsFetchingMore] = React.useState(false)

  const loadMoreRef = React.useRef<HTMLDivElement>(null)

  // Initial load or search change
  React.useEffect(() => {
    if (!open) return

    const loadInitial = async () => {
      setIsLoading(true)
      try {
        const result = await fetchData({ page: 1, limit: 50, search: debouncedSearch })
        if (result.status && result.data) {
          setItems(result.data.map(mapOption))
          setPage(1)
          setHasMore((result.meta?.totalPages ?? 1) > 1)
        }
      } catch (error) {
        console.error("Failed to fetch infinite autocomplete items:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadInitial()
  }, [open, debouncedSearch, fetchData, mapOption])

  // Load more when scrolling
  React.useEffect(() => {
    if (!open || !hasMore || isLoading || isFetchingMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          const loadMore = async () => {
            setIsFetchingMore(true)
            try {
              const nextPage = page + 1
              const result = await fetchData({ page: nextPage, limit: 50, search: debouncedSearch })
              if (result.status && result.data) {
                const newOptions = result.data.map(mapOption)
                setItems(prev => {
                  const existingValues = new Set(prev.map(i => i.value))
                  const uniqueNew = newOptions.filter(i => !existingValues.has(i.value))
                  return [...prev, ...uniqueNew]
                })
                setPage(nextPage)
                setHasMore(nextPage < (result.meta?.totalPages ?? 1))
              }
            } catch (error) {
              console.error("Failed to fetch more items:", error)
            } finally {
              setIsFetchingMore(false)
            }
          }
          loadMore()
        }
      },
      { threshold: 0, rootMargin: "100px" }
    )

    const currentRef = loadMoreRef.current
    if (currentRef) {
      observer.observe(currentRef)
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef)
      }
    }
  }, [open, hasMore, isLoading, isFetchingMore, page, debouncedSearch, fetchData, mapOption])

  const selectedOption = items.find((option) => option.value === value)
  const displayLabel = selectedOption?.label || initialLabel || value || placeholder

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          tabIndex={disabled ? -1 : 0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(v => !v) } }}
          className={cn(
            "flex items-center w-full h-9 px-3 rounded-md border border-input bg-background text-sm font-normal cursor-pointer select-none",
            "hover:bg-accent hover:text-accent-foreground transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            open && "ring-2 ring-ring/20",
            disabled && "pointer-events-none opacity-50",
            className
          )}
        >
          <div className="flex-1 min-w-0 overflow-hidden mr-2">
            {displayLabel === placeholder ? (
               <span className="text-muted-foreground truncate">{placeholder}</span>
            ) : (
              <MarqueeText text={displayLabel} />
            )}
          </div>

          <ChevronDownIcon
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
              open && "rotate-180"
            )}
          />
        </div>
      </PopoverTrigger>

      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        sideOffset={4}
      >
        <Command className="rounded-lg" shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-[300px]">
             {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
                </div>
              ) : items.length === 0 ? (
                <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                  {emptyMessage}
                </CommandEmpty>
              ) : (
                <CommandGroup className="p-1">
                  {items.map((option) => {
                    const isSelected = value === option.value
                    return (
                      <CommandItem
                        key={option.value}
                        value={option.value}
                        onSelect={() => {
                          onValueChange?.(isSelected ? "" : option.value)
                          setOpen(false)
                        }}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2.5 rounded-md cursor-pointer overflow-hidden",
                          isSelected && "bg-accent"
                        )}
                      >
                        <div className="flex flex-col gap-0.5 flex-1 w-0 min-w-0">
                          <MarqueeText
                            text={option.label}
                            className={cn(isSelected && "font-medium")}
                          />
                          {option.description && (
                            <MarqueeText
                              text={option.description}
                              className="text-xs text-muted-foreground"
                            />
                          )}
                        </div>
                        {isSelected && <CheckIcon className="h-4 w-4 shrink-0 text-primary" />}
                      </CommandItem>
                    )
                  })}
                  
                  {hasMore && (
                    <div ref={loadMoreRef} className="flex justify-center p-4">
                      {isFetchingMore ? (
                         <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      ) : (
                        <span className="text-xs text-muted-foreground">Scroll for more</span>
                      )}
                    </div>
                  )}
                </CommandGroup>
              )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
