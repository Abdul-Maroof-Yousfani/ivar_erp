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

export interface AutocompleteOption {
  value: string
  label: string
  description?: string
}

export interface AutocompleteProps {
  options: AutocompleteOption[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: React.ReactNode
  disabled?: boolean
  className?: string
  isLoading?: boolean
  onCreate?: (value: string) => void
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
  // gap between end of text and start of duplicate (px)
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
        {/* Duplicate for seamless loop — only rendered when animating */}
        {isAnimating && (
          <span style={{ paddingLeft: gap }}>{text}</span>
        )}
      </span>
    </div>
  )
}

export function Autocomplete({
  options,
  value,
  onValueChange,
  placeholder = "Select option...",
  searchPlaceholder = "Search...",
  emptyMessage = "No results found.",
  disabled = false,
  className,
  isLoading = false,
  onCreate,
}: AutocompleteProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const selectedOption = options.find((option) => option.value === value)

  const normalizedSearch = search.trim().toLowerCase()

  const filteredOptions = React.useMemo(
    () =>
      normalizedSearch.length === 0
        ? options
        : options.filter((option) => {
          const haystack = [option.value, option.label, option.description || ""]
            .join(" ")
            .toLowerCase()
          return haystack.includes(normalizedSearch)
        }),
    [options, normalizedSearch]
  )

  React.useEffect(() => {
    if (!open) setSearch("")
  }, [open])

  const handleCreate = () => {
    if (onCreate && search) {
      onCreate(search)
      setOpen(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {/* Wrapper div breaks out of button's overflow-hidden so chevron is never clipped */}
        <div
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          tabIndex={disabled || isLoading ? -1 : 0}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(v => !v) } }}
          className={cn(
            "flex items-center w-full h-9 px-3 rounded-md border border-input bg-background text-sm font-normal cursor-pointer select-none",
            "hover:bg-accent hover:text-accent-foreground transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
            open && "ring-2 ring-ring/20",
            (disabled || isLoading) && "pointer-events-none opacity-50",
            className
          )}
        >
          {/* Label area — takes all available space, chevron stays fixed right */}
          <div className="flex-1 min-w-0 overflow-hidden mr-2">
            {isLoading ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                Loading...
              </span>
            ) : selectedOption ? (
              <MarqueeText text={selectedOption.label} />
            ) : value && options.length === 0 ? (
              <span className="text-muted-foreground">Loading options...</span>
            ) : (
              <span className="text-muted-foreground truncate">{placeholder}</span>
            )}
          </div>

          {/* Chevron — always visible, never clipped */}
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
        <Command className="rounded-lg">
          <CommandInput
            placeholder={searchPlaceholder}
            disabled={isLoading}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList className="max-h-[280px]">
            <div className={cn("max-h-[280px]", options.length <= 5 ? "h-fit" : "h-[280px]")}>
              <ScrollArea showShadows={true} shadowSize="md" className="h-full">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
                  </div>
                ) : (
                  <>
                    <CommandEmpty className="py-2 text-center text-sm text-muted-foreground px-2">
                      {filteredOptions.length === 0 && onCreate && search ? (
                        <Button
                          variant="ghost"
                          className="w-full justify-start h-auto py-2 px-2 text-primary"
                          onClick={handleCreate}
                        >
                          <span className="truncate">Create "{search}"</span>
                        </Button>
                      ) : (
                        emptyMessage
                      )}
                    </CommandEmpty>
                    <CommandGroup className="p-1">
                      {filteredOptions.map((option) => {
                        const isSelected = value === option.value
                        const searchValue = [option.value, option.label, option.description || ""].join(" ")
                        return (
                          <CommandItem
                            key={option.value}
                            value={searchValue}
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
                    </CommandGroup>
                  </>
                )}
              </ScrollArea>
            </div>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
