"use client";

import { useState, useEffect, forwardRef } from "react";
import { Lock, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ManagerVerificationDialog } from "@/components/auth/manager-verification-dialog";
import { cn } from "@/lib/utils";

interface ProtectedSalaryInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  disabled?: boolean;
  className?: string;
}

export const ProtectedSalaryInput = forwardRef<HTMLInputElement, ProtectedSalaryInputProps>(
  ({ value, onChange, disabled, className, ...props }, ref) => {
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [showDialog, setShowDialog] = useState(false);
    const [remainingTime, setRemainingTime] = useState<number | null>(null);
    const unlockDuration = 30; // 30 seconds to edit

    // Auto-lock after duration
    useEffect(() => {
      if (!isUnlocked || remainingTime === null) return;

      if (remainingTime <= 0) {
        setIsUnlocked(false);
        setRemainingTime(null);
        return;
      }

      const timer = setTimeout(() => {
        setRemainingTime(remainingTime - 1);
      }, 1000);

      return () => clearTimeout(timer);
    }, [isUnlocked, remainingTime]);

    const handleVerified = () => {
      setIsUnlocked(true);
      setRemainingTime(unlockDuration);
    };

    const handleUnlockClick = () => {
      setShowDialog(true);
    };

    if (!isUnlocked) {
      return (
        <>
          <div className="relative">
            <Input
              type="text"
              value="••••••"
              disabled
              className={cn("pr-10", className)}
              readOnly
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleUnlockClick}
              disabled={disabled}
              className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
              title="Click to unlock and edit salary"
            >
              <Lock className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>

          <ManagerVerificationDialog
            open={showDialog}
            onOpenChange={setShowDialog}
            onVerified={handleVerified}
            title="Unlock Salary Field"
            description={`Enter your password to unlock and edit salary. You will have ${unlockDuration} seconds to make changes.`}
          />
        </>
      );
    }

    return (
      <div className="relative">
        <Input
          ref={ref}
          type="number"
          value={value}
          onChange={onChange}
          disabled={disabled}
          className={cn("pr-16", className)}
          {...props}
        />
        <div className="absolute right-0 top-0 h-full flex items-center gap-1 px-2">
          <span className="text-xs text-muted-foreground tabular-nums">
            {remainingTime}s
          </span>
          <Eye className="h-4 w-4 text-green-600" />
        </div>
      </div>
    );
  }
);

ProtectedSalaryInput.displayName = "ProtectedSalaryInput";
