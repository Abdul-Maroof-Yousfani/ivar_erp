"use client";

import { useEffect, useState, useCallback } from "react";
import { Minus, Square, X, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";

function getBridge() {
  if (typeof window !== "undefined" && (window as any).posDesktop) {
    return (window as any).posDesktop;
  }
  return null;
}

export function DesktopTitlebar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const bridge = getBridge();

  useEffect(() => {
    if (!bridge) return;
    bridge.isMaximized().then(setIsMaximized);
    const unsub = bridge.onMaximizedChanged(setIsMaximized);
    return unsub;
  }, []);

  if (!bridge) return null;

  return (
    <div
      className="flex items-center justify-between h-9 bg-background/95 border-b border-border/50 select-none shrink-0 z-[9999]"
      style={{ WebkitAppRegion: "drag" } as any}
    >
      {/* Left — app identity */}
      <div className="flex items-center gap-2 px-3">
        <Image src="/logo.png" alt="POS" width={14} height={14} className="object-contain opacity-80" />
        <span className="text-[11px] font-semibold text-muted-foreground tracking-wide">
          Speed Pvt. Limited - POS
        </span>
      </div>

      {/* Window controls — no-drag zone */}
      <div
        className="flex items-center h-full"
        style={{ WebkitAppRegion: "no-drag" } as any}
      >
        <TitlebarBtn
          onClick={() => bridge.minimizeWindow()}
          label="Minimize"
          className="hover:bg-muted"
        >
          <Minus className="h-3 w-3" />
        </TitlebarBtn>

        <TitlebarBtn
          onClick={() => bridge.maximizeWindow()}
          label={isMaximized ? "Restore" : "Maximize"}
          className="hover:bg-muted"
        >
          {isMaximized
            ? <Maximize2 className="h-3 w-3" />
            : <Square className="h-3 w-3" />}
        </TitlebarBtn>

        <TitlebarBtn
          onClick={() => bridge.closeWindow()}
          label="Close"
          className="hover:bg-destructive hover:text-destructive-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </TitlebarBtn>
      </div>
    </div>
  );
}

function TitlebarBtn({
  children, onClick, label, className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex items-center justify-center w-11 h-full text-muted-foreground transition-colors duration-100",
        className,
      )}
    >
      {children}
    </button>
  );
}
