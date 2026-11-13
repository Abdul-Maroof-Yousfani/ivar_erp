"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import Cookies from "js-cookie";
import { getCookieDomain } from "@/lib/utils";

// Suppress React 19 false-positive warning for next-themes script tag in development
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    if (
      typeof args[0] === "string" &&
      args[0].includes("Encountered a script tag while rendering React component")
    ) {
      return;
    }
    originalError.apply(console, args);
  };
}

function ThemeSync() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    let ignore = false;
    queueMicrotask(() => {
      if (ignore) return;
      // On mount, check cookie
      const savedTheme = Cookies.get("app-theme");
      if (savedTheme && (savedTheme === "dark" || savedTheme === "light" || savedTheme === "system")) {
        setTheme(savedTheme);
      }
      setMounted(true);
    });
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!mounted || !theme) return;

    // When theme changes, update cookie
    const host = typeof window !== 'undefined' ? window.location.host : '';
    const domain = getCookieDomain(host);

    const cookieOptions: Cookies.CookieAttributes = {
      expires: 365,
      domain: domain,
      path: '/',
      sameSite: 'lax'
    };

    Cookies.set("app-theme", theme, cookieOptions);
  }, [theme, mounted]);

  return null;
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider {...props}>
      <ThemeSync />
      {children}
    </NextThemesProvider>
  );
}

