"use client"

import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"

import { cn } from "@/lib/utils"

interface ScrollAreaProps extends React.ComponentProps<typeof ScrollAreaPrimitive.Root> {
  showShadows?: boolean
  shadowSize?: "sm" | "md" | "lg"
}

function ScrollArea({
  className,
  children,
  showShadows = false,
  shadowSize = "md",
  ...props
}: ScrollAreaProps) {
  const [showTopShadow, setShowTopShadow] = React.useState(false)
  const [showBottomShadow, setShowBottomShadow] = React.useState(false)
  const viewportRef = React.useRef<HTMLDivElement>(null)

  const shadowSizes = {
    sm: "h-4",
    md: "h-8",
    lg: "h-12",
  }

  React.useEffect(() => {
    if (!showShadows) return

    const viewport = viewportRef.current
    if (!viewport) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = viewport
      setShowTopShadow(scrollTop > 0)
      setShowBottomShadow(scrollTop + clientHeight < scrollHeight - 1)
    }

    // Initial check
    handleScroll()

    viewport.addEventListener("scroll", handleScroll)
    // Also observe resize
    const resizeObserver = new ResizeObserver(handleScroll)
    resizeObserver.observe(viewport)

    return () => {
      viewport.removeEventListener("scroll", handleScroll)
      resizeObserver.disconnect()
    }
  }, [showShadows])

  return (
    <ScrollAreaPrimitive.Root
      data-slot="scroll-area"
      className={cn("relative overflow-hidden", className)}
      {...props}
    >
      {/* Top shadow */}
      {showShadows && (
        <div
          className={cn(
            "absolute top-0 left-0 right-0 z-10 pointer-events-none transition-opacity duration-200",
            shadowSizes[shadowSize],
            "bg-gradient-to-b from-background via-background/80 to-transparent",
            showTopShadow ? "opacity-100" : "opacity-0"
          )}
        />
      )}

      <ScrollAreaPrimitive.Viewport
        ref={viewportRef}
        data-slot="scroll-area-viewport"
        className="size-full rounded-[inherit] outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-1"
      >
        {children}
      </ScrollAreaPrimitive.Viewport>

      {/* Bottom shadow */}
      {showShadows && (
        <div
          className={cn(
            "absolute bottom-0 left-0 right-0 z-10 pointer-events-none transition-opacity duration-200",
            shadowSizes[shadowSize],
            "bg-gradient-to-t from-background via-background/80 to-transparent",
            showBottomShadow ? "opacity-100" : "opacity-0"
          )}
        />
      )}

      <ScrollBar />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        "flex touch-none select-none transition-all duration-150",
        orientation === "vertical" &&
          "h-full w-2 border-l border-l-transparent p-[1px] hover:w-2.5 hover:bg-muted/30",
        orientation === "horizontal" &&
          "h-2 flex-col border-t border-t-transparent p-[1px] hover:h-2.5 hover:bg-muted/30",
        className
      )}
      {...props}
    >
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className={cn(
          "relative flex-1 rounded-full transition-colors",
          "bg-border/60 hover:bg-border active:bg-border"
        )}
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  )
}

export { ScrollArea, ScrollBar }
