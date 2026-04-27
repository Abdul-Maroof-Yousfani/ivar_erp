"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/components/providers/auth-provider";
import { Bell } from "lucide-react";
import { useRouter } from "next/navigation";
import { useSocket } from "@/components/providers/socket-provider";
import { authFetch } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/utils";

type NotificationStatus = "unread" | "read";

type NotificationItem = {
  id: string;
  userId: string;
  title: string;
  message: string;
  category: string;
  priority: string;
  status: NotificationStatus;
  actionType?: string | null;
  actionPayload?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  createdAt: string;
};

export function HeaderNotifications() {
  const { user, isAuthenticated } = useAuth();
  const { socket, isConnected } = useSocket();
  const router = useRouter();

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const playNotificationSound = useCallback(() => {
    try {
      const AudioContextCtor = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextCtor) return;
      const ctx = new AudioContextCtor();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);

      gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      console.warn('AudioContext failed to play:', e);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await authFetch(`${getApiBaseUrl()}/notifications?limit=10`, {
        method: "GET",
        cache: "no-store",
      });

      if (!res.ok) return;
      const json = res.data as {
        status: boolean;
        data?: { items: NotificationItem[]; unreadCount: number };
      };
      if (!json?.status || !json.data) return;
      setItems(json.data.items || []);
      setUnreadCount(json.data.unreadCount || 0);
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setItems([]);
      setUnreadCount(0);
      return;
    }

    refresh();
  }, [isAuthenticated, refresh]);

  useEffect(() => {
    if (!socket || !isAuthenticated) return;

    const handleNotification = (payload: any) => {
      console.log("Notification received via WebSocket:", payload);
      if (payload?.userId === user?.id && payload?.notification) {
        setItems((prev) => [payload.notification, ...prev].slice(0, 50));
        setUnreadCount((c) => c + 1);
        playNotificationSound();
      }
    };

    socket.on('notification', handleNotification);

    return () => {
      socket.off('notification', handleNotification);
    };
  }, [socket, isAuthenticated, user?.id, playNotificationSound]);

  const handleMarkRead = useCallback(
    async (id: string) => {
      if (!isAuthenticated) return;
      const current = items.find((n) => n.id === id);
      if (!current) return;

      const res = await authFetch(`${getApiBaseUrl()}/notifications/${id}/read`, {
        method: "PUT",
        cache: "no-store",
      });
      if (!res.ok) return;

      setItems((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: "read" } : n))
      );
      if (current.status === "unread") {
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    },
    [isAuthenticated, items]
  );

  const handleMarkAllRead = useCallback(async () => {
    if (!isAuthenticated) return;
    const res = await authFetch(`${getApiBaseUrl()}/notifications/read-all`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      cache: "no-store",
    });
    if (!res.ok) return;

    setItems((prev) => prev.map((n) => ({ ...n, status: "read" })));
    setUnreadCount(0);
  }, [isAuthenticated]);

  const getActionRoute = useCallback((n: NotificationItem) => {
    if (!n.actionType) return null;
    if (n.actionType.startsWith("leave-application.")) return "/hr/leaves/requests";
    return null;
  }, []);

  const badgeText = unreadCount > 99 ? "99+" : String(unreadCount);

  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className="relative">
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
        </Button>
         {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground flex items-center justify-center">
              {badgeText}
            </span>
          )}</div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {items.length === 0 ? (
            <DropdownMenuItem disabled className="text-sm text-muted-foreground">
              No notifications
            </DropdownMenuItem>
          ) : (
            items.map((n) => {
              const route = getActionRoute(n);
              const isUnread = n.status === "unread";
              return (
                <DropdownMenuItem
                  key={n.id}
                  className="flex flex-col items-start gap-1"
                  onSelect={async () => {
                    await handleMarkRead(n.id);
                    if (route) router.push(route);
                  }}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className={isUnread ? "font-semibold" : "font-medium"}>
                      {n.title}
                    </span>
                    <Badge variant={isUnread ? "default" : "secondary"} className="capitalize">
                      {n.category || "general"}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground line-clamp-2">
                    {n.message}
                  </span>
                </DropdownMenuItem>
              );
            })
          )}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async (e) => {
            e.preventDefault();
            await handleMarkAllRead();
          }}
          disabled={unreadCount === 0}
        >
          Mark all as read
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

