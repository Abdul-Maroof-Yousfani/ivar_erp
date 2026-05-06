"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { motion, AnimatePresence } from "motion/react"

import { cn } from "@/lib/utils"

function Checkbox({
  className,
  checked,
  defaultChecked,
  onCheckedChange,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  const isControlled = checked !== undefined
  const [internalChecked, setInternalChecked] = React.useState(
    defaultChecked === true
  )
  const isChecked = isControlled ? checked === true : internalChecked

  return (
    <CheckboxPrimitive.Root
      checked={isChecked}
      onCheckedChange={(val) => {
        if (!isControlled) setInternalChecked(val === true)
        onCheckedChange?.(val)
      }}
      {...props}
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
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
