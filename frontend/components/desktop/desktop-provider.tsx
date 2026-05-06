"use client";

import { useEffect, useState } from "react";
import { DesktopTitlebar } from "./titlebar";
import { DesktopContextMenuHandler } from "./context-menu-handler";

// Titlebar height must match the h-9 (2.25rem / 36px) in titlebar.tsx
const TITLEBAR_HEIGHT = "2.25rem";

export function DesktopProvider({ children }: { children: React.ReactNode }) {
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const desktop = typeof window !== "undefined" && !!(window as any).posDesktop;
    setIsDesktop(desktop);

    if (desktop) {
      // Expose titlebar height as a CSS variable so the rest of the app
      // (sidebar, sticky header, sheets) can offset themselves correctly.
      document.documentElement.style.setProperty("--titlebar-height", TITLEBAR_HEIGHT);
    } else {
      document.documentElement.style.setProperty("--titlebar-height", "0px");
    }
  }, []);

  if (!isDesktop) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <DesktopTitlebar />
      {/* Scrollable content area sits below the fixed titlebar */}
      <div className="flex-1 overflow-auto min-h-0">
        {children}
      </div>
      <DesktopContextMenuHandler />
    </div>
  );
}
