"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { motion, AnimatePresence } from "motion/react"

import { cn } from "@/lib/utils"

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  const [isChecked, setIsChecked] = React.useState(false)
  const checkboxRef = React.useRef<HTMLSpanElement>(null)

  React.useEffect(() => {
    const checkbox = checkboxRef.current
    if (!checkbox) return

    const observer = new MutationObserver(() => {
      setIsChecked(checkbox.dataset.state === "checked")
    })

    observer.observe(checkbox, {
      attributes: true,
      attributeFilter: ["data-state"],
    })

    setIsChecked(checkbox.dataset.state === "checked")

    return () => observer.disconnect()
  }, [])

  return (
    <CheckboxPrimitive.Root asChild {...props}>
      <span
        ref={checkboxRef}
        data-slot="checkbox"
        className={cn(
          "aspect-square flex peer border-input bg-input/80 dark:bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary data-[state=checked]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive size-4 shrink-0 rounded-[4px] border shadow-xs transition-all duration-200 ease-in-out outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      >
        <CheckboxPrimitive.Indicator
          data-slot="checkbox-indicator"
          className="flex items-center justify-center text-current"
          forceMount
        >
          <AnimatePresence mode="wait">
            {isChecked && (
              <motion.svg
                key="checkmark"
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="size-3.5 block shrink-0"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{
                  opacity: { duration: 0.15, ease: "easeInOut" },
                  scale: { duration: 0.15, ease: "easeOut" },
                }}
              >
                <motion.path
                  d="M3 7L6 10L11 3"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  exit={{ pathLength: 0 }}
                  transition={{
                    pathLength: { duration: 0.2, ease: "easeOut" },
                  }}
                />
              </motion.svg>
            )}
          </AnimatePresence>
        </CheckboxPrimitive.Indicator>
      </span>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
