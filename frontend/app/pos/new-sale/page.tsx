"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { NewSaleTopBar } from "@/components/pos/new-sale/top-bar";
import { CartTable, type CartItem } from "@/components/pos/new-sale/cart-table";
import { SummaryFooter } from "@/components/pos/new-sale/summary-footer";
import { toast } from "sonner";
import { authFetch } from "@/lib/auth";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PauseCircle, Clock, Truck, RotateCcw } from "lucide-react";
import { HoldOrderModal } from "@/components/pos/hold-order-modal";
import { usePosSettings } from "@/hooks/use-pos-settings";
import { useAuth } from "@/components/providers/auth-provider";
import { formatCurrency } from "@/lib/utils";

// ─── Helpers ────────────────────────────────────────────────────────
function computeLineItem(
    product: any,
    quantity: number,
    discountPercent: number,
    isStockInTransit = false,
    defaultTaxPercent = 0,
): CartItem {
    const price = Number(product.unitPrice) || 0;
    const subtotal = price * quantity;
    const discountAmount = Math.round(subtotal * (discountPercent / 100) * 100) / 100;
    const afterDiscount = subtotal - discountAmount;
    const taxPercent = Number(product.taxRate1) || defaultTaxPercent;
    const taxAmount = Math.round(afterDiscount * (taxPercent / 100) * 100) / 100;
    const total = afterDiscount + taxAmount;

    return {
        id: product.id,
        upc: product.barCode || product.itemId || "-",
        sku: product.sku || "-",
        name: product.description || "Unknown Item",
        brand: product.brand || "-",
        size: product.size || "-",
        color: product.color || "-",
        quantity,
        price,
        discountPercent,
        discountAmount,
        taxPercent,
        taxAmount,
        total,
        inStock: product.inStock ?? true,
        stockQty: product.stockQty ?? 0,
        isStockInTransit,
    };
}

function timeLeft(expiresAt: string) {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return "Expired";
    const mins = Math.floor(diff / 60000);
    const secs = Math.floor((diff % 60000) / 1000);
    return `${mins}m ${secs}s`;
}

export default function NewSalePage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { settings } = usePosSettings();
    const { hasPermission } = useAuth();
    const canDiscount = hasPermission('pos.sale.item-discount');
    const canTransit = hasPermission('pos.sale.transit-override');
    const canHold = hasPermission('pos.hold.create');
    const canViewHolds = hasPermission('pos.hold.view');
    const canResumeHold = hasPermission('pos.hold.resume');
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // ─── Hold orders state ──────────────────────────────────────────
    const [showHoldOrders, setShowHoldOrders] = useState(false);
    const [holdOrders, setHoldOrders] = useState<any[]>([]);
    const [isLoadingHolds, setIsLoadingHolds] = useState(false);
    const [isHolding, setIsHolding] = useState(false);
    const [holdTimerTick, setHoldTimerTick] = useState(0);
    const [showHoldModal, setShowHoldModal] = useState(false);
    const [resumedHoldOrderId, setResumedHoldOrderId] = useState<string | null>(null);

    // ─── Tick timer for hold countdowns ────────────────────────────
    useEffect(() => {
        const interval = setInterval(() => setHoldTimerTick(t => t + 1), 10000);
        return () => clearInterval(interval);
    }, []);

    // ─── Auto-focus search on mount + handle resume from holds page ─
    useEffect(() => {
        searchInputRef.current?.focus();
        // Check if we're resuming from the holds page
        const resumeCart = sessionStorage.getItem("pos_resume_cart");
        if (resumeCart) {
            try {
                const items = JSON.parse(resumeCart);
                setCartItems(items);
                sessionStorage.removeItem("pos_resume_cart");
                toast.success("Hold order resumed");
            } catch { /* ignore */ }
        }
        // Auto-open hold orders panel if navigated from history with ?showHolds=1
        if (searchParams.get("showHolds") === "1") {
            loadHoldOrders();
            setShowHoldOrders(true);
        }
    }, []);

    // ─── Load hold orders ───────────────────────────────────────────
    const loadHoldOrders = useCallback(async () => {
        setIsLoadingHolds(true);
        try {
            const res = await authFetch("/pos-sales/orders/holds");
            if (res.ok && res.data?.status) {
                setHoldOrders(res.data.data || []);
            }
        } catch {
            toast.error("Failed to load hold orders");
        } finally {
            setIsLoadingHolds(false);
        }
    }, []);

    // ─── Place current cart on hold ─────────────────────────────────
    const handleHold = useCallback(async (holdUntilTime?: string): Promise<void> => {
        if (cartItems.length === 0) return;
        if (!holdUntilTime) {
            setShowHoldModal(true);
            return;
        }
        setIsHolding(true);
        try {
            const payload = {
                items: cartItems.map(item => ({
                    itemId: item.id,
                    quantity: item.quantity,
                    unitPrice: item.price,
                    discountPercent: item.discountPercent,
                    taxPercent: item.taxPercent,
                    isStockInTransit: item.isStockInTransit || false,
                })),
            };
            const res = await authFetch("/pos-sales/orders/hold", { method: "POST", body: payload });
            if (res.ok && res.data?.status) {
                toast.success(res.data.message || "Order placed on hold");
                setCartItems([]);
                setSearchQuery("");
                setResumedHoldOrderId(null);
                setShowHoldModal(false);
                searchInputRef.current?.focus();
            } else {
                toast.error(res.data?.message || "Failed to hold order");
            }
        } catch {
            toast.error("Failed to hold order. Check connection.");
        } finally {
            setIsHolding(false);
        }
    }, [cartItems]);

    // ─── Resume a held order ────────────────────────────────────────
    const handleResumeHold = useCallback(async (orderId: string) => {
        try {
            const res = await authFetch(`/pos-sales/orders/${orderId}/resume`, { method: "POST" });
            if (res.ok && res.data?.status) {
                const order = res.data.data;
                const resumedItems: CartItem[] = order.items.map((oi: any) => ({
                    id: oi.itemId,
                    upc: oi.item?.barCode || oi.itemId || "-",
                    sku: oi.item?.sku || "-",
                    name: oi.item?.description || "Unknown Item",
                    brand: "-",
                    size: "-",
                    color: "-",
                    quantity: oi.quantity,
                    price: Number(oi.unitPrice),
                    discountPercent: Number(oi.discountPercent),
                    discountAmount: Number(oi.discountAmount),
                    taxPercent: Number(oi.taxPercent),
                    taxAmount: Number(oi.taxAmount),
                    total: Number(oi.lineTotal),
                    inStock: true,
                    stockQty: 999,
                    isStockInTransit: oi.isStockInTransit || false,
                }));
                setCartItems(resumedItems);
                setResumedHoldOrderId(order.id);
                setShowHoldOrders(false);
                toast.success(`Order ${order.orderNumber} resumed`);
            } else {
                toast.error(res.data?.message || "Failed to resume order");
            }
        } catch {
            toast.error("Failed to resume order. Check connection.");
        }
    }, []);

    // ─── Keyboard shortcuts ─────────────────────────────────────────
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "F2") {
                e.preventDefault();
                searchInputRef.current?.focus();
                searchInputRef.current?.select();
            }
            if (e.key === "F9") {
                e.preventDefault();
                if (cartItems.length > 0 && !isProcessing) handleCheckout();
            }
            if (e.key === "Escape") {
                e.preventDefault();
                if (showHoldOrders) { setShowHoldOrders(false); return; }
                if (cartItems.length > 0) {
                    setCartItems([]);
                    toast.info("Cart cleared");
                    searchInputRef.current?.focus();
                }
            }
            if (e.key === "F4") {
                e.preventDefault();
                if (cartItems.length > 0 && !isProcessing) handleCheckout();
            }
            // F8 → Hold order (if cart has items), else show hold orders
            if (e.key === "F8") {
                e.preventDefault();
                if (cartItems.length > 0 && canHold) {
                    handleHold();
                } else if (canViewHolds) {
                    loadHoldOrders();
                    setShowHoldOrders(true);
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [cartItems, isProcessing, showHoldOrders, handleHold, loadHoldOrders]);

    // ─── Debounced Live Search ──────────────────────────────────────
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (searchQuery.trim().length >= 2) {
                setIsSearching(true);
                try {
                    const res = await authFetch(`/pos-sales/lookup`, { params: { q: searchQuery.trim() } });
                    if (res.ok && res.data?.status && res.data.data) {
                        setSearchResults(res.data.data);
                    } else {
                        setSearchResults([]);
                    }
                } catch {
                    setSearchResults([]);
                } finally {
                    setIsSearching(false);
                }
            } else {
                setSearchResults([]);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    // ─── Barcode scan / Search submit ──────────────────────────────
    const handleSearchSubmit = useCallback(async () => {
        if (!searchQuery.trim()) return;
        try {
            const res = await authFetch(`/pos-sales/scan`, { params: { barcode: searchQuery.trim() } });
            if (res.ok && res.data?.status && res.data.data) {
                const product = res.data.data;
                const defTax = parseFloat(settings.defaultTaxPercent) || 0;
                setCartItems((prev) => {
                    const existing = prev.find((i) => i.id === product.id);
                    if (existing) {
                        if (existing.quantity + 1 > product.stockQty && !existing.isStockInTransit) {
                            toast.error(`Only ${product.stockQty} units available in stock`);
                            return prev;
                        }
                        return prev.map((i) =>
                            i.id === product.id
                                ? computeLineItem(product, i.quantity + 1, i.discountPercent, i.isStockInTransit, defTax)
                                : i
                        );
                    }
                    return [...prev, computeLineItem(product, 1, Number(product.discountRate) || 0, false, defTax)];
                });
            } else {
                toast.error(res.data?.message || "Item not found");
            }
        } catch {
            toast.error("Failed to scan item. Check connection.");
        }
        setSearchQuery("");
        searchInputRef.current?.focus();
    }, [searchQuery]);

    // ─── Select from Autocomplete ───────────────────────────────────
    const handleSelectProduct = useCallback((product: any) => {
        const defTax = parseFloat(settings.defaultTaxPercent) || 0;
        setCartItems((prev) => {
            const existing = prev.find((i) => i.id === product.id);
            if (existing) {
                if (existing.quantity + 1 > product.stockQty && !existing.isStockInTransit) {
                    toast.error(`Only ${product.stockQty} units available in stock`);
                    return prev;
                }
                return prev.map((i) =>
                    i.id === product.id
                        ? computeLineItem(product, i.quantity + 1, i.discountPercent, i.isStockInTransit, defTax)
                        : i
                );
            }
            return [...prev, computeLineItem(product, 1, Number(product.discountRate) || 0, false, defTax)];
        });
        setSearchQuery("");
        setSearchResults([]);
        searchInputRef.current?.focus();
    }, [settings.defaultTaxPercent]);

    // ─── Cart operations ────────────────────────────────────────────
    const handleQuantityChange = useCallback((id: string, quantity: number) => {
        setCartItems((prev) =>
            prev.map((item) => {
                if (item.id !== id) return item;
                if (quantity > item.stockQty && !item.isStockInTransit) {
                    toast.error(`Only ${item.stockQty} units available in stock`);
                    return item;
                }
                const subtotal = item.price * quantity;
                const discountAmount = Math.round(subtotal * (item.discountPercent / 100) * 100) / 100;
                const afterDiscount = subtotal - discountAmount;
                const taxAmount = Math.round(afterDiscount * (item.taxPercent / 100) * 100) / 100;
                const total = afterDiscount + taxAmount;
                return { ...item, quantity, discountAmount, taxAmount, total };
            })
        );
    }, []);

    const handleDiscountChange = useCallback((id: string, discountPercent: number) => {
        const clamped = Math.min(100, Math.max(0, discountPercent));
        setCartItems((prev) =>
            prev.map((item) => {
                if (item.id !== id) return item;
                const subtotal = item.price * item.quantity;
                const discountAmount = Math.round(subtotal * (clamped / 100) * 100) / 100;
                const afterDiscount = subtotal - discountAmount;
                const taxAmount = Math.round(afterDiscount * (item.taxPercent / 100) * 100) / 100;
                const total = afterDiscount + taxAmount;
                return { ...item, discountPercent: clamped, discountAmount, taxAmount, total };
            })
        );
    }, []);

    const handleRemoveItem = useCallback((id: string) => {
        setCartItems((prev) => prev.filter((item) => item.id !== id));
    }, []);

    // ─── Toggle stock-in-transit ────────────────────────────────────
    const handleToggleTransit = useCallback((id: string) => {
        setCartItems((prev) =>
            prev.map((item) =>
                item.id === id
                    ? { ...item, isStockInTransit: !item.isStockInTransit }
                    : item
            )
        );
    }, []);

    // ─── Checkout ───────────────────────────────────────────────────
    const handleCheckout = useCallback(() => {
        if (cartItems.length === 0) return;
        sessionStorage.setItem("pos_cart", JSON.stringify(cartItems));
        if (resumedHoldOrderId) {
            sessionStorage.setItem("pos_hold_order_id", resumedHoldOrderId);
        } else {
            sessionStorage.removeItem("pos_hold_order_id");
        }
        router.push("/pos/checkout");
    }, [cartItems, router, resumedHoldOrderId]);

    // ─── Derived state ──────────────────────────────────────────────
    const subtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const totalDiscount = cartItems.reduce((acc, item) => acc + item.discountAmount, 0);
    const totalTax = cartItems.reduce((acc, item) => acc + item.taxAmount, 0);
    const grandTotal = cartItems.reduce((acc, item) => acc + item.total, 0);
    const hasTransitItems = cartItems.some(i => i.isStockInTransit);

    return (
        <div className="space-y-4 mt-4">
            {/* Keyboard shortcut hints */}
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono flex-wrap">
                <span className="px-1.5 py-0.5 rounded bg-muted">F2</span>
                <span>Search</span>
                <span className="text-border">|</span>
                <span className="px-1.5 py-0.5 rounded bg-muted">Enter</span>
                <span>Scan</span>
                <span className="text-border">|</span>
                <span className="px-1.5 py-0.5 rounded bg-muted">F9</span>
                <span>Checkout</span>
                <span className="text-border">|</span>
                <span className="px-1.5 py-0.5 rounded bg-muted">Esc</span>
                <span>Clear</span>
                <span className="text-border">|</span>
                <span className="px-1.5 py-0.5 rounded bg-muted">F8</span>
                <span>Hold / View Holds</span>
                {hasTransitItems && (
                    <>
                        <span className="text-border">|</span>
                        <span className="flex items-center gap-1 text-amber-600">
                            <Truck className="h-3 w-3" />
                            {cartItems.filter(i => i.isStockInTransit).length} item(s) in transit
                        </span>
                    </>
                )}
            </div>

            {/* Top bar */}
            <NewSaleTopBar
                itemCount={cartItems.length}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                onSearchSubmit={handleSearchSubmit}
                searchResults={searchResults}
                isSearching={isSearching}
                onSelectProduct={handleSelectProduct}
                searchInputRef={searchInputRef}
            />

            {/* Cart table */}
            <CartTable
                items={cartItems}
                onQuantityChange={handleQuantityChange}
                onDiscountChange={canDiscount ? handleDiscountChange : undefined}
                onRemoveItem={handleRemoveItem}
                onToggleTransit={canTransit ? handleToggleTransit : undefined}
            />

            {/* Footer totals */}
            <SummaryFooter
                subtotal={subtotal}
                discount={totalDiscount}
                tax={totalTax}
                grandTotal={grandTotal}
                onCheckout={handleCheckout}
                onHold={canHold ? () => handleHold() : undefined}
                disabled={cartItems.length === 0 || isProcessing || isHolding}
            />

            {/* Hold Orders Dialog */}
            <Dialog open={showHoldOrders} onOpenChange={setShowHoldOrders}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <PauseCircle className="h-5 w-5 text-amber-500" />
                            Hold Orders
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-3 max-h-[400px] overflow-y-auto py-2">
                        {isLoadingHolds ? (
                            <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
                        ) : holdOrders.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">No active hold orders</p>
                        ) : (
                            holdOrders.map((order) => (
                                <div key={order.id} className="border rounded-lg p-3 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="font-mono text-sm font-semibold">{order.orderNumber}</span>
                                        <div className="flex items-center gap-1.5 text-amber-600 text-xs">
                                            <Clock className="h-3 w-3" />
                                            {timeLeft(order.holdExpiresAt)}
                                        </div>
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {order.items?.length || 0} item(s) · Total: {formatCurrency(Number(order.grandTotal))}
                                        {order.items?.some((i: any) => i.isStockInTransit) && (
                                            <Badge variant="outline" className="ml-2 text-amber-600 border-amber-400 text-[10px]">
                                                <Truck className="h-2.5 w-2.5 mr-1" />
                                                Transit
                                            </Badge>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            className="flex-1 h-8 text-xs"
                                            disabled={!canResumeHold}
                                            onClick={() => handleResumeHold(order.id)}
                                        >
                                            <RotateCcw className="h-3 w-3 mr-1" />
                                            Resume
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div className="flex justify-between items-center pt-2 border-t">
                        <p className="text-[11px] text-muted-foreground">Holds expire in max 1 hour or at midnight</p>
                        <Button variant="outline" size="sm" onClick={() => { loadHoldOrders(); }}>
                            Refresh
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Hold Order Modal */}
            <HoldOrderModal
                open={showHoldModal}
                onOpenChange={setShowHoldModal}
                onConfirm={handleHold}
                isHolding={isHolding}
                itemCount={cartItems.length}
            />
        </div>
    );
}
