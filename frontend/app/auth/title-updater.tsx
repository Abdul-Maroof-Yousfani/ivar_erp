"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const PAGE_TITLES: Record<string, string> = {
  "/auth/login":          "Login",
  "/auth/pos-login":      "POS Login",
  "/auth/desktop-login":  "Desktop Login",
  "/auth/choose-account": "Choose Account",
  "/auth/sso":            "Single Sign-On",
  "/auth/pos/user-login": "POS User Login",
};

export function AuthTitleUpdater() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof document === "undefined") return;
    const cleanPath = pathname.split("?")[0].replace(/\/$/, "");
    const page = PAGE_TITLES[cleanPath] ?? "Authentication";
    document.title = `${page} | Speed Limit`;
  }, [pathname]);

  return null;
}
