"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/auth";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PauseCircle, Clock, RotateCcw, Truck, RefreshCw, X } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { PermissionGuard } from "@/components/auth/permission-guard";

function timeLeft(expiresAt: string) {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return "Expired";
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins}m ${secs}s`;
}

export default function HoldOrdersPage() {
    const router = useRouter();
    const { hasPermission } = useAuth();
    const canResume = hasPermission('pos.hold.resume');
    const [orders, setOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [cancellingId, setCancellingId] = useState<string | null>(null);
    const [tick, setTick] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => setTick(t => t + 1), 10000);
        return () => clearInterval(interval);
    }, []);

    const load = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await authFetch("/pos-sales/orders/holds");
            if (res.ok && res.data?.status) setOrders(res.data.data || []);
        } catch {
            toast.error("Failed to load hold orders");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleResume = async (orderId: string) => {
        try {
            const res = await authFetch(`/pos-sales/orders/${orderId}/resume`, { method: "POST" });
            if (res.ok && res.data?.status) {
                const order = res.data.data;
                // Store resumed cart in sessionStorage and navigate to new-sale
                const cartItems = order.items.map((oi: any) => ({
                    id: oi.itemId,
                    upc: oi.item?.barCode || oi.itemId || "-",
                    sku: oi.item?.sku || "-",
                    name: oi.item?.description || "Unknown Item",
                    brand: "-", size: "-", color: "-",
                    quantity: oi.quantity,
                    price: Number(oi.unitPrice),
                    discountPercent: Number(oi.discountPercent),
                    discountAmount: Number(oi.discountAmount),
                    taxPercent: Number(oi.taxPercent),
                    taxAmount: Number(oi.taxAmount),
                    total: Number(oi.lineTotal),
                    inStock: true, stockQty: 999,
                    isStockInTransit: oi.isStockInTransit || false,
                }));
                sessionStorage.setItem("pos_resume_cart", JSON.stringify(cartItems));
                toast.success(`Resuming order ${order.orderNumber}`);
                router.push("/pos/new-sale?resume=1");
            } else {
                toast.error(res.data?.message || "Failed to resume");
            }
        } catch {
            toast.error("Failed to resume order");
        }
    };

    const handleCancel = async (orderId: string, orderNumber: string) => {
        if (!confirm(`Are you sure you want to cancel hold order ${orderNumber}? Stock will be restored.`)) {
            return;
        }

        setCancellingId(orderId);
        try {
            const res = await authFetch(`/pos-sales/orders/${orderId}/cancel-hold`, { method: "POST" });
            if (res.ok && res.data?.status) {
                toast.success(res.data.message || "Hold order cancelled");
                load(); // Reload the list
            } else {
                toast.error(res.data?.message || "Failed to cancel hold order");
            }
        } catch {
            toast.error("Failed to cancel hold order");
        } finally {
            setCancellingId(null);
        }
    };

    return (
        <PermissionGuard permissions="pos.hold.view">
        <div className="space-y-6 mt-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <PauseCircle className="h-6 w-6 text-amber-500" />
                    <div>
                        <h1 className="text-2xl font-bold">Hold Orders</h1>
                        <p className="text-sm text-muted-foreground">
                            Active holds expire within 1 hour or at midnight
                        </p>
                    </div>
                </div>
                <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
                    Refresh
                </Button>
            </div>

            {isLoading ? (
                <div className="text-center py-16 text-muted-foreground">Loading...</div>
            ) : orders.length === 0 ? (
                <Card className="p-12 text-center">
                    <PauseCircle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
                    <p className="text-muted-foreground">No active hold orders</p>
                    <p className="text-xs text-muted-foreground mt-1">
                        Press F8 on the new sale screen to hold a cart
                    </p>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {orders.map((order) => (
                        <Card key={order.id} className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="font-mono font-semibold text-sm">{order.orderNumber}</span>
                                <div className="flex items-center gap-1 text-amber-600 text-xs font-medium">
                                    <Clock className="h-3.5 w-3.5" />
                                    {timeLeft(order.holdExpiresAt)}
                                </div>
                            </div>

                            <div className="space-y-1">
                                {order.items?.slice(0, 3).map((item: any) => (
                                    <div key={item.id} className="flex items-center justify-between text-xs">
                                        <span className="text-muted-foreground truncate max-w-[180px]">
                                            {item.item?.description || item.itemId}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="font-medium">×{item.quantity}</span>
                                            {item.isStockInTransit && (
                                                <Badge variant="outline" className="text-amber-600 border-amber-400 text-[10px] px-1 py-0">
                                                    <Truck className="h-2.5 w-2.5" />
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {order.items?.length > 3 && (
                                    <p className="text-xs text-muted-foreground">+{order.items.length - 3} more items</p>
                                )}
                            </div>

                            <div className="flex items-center justify-between pt-1 border-t">
                                <span className="font-bold">{Number(order.grandTotal).toLocaleString()}</span>
                                <div className="flex gap-2">
                                    <Button 
                                        size="sm" 
                                        variant="outline" 
                                        className="h-8 text-xs" 
                                        onClick={() => handleCancel(order.id, order.orderNumber)}
                                        disabled={cancellingId === order.id || !canResume}
                                    >
                                        <X className="h-3 w-3 mr-1" />
                                        Cancel
                                    </Button>
                                    <Button 
                                        size="sm" 
                                        className="h-8 text-xs" 
                                        onClick={() => handleResume(order.id)}
                                        disabled={cancellingId === order.id || !canResume}
                                    >
                                        <RotateCcw className="h-3 w-3 mr-1" />
                                        Resume
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>
            )}
        </div>
        </PermissionGuard>
    );
}
