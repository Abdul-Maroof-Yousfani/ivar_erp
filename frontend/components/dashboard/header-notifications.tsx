"use client";

import { useCallback, useEffect, useState } from "react";
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
import { authFetch, getAccessToken } from "@/lib/auth";
import { getApiBaseUrl } from "@/lib/utils";
import { toast } from "sonner";

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
  actionPayload?: any | null;
  entityType?: string | null;
  entityId?: string | null;
  createdAt: string;
};

export function HeaderNotifications() {
  const { user, isAuthenticated } = useAuth();
  const { socket } = useSocket();
  const router = useRouter();

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const playNotificationSound = useCallback(() => {
    try {
      const AudioContextCtor =
        window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextCtor) return;
      const ctx = new AudioContextCtor();
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.1);

      gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch (e) {
      console.warn("AudioContext failed to play:", e);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await authFetch(`/notifications?limit=10`, {
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

    socket.on("notification", handleNotification);

    return () => {
      socket.off("notification", handleNotification);
    };
  }, [socket, isAuthenticated, user?.id, playNotificationSound]);

  const handleMarkRead = useCallback(
    async (id: string) => {
      if (!isAuthenticated) return;
      const current = items.find((n) => n.id === id);
      if (!current) return;

      const res = await authFetch(
        `/api/notifications/${id}/read`,
        {
          method: "PUT",
          cache: "no-store",
        }
      );
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
    const res = await authFetch(`/api/notifications/read-all`, {
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
    if (n.actionType.startsWith("overtime-request.")) return "/hr/payroll-setup/overtime";
    if (n.actionType.startsWith("advance-salary.")) return "/hr/payroll-setup/advance-salary";
    if (n.actionType === "view_claim") return "/pos/claims";
    if (n.actionType === "view_transfer") return "/warehouse/stock-transfer";
    if (n.actionType === "view_order") return "/pos/sales";
    return null;
  }, []);

  const handleNotificationSelect = useCallback(
    async (n: NotificationItem) => {
      await handleMarkRead(n.id);

      // Helper to download binary export file with authentication
      const triggerDownload = async (pathOrUrl: string, defaultFilename: string) => {
        const toastId = toast.loading(`Preparing download for ${defaultFilename}...`);
        let url = pathOrUrl;
        try {
          const token = await getAccessToken();
          const headers: Record<string, string> = {};
          if (token) {
            headers["Authorization"] = `Bearer ${token}`;
          }

          const base = getApiBaseUrl();
          if (!url.startsWith("http://") && !url.startsWith("https://")) {
            const cleanPath = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
            const apiPath = cleanPath.startsWith("/api/") ? cleanPath : `/api${cleanPath}`;
            url = `${base}${apiPath}`;
          } else {
            try {
              const parsed = new URL(url);
              if (!parsed.pathname.startsWith("/api/")) {
                parsed.pathname = `/api${parsed.pathname}`;
                url = parsed.toString();
              }
            } catch {}
          }

          const response = await fetch(url, {
            credentials: "include",
            headers,
          });

          if (response.ok) {
            let finalFilename = defaultFilename;
            const disposition = response.headers.get("content-disposition");
            if (disposition) {
              const match = disposition.match(
                /filename\*?=(?:UTF-8'')?["']?([^;"'\n]+)["']?/i
              );
              if (match && match[1]) {
                finalFilename = decodeURIComponent(match[1].trim());
              }
            }

            const blob = await response.blob();
            const objectUrl = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = objectUrl;
            anchor.download = finalFilename;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            URL.revokeObjectURL(objectUrl);
            toast.success("Download completed", { id: toastId });
          } else {
            let errMessage = `Download failed (HTTP ${response.status})`;
            try {
              const errJson = await response.json();
              if (errJson?.message) errMessage = errJson.message;
            } catch {}
            console.error("Export download failed:", errMessage);
            toast.error(errMessage, { id: toastId });
          }
        } catch (e: any) {
          console.warn("Direct fetch download encountered an issue, falling back to native download:", e);
          try {
            const token = await getAccessToken();
            const downloadUrl = new URL(url);
            if (token && !downloadUrl.searchParams.has("token")) {
              downloadUrl.searchParams.set("token", token);
            }
            const anchor = document.createElement("a");
            anchor.href = downloadUrl.toString();
            anchor.download = defaultFilename;
            anchor.target = "_blank";
            anchor.rel = "noopener noreferrer";
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            toast.success("Download started", { id: toastId });
          } catch (fallbackErr: any) {
            console.error("Export download error:", fallbackErr);
            toast.error(e?.message || "Failed to download export file", {
              id: toastId,
            });
          }
        }
      };

      // Helper to parse payload & extract jobId
      const parseJobPayload = () => {
        let payload: any = {};
        if (n.actionPayload) {
          if (typeof n.actionPayload === "string") {
            try {
              payload = JSON.parse(n.actionPayload);
            } catch {
              payload = { raw: n.actionPayload };
            }
          } else if (typeof n.actionPayload === "object") {
            payload = n.actionPayload;
          }
        }
        const jobId = payload?.jobId || n.entityId || payload?.id;
        const format = payload?.format || "xlsx";
        return { jobId, format, payload };
      };

      const { jobId, format } = parseJobPayload();
      const base = getApiBaseUrl();
      const todayStr = new Date().toISOString().slice(0, 10);
      const actionType = n.actionType || "";
      const entityType = n.entityType || "";

      // ── Handle Export Notifications ──────────────────────────────────────────

      // 1. POS Sales Activity Export (both pos-sales-activity and sales-activity)
      if (
        (actionType === "pos-sales-activity-export.ready" ||
          actionType === "sales-activity-export.ready" ||
          entityType === "pos-sales-activity-export" ||
          entityType === "sales-activity-export") &&
        jobId
      ) {
        await triggerDownload(
          `${base}/pos-sales/activity/export/${jobId}/download`,
          `sales-activity-export-${todayStr}.${format}`
        );
        return;
      }

      // 2. POS Sales Export
      if (
        (actionType === "pos-sales-export.ready" ||
          entityType === "pos-sales-export") &&
        jobId
      ) {
        await triggerDownload(
          `${base}/pos-sales/export/${jobId}/download`,
          `pos-sales-export-${todayStr}.${format}`
        );
        return;
      }

      // 3. POS Sales List Report
      if (
        (actionType === "sales-list-export.ready" ||
          entityType === "sales-list-export") &&
        jobId
      ) {
        await triggerDownload(
          `${base}/pos-sales/reports/sales-list/export/${jobId}/download`,
          `sales-list-export-${todayStr}.${format}`
        );
        return;
      }

      // 4. POS Sales Register Report
      if (
        (actionType === "sales-register-export.ready" ||
          entityType === "sales-register-export") &&
        jobId
      ) {
        await triggerDownload(
          `${base}/pos-sales/reports/sales-register/export/${jobId}/download`,
          `sales-register-export-${todayStr}.${format}`
        );
        return;
      }

      // 5. POS Net Sales Summary Report
      if (
        (actionType === "net-sales-summary-export.ready" ||
          entityType === "net-sales-summary-export") &&
        jobId
      ) {
        await triggerDownload(
          `${base}/pos-sales/reports/net-sales-summary/export/${jobId}/download`,
          `net-sales-summary-export-${todayStr}.${format}`
        );
        return;
      }

      // 6. POS Alliance Register Report
      if (
        (actionType === "alliance-register-export.ready" ||
          entityType === "alliance-register-export") &&
        jobId
      ) {
        await triggerDownload(
          `${base}/pos-sales/reports/alliance-register/export/${jobId}/download`,
          `alliance-register-export-${todayStr}.${format}`
        );
        return;
      }

      // 7. POS Gross Sales Reports (Family, Class, Brick, Product, Invoices)
      if (
        (actionType.startsWith("gross-sales-") ||
          entityType.startsWith("gross-sales-")) &&
        jobId
      ) {
        await triggerDownload(
          `${base}/pos-sales/reports/gross-sales-export/${jobId}/download`,
          `gross-sales-export-${todayStr}.${format}`
        );
        return;
      }

      // 8. POS Reconciliation Report
      if (
        (actionType === "reconciliation-export.ready" ||
          entityType === "reconciliation-export") &&
        jobId
      ) {
        await triggerDownload(
          `${base}/pos-session/reconciliation/daywise/export/${jobId}/download`,
          `reconciliation-export-${todayStr}.${format}`
        );
        return;
      }

      // 9. Cost of Sales Report
      if (
        (actionType === "cost-of-sales-export.ready" ||
          entityType === "cost-of-sales-export") &&
        jobId
      ) {
        await triggerDownload(
          `${base}/pos-sales/reports/cost-of-sales/export-download/${jobId}`,
          `cost-of-sales-export-${todayStr}.${format}`
        );
        return;
      }

      // 10. Gift Voucher Sale Register Report
      if (
        (actionType === "gift-voucher-sale-register-export.ready" ||
          entityType === "gift-voucher-sale-register-export") &&
        jobId
      ) {
        await triggerDownload(
          `${base}/pos-sales/reports/gift-voucher-sale-register/export-download/${jobId}`,
          `gift-voucher-sale-register-${todayStr}.${format}`
        );
        return;
      }

      // 11. Corporate Voucher Report
      if (
        (actionType === "corporate-voucher-export.ready" ||
          entityType === "corporate-voucher-export") &&
        jobId
      ) {
        await triggerDownload(
          `${base}/pos-sales/reports/corporate-voucher/export-download/${jobId}`,
          `corporate-voucher-export-${todayStr}.${format}`
        );
        return;
      }

      // 12. Credit Voucher Report
      if (
        (actionType === "credit-voucher-export.ready" ||
          entityType === "credit-voucher-export") &&
        jobId
      ) {
        await triggerDownload(
          `${base}/pos-sales/reports/credit-voucher/export-download/${jobId}`,
          `credit-voucher-export-${todayStr}.${format}`
        );
        return;
      }

      // 13. Unified Voucher Register Report
      if (
        (actionType === "voucher-register-export.ready" ||
          entityType === "voucher-register-export") &&
        jobId
      ) {
        await triggerDownload(
          `${base}/pos-sales/reports/voucher-register/export-download/${jobId}`,
          `voucher-register-export-${todayStr}.${format}`
        );
        return;
      }

      // 14. Items Export
      if (
        (actionType === "item-export.ready" ||
          entityType === "item-export") &&
        jobId
      ) {
        await triggerDownload(
          `${base}/finance/items/export/${jobId}/download`,
          `items-export-${todayStr}.${format}`
        );
        return;
      }

      // 15. Merchants Export
      if (
        (actionType === "merchant-export.ready" ||
          entityType === "merchant-export") &&
        jobId
      ) {
        await triggerDownload(
          `${base}/pos-config/merchants/export/${jobId}/download`,
          `merchants-export-${todayStr}.${format}`
        );
        return;
      }

      // 16. Employees Export
      if (
        (actionType === "employee-export.ready" ||
          entityType === "employee-export") &&
        jobId
      ) {
        await triggerDownload(
          `${base}/employees/export/${jobId}/download`,
          `employees-export-${todayStr}.${format}`
        );
        return;
      }

      // 17. Customers Export
      if (
        (actionType === "customer-export.ready" ||
          entityType === "customer-export") &&
        jobId
      ) {
        await triggerDownload(
          `${base}/customers/export/${jobId}/download`,
          `customers-export-${todayStr}.${format}`
        );
        return;
      }

      // 18. Suppliers Export
      if (
        (actionType === "supplier-export.ready" ||
          entityType === "supplier-export") &&
        jobId
      ) {
        await triggerDownload(
          `${base}/finance/suppliers/export/${jobId}/download`,
          `suppliers-export-${todayStr}.${format}`
        );
        return;
      }

      // 19. Chart of Accounts Export
      if (
        (actionType === "chart-of-account-export.ready" ||
          entityType === "chart-of-account-export") &&
        jobId
      ) {
        await triggerDownload(
          `${base}/finance/chart-of-accounts/export/${jobId}/download`,
          `chart-of-accounts-export-${todayStr}.${format}`
        );
        return;
      }

      // 20. Trial Balance Export
      if (
        (actionType === "trial-balance-export.ready" ||
          entityType === "trial-balance-export") &&
        jobId
      ) {
        await triggerDownload(
          `${base}/finance/reports/trial-balance/export/${jobId}/download`,
          `trial-balance-export-${todayStr}.${format}`
        );
        return;
      }

      // 21. General Ledger Export
      if (
        (actionType === "general-ledger-export.ready" ||
          entityType === "general-ledger-export") &&
        jobId
      ) {
        await triggerDownload(
          `${base}/finance/reports/general-ledger/export/${jobId}/download`,
          `general-ledger-export-${todayStr}.${format}`
        );
        return;
      }

      // 22. Fabric Vendor Tracker Export
      if (
        (actionType === "fabric-vendor-tracker-export.ready" ||
          entityType === "fabric-vendor-tracker-export") &&
        jobId
      ) {
        await triggerDownload(
          `${base}/fabric-vendor-tracker/export/${jobId}/download`,
          `fabric-vendor-tracker-export-${todayStr}.${format}`
        );
        return;
      }

      // 23. Stock Ledger Export
      if (
        (actionType === "stock-ledger-export.ready" ||
          entityType === "stock-ledger-export") &&
        jobId
      ) {
        await triggerDownload(
          `${base}/stock-ledger/export/${jobId}/download`,
          `stock-ledger-export-${todayStr}.${format}`
        );
        return;
      }

      // 24. Stock Valuation Export
      if (
        (actionType === "stock-valuation-export.ready" ||
          entityType === "stock-valuation-export") &&
        jobId
      ) {
        await triggerDownload(
          `${base}/stock-ledger/valuation-report/export/${jobId}/download`,
          `stock-valuation-export-${todayStr}.${format}`
        );
        return;
      }

      // 25. Stock Transaction Detail Export
      if (
        (actionType === "stock-transaction-detail-export.ready" ||
          entityType === "stock-transaction-detail-export") &&
        jobId
      ) {
        await triggerDownload(
          `${base}/stock-ledger/transaction-detail-report/export/${jobId}/download`,
          `stock-transaction-detail-export-${todayStr}.${format}`
        );
        return;
      }

      // 26. Stock Activity Export
      if (
        (actionType === "stock-activity-export.ready" ||
          entityType === "stock-activity-export") &&
        jobId
      ) {
        await triggerDownload(
          `${base}/stock-ledger/activity-report/export/${jobId}/download`,
          `stock-activity-export-${todayStr}.${format}`
        );
        return;
      }

      // 27. Available Stock Summary Export
      if (
        (actionType === "available-stock-summary-export.ready" ||
          entityType === "available-stock-summary-export") &&
        jobId
      ) {
        await triggerDownload(
          `${base}/stock-ledger/available-stock-summary/export/${jobId}/download`,
          `available-stock-summary-export-${todayStr}.${format}`
        );
        return;
      }

      // 28. Overall Available Reserved Stock Export
      if (
        (actionType === "overall-available-reserved-stock-export.ready" ||
          entityType === "overall-available-reserved-stock-export") &&
        jobId
      ) {
        await triggerDownload(
          `${base}/stock-ledger/overall-available-reserved-stock/export/${jobId}/download`,
          `overall-available-reserved-stock-export-${todayStr}.${format}`
        );
        return;
      }

      // 29. Out-of-Stock Report Export
      if (
        (actionType === "out-of-stock-export.ready" ||
          entityType === "out-of-stock-export") &&
        jobId
      ) {
        await triggerDownload(
          `${base}/stock-ledger/out-of-stock-report/export/${jobId}/download`,
          `out-of-stock-report-${todayStr}.${format}`
        );
        return;
      }

      // 29. Delivery Note / Transfer Request Export
      if (
        (actionType === "delivery-note-export.ready" ||
          entityType === "delivery-note-export") &&
        jobId
      ) {
        await triggerDownload(
          `${base}/transfer-request/export/${jobId}/download`,
          `delivery-notes-export-${todayStr}.${format}`
        );
        return;
      }

      // 30. Generic Fallback for any export notification with jobId
      if (
        (n.category === "export" ||
          actionType.endsWith(".ready") ||
          entityType.endsWith("-export")) &&
        jobId
      ) {
        await triggerDownload(
          `${base}/export-history/${jobId}/download`,
          `export-${jobId}.${format}`
        );
        return;
      }

      // ── Handle Navigation Routes ─────────────────────────────────────────────
      const route = getActionRoute(n);
      if (route) router.push(route);
    },
    [handleMarkRead, getActionRoute, router]
  );

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
          )}
        </div>
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
              const isUnread = n.status === "unread";
              return (
                <DropdownMenuItem
                  key={n.id}
                  className="flex flex-col items-start gap-1"
                  onSelect={async () => {
                    await handleNotificationSelect(n);
                  }}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span
                      className={isUnread ? "font-semibold" : "font-medium"}
                    >
                      {n.title}
                    </span>
                    <Badge
                      variant={isUnread ? "default" : "secondary"}
                      className="capitalize"
                    >
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
