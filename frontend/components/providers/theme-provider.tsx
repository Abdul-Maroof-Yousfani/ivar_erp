"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import Cookies from "js-cookie";
import { getCookieDomain } from "@/lib/utils";

function ThemeSync() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    // On mount, check cookie
    const savedTheme = Cookies.get("app-theme");
    // If cookie exists and is valid, and differs from what next-themes initialized (from localStorage), sync it.
    // However, next-themes might have already read from localStorage.
    // We want the cookie to be the source of truth for cross-domain.
    if (savedTheme && (savedTheme === "dark" || savedTheme === "light" || savedTheme === "system")) {
      setTheme(savedTheme);
    }
    setMounted(true);
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

