"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { getApiBaseUrl } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const CHECK_INTERVAL = 30 * 60 * 1000; // Check every 5 minutes (proactive refresh handles token expiration)

export function SessionChecker() {
  const router = useRouter();
  const pathname = usePathname();
  const { sessionExpired, setSessionExpired, handleSessionExpiry } = useAuth();
  const [isNavigating, setIsNavigating] = useState(false);

  const performCheck = useCallback(async () => {
    try {
      const res = await fetch(`${getApiBaseUrl()}/auth/check-session`, {
        credentials: "include", // ensure cookies (accessToken) are sent to Nest backend
        cache: "no-store",
      });

      if (res.status === 401 || res.status === 403) {
        await handleSessionExpiry();
        return;
      }

      if (!res.ok) {
        console.error("Session check HTTP error:", res.status);
        return;
      }

      const data = await res.json();

      if (data && (data.resetCookies || data.valid === false)) {
        await handleSessionExpiry();
      }
    } catch (error) {
      console.error("Session check failed:", error);
    }
  }, [handleSessionExpiry]);

  useEffect(() => {
    // Initial check
    performCheck();

    // Set up interval
    const interval = setInterval(performCheck, CHECK_INTERVAL);

    return () => {
      clearInterval(interval);
    };
  }, [performCheck]);

  const handleLogin = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    setIsNavigating(true);
    // Ensure cookies are cleared one last time before navigation
    try {
        await handleSessionExpiry();
    } catch {}
    const callbackUrl = encodeURIComponent(pathname || "/hr");
    window.location.href = `/auth/login?callbackUrl=${callbackUrl}`;
  };

  return (
    <AlertDialog open={sessionExpired}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Session Expired</AlertDialogTitle>
          <AlertDialogDescription>
            Your session has expired. Please log in again to continue.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={handleLogin} disabled={isNavigating}>
            {isNavigating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Navigating...
              </>
            ) : (
              "Go to Login"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

