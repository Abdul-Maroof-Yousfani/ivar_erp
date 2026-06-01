"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ManagerVerificationDialog } from "@/components/auth/manager-verification-dialog";
import { cn } from "@/lib/utils";

interface ProtectedSalaryCellProps {
  salary: number;
  currency?: string;
  locale?: string;
  visibilityDuration?: number; // in seconds
  className?: string;
}

export function ProtectedSalaryCell({
  salary,
  currency = "PKR",
  locale = "en-PK",
  visibilityDuration = 10,
  className,
}: ProtectedSalaryCellProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [remainingTime, setRemainingTime] = useState<number | null>(null);

  // Auto-hide after duration
  useEffect(() => {
    if (!isVisible || remainingTime === null) return;

    if (remainingTime <= 0) {
      setIsVisible(false);
      setRemainingTime(null);
      return;
    }

    const timer = setTimeout(() => {
      setRemainingTime(remainingTime - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [isVisible, remainingTime]);

  const handleVerified = () => {
    setIsVisible(true);
    setRemainingTime(visibilityDuration);
  };

  const handleClick = () => {
    if (isVisible) {
      // If already visible, hide it
      setIsVisible(false);
      setRemainingTime(null);
    } else {
      // Show verification dialog
      setShowDialog(true);
    }
  };

  const formattedSalary = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency,
  }).format(salary);

  return (
    <>
      <div className={cn("flex items-center gap-2", className)}>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClick}
          className="h-auto p-1 hover:bg-muted"
          title={isVisible ? "Hide salary" : "Click to view salary"}
        >
          {isVisible ? (
            <div className="flex items-center gap-2">
              <span className="font-medium">{formattedSalary}</span>
              <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-medium text-muted-foreground">••••••</span>
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          )}
        </Button>
        {isVisible && remainingTime !== null && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {remainingTime}s
          </span>
        )}
      </div>

      <ManagerVerificationDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        onVerified={handleVerified}
        title="Salary Verification Required"
        description={`Enter your password to view salary information. It will be visible for ${visibilityDuration} seconds.`}
      />
    </>
  );
}
