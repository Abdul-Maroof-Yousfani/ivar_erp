"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

// Variants for TabsList
const tabsListVariants = cva(
  "relative inline-flex items-center justify-center text-muted-foreground",
  {
    variants: {
      variant: {
        default: "h-10 rounded-lg bg-muted/50 p-1 border border-border/40",
        pills: "h-10 gap-1 bg-transparent p-0",
        underline: "h-10 gap-4 bg-transparent border-b border-border p-0 rounded-none",
        segment: "h-11 rounded-full bg-muted p-1",
        card: "h-12 rounded-xl bg-gradient-to-b from-muted/80 to-muted p-1.5 shadow-inner",
      },
      color: {
        default: "",
        primary: "",
        success: "",
        warning: "",
        danger: "",
      },
    },
    defaultVariants: {
      variant: "default",
      color: "default",
    },
  }
)

// Variants for indicator
const indicatorVariants = cva(
  "absolute z-0",
  {
    variants: {
      variant: {
        default: "bottom-1 top-1 rounded-md bg-background shadow-sm",
        pills: "inset-0 rounded-lg",
        underline: "bottom-0 h-0.5 rounded-full",
        segment: "top-1 bottom-1 rounded-full shadow-md",
        card: "inset-1 rounded-lg shadow-lg",
      },
      color: {
        default: "bg-background",
        primary: "bg-primary",
        success: "bg-emerald-500",
        warning: "bg-amber-500",
        danger: "bg-red-500",
      },
    },
    compoundVariants: [
      // Underline variant uses color for indicator
      { variant: "underline", color: "default", className: "bg-foreground" },
      { variant: "underline", color: "primary", className: "bg-primary" },
      { variant: "underline", color: "success", className: "bg-emerald-500" },
      { variant: "underline", color: "warning", className: "bg-amber-500" },
      { variant: "underline", color: "danger", className: "bg-red-500" },
      // Pills variant uses color with opacity
      { variant: "pills", color: "default", className: "bg-muted" },
      { variant: "pills", color: "primary", className: "bg-primary/15" },
      { variant: "pills", color: "success", className: "bg-emerald-500/15" },
      { variant: "pills", color: "warning", className: "bg-amber-500/15" },
      { variant: "pills", color: "danger", className: "bg-red-500/15" },
    ],
    defaultVariants: {
      variant: "default",
      color: "default",
    },
  }
)

// Variants for triggers
const tabsTriggerVariants = cva(
  "relative z-10 inline-flex items-center justify-center gap-2 font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "h-full flex-1 rounded-md px-3 py-1.5 text-sm",
        pills: "h-full rounded-lg px-4 py-2 text-sm",
        underline: "h-full px-1 pb-3 text-sm border-b-2 border-transparent rounded-none",
        segment: "h-full flex-1 rounded-full px-4 text-sm",
        card: "h-full flex-1 rounded-lg px-4 text-sm",
      },
      color: {
        default: "text-muted-foreground hover:text-foreground data-[state=active]:text-foreground",
        primary: "text-muted-foreground hover:text-primary data-[state=active]:text-primary",
        success: "text-muted-foreground hover:text-emerald-600 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400",
        warning: "text-muted-foreground hover:text-amber-600 data-[state=active]:text-amber-600 dark:data-[state=active]:text-amber-400",
        danger: "text-muted-foreground hover:text-red-600 data-[state=active]:text-red-600 dark:data-[state=active]:text-red-400",
      },
    },
    compoundVariants: [
      // Active text colors for pills variant with colors
      { variant: "pills", color: "primary", className: "data-[state=active]:text-primary" },
      { variant: "pills", color: "success", className: "data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-300" },
      { variant: "pills", color: "warning", className: "data-[state=active]:text-amber-700 dark:data-[state=active]:text-amber-300" },
      { variant: "pills", color: "danger", className: "data-[state=active]:text-red-700 dark:data-[state=active]:text-red-300" },
      // Underline variant with colors - uses white text when colored
      { variant: "underline", color: "primary", className: "data-[state=active]:text-primary" },
      // Segment/card variants with colors - white text on colored bg
      { variant: "segment", color: "primary", className: "data-[state=active]:text-primary-foreground" },
      { variant: "segment", color: "success", className: "data-[state=active]:text-white" },
      { variant: "segment", color: "warning", className: "data-[state=active]:text-white" },
      { variant: "segment", color: "danger", className: "data-[state=active]:text-white" },
      { variant: "card", color: "primary", className: "data-[state=active]:text-primary-foreground" },
      { variant: "card", color: "success", className: "data-[state=active]:text-white" },
      { variant: "card", color: "warning", className: "data-[state=active]:text-white" },
      { variant: "card", color: "danger", className: "data-[state=active]:text-white" },
    ],
    defaultVariants: {
      variant: "default",
      color: "default",
    },
  }
)

type TabsVariant = "default" | "pills" | "underline" | "segment" | "card"
type TabsColor = "default" | "primary" | "success" | "warning" | "danger"

// Context to share active value and variants for indicator positioning
const TabsContext = React.createContext<{
  activeValue: string | undefined
  variant: TabsVariant
  color: TabsColor
}>({
  activeValue: undefined,
  variant: "default",
  color: "default",
})

interface TabsProps extends React.ComponentProps<typeof TabsPrimitive.Root> {
  variant?: TabsVariant
  color?: TabsColor
}

function Tabs({
  className,
  value,
  defaultValue,
  variant = "default",
  color = "default",
  ...props
}: TabsProps) {
  const [activeValue, setActiveValue] = React.useState<string | undefined>((value || defaultValue) as string | undefined)

  React.useEffect(() => {
    if (value !== undefined) {
      setActiveValue(value as string)
    }
  }, [value])

  return (
    <TabsContext.Provider value={{ activeValue, variant, color }}>
      <TabsPrimitive.Root
        data-slot="tabs"
        value={value}
        defaultValue={defaultValue}
        onValueChange={(val) => {
          setActiveValue(val)
          props.onValueChange?.(val)
        }}
        className={cn("flex flex-col gap-3", className)}
        {...props}
      />
    </TabsContext.Provider>
  )
}

interface TabsListProps extends React.ComponentProps<typeof TabsPrimitive.List>, VariantProps<typeof tabsListVariants> { }

function TabsList({
  className,
  children,
  variant: variantProp,
  color: colorProp,
  ...props
}: TabsListProps) {
  const listRef = React.useRef<HTMLDivElement>(null)
  const [indicatorStyle, setIndicatorStyle] = React.useState<{ left: number; width: number } | null>(null)
  const { activeValue, variant: contextVariant, color: contextColor } = React.useContext(TabsContext)

  const variant = variantProp ?? contextVariant
  const color = colorProp ?? contextColor

  // Update indicator position when active value changes
  const updateIndicator = React.useCallback(() => {
    if (!listRef.current || !activeValue) {
      setIndicatorStyle(null)
      return
    }

    // Use requestAnimationFrame to ensure DOM is updated
    requestAnimationFrame(() => {
      if (!listRef.current) return

      const activeTrigger = listRef.current.querySelector(
        `[data-state="active"][data-slot="tabs-trigger"]`
      ) as HTMLElement

      if (activeTrigger) {
        const listRect = listRef.current.getBoundingClientRect()
        const triggerRect = activeTrigger.getBoundingClientRect()

        const left = triggerRect.left - listRect.left
        const width = triggerRect.width

        setIndicatorStyle({ left, width })
      } else {
        setIndicatorStyle(null)
      }
    })
  }, [activeValue])

  // Update on active value change
  React.useEffect(() => {
    updateIndicator()
  }, [updateIndicator])

  // Update on window resize
  React.useEffect(() => {
    const handleResize = () => {
      updateIndicator()
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [updateIndicator])

  // Initial position
  React.useEffect(() => {
    // Small delay to ensure DOM is ready
    const timer = setTimeout(updateIndicator, 0)
    return () => clearTimeout(timer)
  }, [updateIndicator])

  return (
    <TabsPrimitive.List
      ref={listRef}
      data-slot="tabs-list"
      className={cn(tabsListVariants({ variant, color }), className)}
      {...props}
    >
      {/* Animated sliding indicator with masking effect */}
      {indicatorStyle && (
        <div
          className={cn(
            indicatorVariants({ variant, color }),
            // Masking/glow effect for colored variants
            color !== "default" && variant !== "underline" && "after:absolute after:inset-0 after:rounded-[inherit] after:bg-gradient-to-t after:from-black/10 after:to-white/20 after:opacity-50",
            // Soft glow effect
            color !== "default" && variant !== "default" && variant !== "underline" && "shadow-[0_0_15px_rgba(var(--indicator-glow),0.3)]"
          )}
          style={{
            left: `${indicatorStyle.left}px`,
            width: `${indicatorStyle.width}px`,
            transition: 'left 400ms cubic-bezier(0.34, 1.56, 0.64, 1), width 400ms cubic-bezier(0.34, 1.56, 0.64, 1), background-color 300ms ease',
            willChange: 'left, width',
            // CSS variable for glow color
            '--indicator-glow': color === 'primary' ? '59, 130, 246' : color === 'success' ? '16, 185, 129' : color === 'warning' ? '245, 158, 11' : color === 'danger' ? '239, 68, 68' : '0, 0, 0',
          } as React.CSSProperties}
        />
      )}
      {children}
    </TabsPrimitive.List>
  )
}

interface TabsTriggerProps extends React.ComponentProps<typeof TabsPrimitive.Trigger>, VariantProps<typeof tabsTriggerVariants> { }

function TabsTrigger({
  className,
  style,
  variant: variantProp,
  color: colorProp,
  ...props
}: TabsTriggerProps) {
  const { variant: contextVariant, color: contextColor } = React.useContext(TabsContext)

  const variant = variantProp ?? contextVariant
  const color = colorProp ?? contextColor

  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        tabsTriggerVariants({ variant, color }),
        "data-[state=active]:font-semibold",
        className
      )}
      style={{
        transition: 'color 250ms cubic-bezier(0.4, 0, 0.2, 1), transform 150ms ease',
        ...style,
      }}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn(
        "mt-2 flex-1 outline-none",
        "data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:zoom-in-95",
        "data-[state=active]:slide-in-from-bottom-2",
        "duration-200 ease-out",
        className
      )}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
export type { TabsVariant, TabsColor }
