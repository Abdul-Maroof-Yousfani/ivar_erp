"use client";

/**
 * DesktopContextMenu — intercepts right-click events in the Electron renderer
 * and shows a styled context menu instead of the browser default.
 *
 * Uses the native Electron context menu (via IPC) for clipboard actions,
 * and a React popover for any custom items injected via data attributes.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Copy, Clipboard, Scissors, MousePointer2, RefreshCw,
  Code2, ChevronRight,
} from "lucide-react";

interface MenuItem {
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
  separator?: boolean;
  danger?: boolean;
}

interface MenuState {
  x: number;
  y: number;
  items: MenuItem[];
}

function getBridge() {
  if (typeof window !== "undefined" && (window as any).posDesktop) {
    return (window as any).posDesktop;
  }
  return null;
}

function getClipboardText(): string {
  try { return (navigator as any).clipboard ? '' : ''; } catch { return ''; }
}

export function DesktopContextMenuHandler() {
  const bridge = getBridge();
  const [menu, setMenu] = useState<MenuState | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setMenu(null), []);

  useEffect(() => {
    if (!bridge) return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const target = e.target as HTMLElement;
      const isEditable = (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable
      );
      const selection = window.getSelection();
      const selectionText = selection?.toString() ?? '';
      const hasSelection = selectionText.length > 0;

      // Build menu items
      const items: MenuItem[] = [];

      if (isEditable) {
        items.push({
          label: 'Cut',
          icon: <Scissors className="h-3.5 w-3.5" />,
          shortcut: 'Ctrl+X',
          disabled: !hasSelection,
          onClick: () => document.execCommand('cut'),
        });
        items.push({
          label: 'Copy',
          icon: <Copy className="h-3.5 w-3.5" />,
          shortcut: 'Ctrl+C',
          disabled: !hasSelection,
          onClick: () => document.execCommand('copy'),
        });
        items.push({
          label: 'Paste',
          icon: <Clipboard className="h-3.5 w-3.5" />,
          shortcut: 'Ctrl+V',
          onClick: () => document.execCommand('paste'),
        });
        items.push({
          label: 'Select All',
          icon: <MousePointer2 className="h-3.5 w-3.5" />,
          shortcut: 'Ctrl+A',
          onClick: () => document.execCommand('selectAll'),
        });
      } else if (hasSelection) {
        items.push({
          label: 'Copy',
          icon: <Copy className="h-3.5 w-3.5" />,
          shortcut: 'Ctrl+C',
          onClick: () => document.execCommand('copy'),
        });
      }

      // Dev tools in development
      if (process.env.NODE_ENV === 'development') {
        if (items.length > 0) items.push({ label: '', separator: true });
        items.push({
          label: 'Reload',
          icon: <RefreshCw className="h-3.5 w-3.5" />,
          shortcut: 'Ctrl+R',
          onClick: () => window.location.reload(),
        });
        items.push({
          label: 'Inspect',
          icon: <Code2 className="h-3.5 w-3.5" />,
          shortcut: 'F12',
          onClick: () => bridge.showContextMenu({ x: e.clientX, y: e.clientY, hasSelection, isEditable, selectionText }),
        });
      }

      if (items.length === 0) return;

      // Clamp to viewport
      const menuW = 200;
      const menuH = items.length * 32 + 16;
      const x = Math.min(e.clientX, window.innerWidth - menuW - 8);
      const y = Math.min(e.clientY, window.innerHeight - menuH - 8);

      setMenu({ x, y, items });
    };

    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, [bridge]);

  // Close on click outside or Escape
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [menu, close]);

  if (!bridge || !menu) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-[99999] min-w-[180px] py-1 rounded-lg border border-border bg-popover shadow-xl animate-in fade-in-0 zoom-in-95 duration-100"
      style={{ left: menu.x, top: menu.y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {menu.items.map((item, i) => {
        if (item.separator) {
          return <div key={i} className="my-1 h-px bg-border mx-2" />;
        }
        return (
          <button
            key={i}
            disabled={item.disabled}
            onClick={() => { item.onClick?.(); close(); }}
            className={cn(
              "flex items-center gap-2.5 w-full px-3 py-1.5 text-sm text-left transition-colors",
              "hover:bg-accent hover:text-accent-foreground",
              item.disabled && "opacity-40 cursor-not-allowed pointer-events-none",
              item.danger && "text-destructive hover:bg-destructive/10",
            )}
          >
            {item.icon && (
              <span className="text-muted-foreground shrink-0">{item.icon}</span>
            )}
            <span className="flex-1">{item.label}</span>
            {item.shortcut && (
              <span className="text-[10px] text-muted-foreground font-mono ml-4 shrink-0">
                {item.shortcut}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
