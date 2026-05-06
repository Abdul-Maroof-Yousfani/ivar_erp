"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

// Hook for automatic token refresh (NextAuth-like approach)
export function useAuth() {
  const router = useRouter();

  // Check and refresh token proactively
  const checkAndRefreshToken = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/check-session");
      const data = await res.json();

      if (!data.valid) {
        // Session invalid, redirect to login
        router.push("/login");
      }
    } catch (error) {
      console.error("Token check failed:", error);
    }
  }, [router]);

  useEffect(() => {
    // Initial check
    checkAndRefreshToken();

    // Set up interval to check every hour (tokens last 7 days)
    // The API route will proactively refresh tokens if they're expiring soon
    const interval = setInterval(checkAndRefreshToken, 60 * 60 * 1000); // 1 hour

    // Check on window focus (user returns to tab)
    const handleFocus = () => {
      checkAndRefreshToken();
    };
    window.addEventListener("focus", handleFocus);

    // Check before page unload (optional, for better UX)
    const handleBeforeUnload = () => {
      // Don't block, just check silently
      checkAndRefreshToken();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [checkAndRefreshToken]);
}
