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
import { PauseCircle, Clock, RotateCcw } from "lucide-react";
import { HoldOrderModal } from "@/components/pos/hold-order-modal";
import { usePosSettings } from "@/hooks/use-pos-settings";
import { useAuth } from "@/components/providers/auth-provider";
import { formatCurrency, cn } from "@/lib/utils";

// ─── Helpers ────────────────────────────────────────────────────────
function computeLineItem(
    product: any,
    quantity: number,
    discountPercent: number,
    defaultTaxPercent = 0,
): CartItem {
    // Step 1: Retail price is the unit price
    const price = Number(product.unitPrice) || 0;
    
    // Step 2: Calculate WOST (Value Without Sales Tax)
    const taxPercent = Number(product.taxRate1) || defaultTaxPercent;
    const taxDivisor = 1 + (taxPercent / 100);
    const wostPerUnit = price / taxDivisor;
    const totalWost = wostPerUnit * quantity;
    
    // Step 3: Apply discount on WOST
    const discountAmount = Math.round(totalWost * (discountPercent / 100));
    const afterDiscount = totalWost - discountAmount;
    
    // Step 4: Calculate tax on discounted amount
    const taxAmount = Math.round(afterDiscount * (taxPercent / 100));
    
    // Step 5: Total = Math.round(discounted WOST + tax)
    const total = Math.round(afterDiscount + taxAmount);

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
    const canHold = hasPermission('pos.hold.create');
    const canViewHolds = hasPermission('pos.hold.view');
    const canResumeHold = hasPermission('pos.hold.resume');
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [cartItems, setCartItems] = useState<CartItem[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const [focusedCartIndex, setFocusedCartIndex] = useState<number>(-1);
    const [showShortcutsHelp, setShowShortcutsHelp] = useState<boolean>(false);

    // ─── Hold orders state ──────────────────────────────────────────
    const [showHoldOrders, setShowHoldOrders] = useState(false);
    const [holdOrders, setHoldOrders] = useState<any[]>([]);
    const [isLoadingHolds, setIsLoadingHolds] = useState(false);
    const [isHolding, setIsHolding] = useState(false);
    const [holdTimerTick, setHoldTimerTick] = useState(0);
    const [showHoldModal, setShowHoldModal] = useState(false);
    const [resumedHoldOrderId, setResumedHoldOrderId] = useState<string | null>(null);

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
            let holdExpiresAt: string | undefined = undefined;
            if (holdUntilTime) {
                const [h, m] = holdUntilTime.split(':').map(Number);
                const target = new Date();
                target.setHours(h, m, 0, 0);
                holdExpiresAt = target.toISOString();
            }

            const payload = {
                holdExpiresAt,
                items: cartItems.map(item => ({
                    itemId: item.id,
                    quantity: item.quantity,
                    unitPrice: item.price,
                    discountPercent: item.discountPercent,
                    taxPercent: item.taxPercent,
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
                    overrideDiscountPercent: oi.overrideDiscountPercent ? Number(oi.overrideDiscountPercent) : undefined,
                    overrideDiscountNote: oi.overrideDiscountNote || undefined,
                    taxPercent: Number(oi.taxPercent),
                    taxAmount: Number(oi.taxAmount),
                    total: Number(oi.lineTotal),
                    inStock: true,
                    stockQty: 999,
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

    // Keyboard shortcuts moved to bottom to prevent TDZ error

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
                    const existingIndex = prev.findIndex((i) => i.id === product.id);
                    if (existingIndex > -1) {
                        const existing = prev[existingIndex];
                        if (existing.quantity + 1 > product.stockQty) {
                            toast.error(`Only ${product.stockQty} units available in stock`);
                            return prev;
                        }
                        setTimeout(() => setFocusedCartIndex(existingIndex), 0);
                        return prev.map((i) =>
                            i.id === product.id
                                ? computeLineItem(product, i.quantity + 1, i.discountPercent, defTax)
                                : i
                        );
                    }
                    setTimeout(() => setFocusedCartIndex(prev.length), 0);
                    return [...prev, computeLineItem(product, 1, Number(product.effectiveDiscountPercent ?? product.discountRate) || 0, defTax)];
                });
            } else {
                toast.error(res.data?.message || "Item not found");
            }
        } catch {
            toast.error("Failed to scan item. Check connection.");
        }
        setSearchQuery("");
        searchInputRef.current?.focus();
    }, [searchQuery, settings.defaultTaxPercent]);

    // ─── Select from Autocomplete ───────────────────────────────────
    const handleSelectProduct = useCallback((product: any) => {
        const defTax = parseFloat(settings.defaultTaxPercent) || 0;
        setCartItems((prev) => {
            const existingIndex = prev.findIndex((i) => i.id === product.id);
            if (existingIndex > -1) {
                const existing = prev[existingIndex];
                if (existing.quantity + 1 > product.stockQty) {
                    toast.error(`Only ${product.stockQty} units available in stock`);
                    return prev;
                }
                setTimeout(() => setFocusedCartIndex(existingIndex), 0);
                return prev.map((i) =>
                    i.id === product.id
                        ? computeLineItem(product, i.quantity + 1, i.discountPercent, defTax)
                        : i
                );
            }
            setTimeout(() => setFocusedCartIndex(prev.length), 0);
            return [...prev, computeLineItem(product, 1, Number(product.effectiveDiscountPercent ?? product.discountRate) || 0, defTax)];
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
                if (quantity > item.stockQty) {
                    toast.error(`Only ${item.stockQty} units available in stock`);
                    return item;
                }
                
                // Step 1: Retail price is item.price
                const retailPrice = item.price;
                
                // Step 2: Calculate WOST (Value Without Sales Tax)
                const taxDivisor = 1 + (item.taxPercent / 100);
                const wostPerUnit = retailPrice / taxDivisor;
                const totalWost = wostPerUnit * quantity;
                
                // Step 3: Apply discount on WOST
                const discountAmount = Math.round(totalWost * (item.discountPercent / 100));
                const afterDiscount = totalWost - discountAmount;
                
                // Step 4: Calculate tax on discounted amount
                const taxAmount = Math.round(afterDiscount * (item.taxPercent / 100));
                
                // Step 5: Total = Math.round(discounted WOST + tax)
                const total = Math.round(afterDiscount + taxAmount);
                
                return { ...item, quantity, discountAmount, taxAmount, total };
            })
        );
    }, []);

    const handleDiscountChange = useCallback((id: string, newDiscountPercent: number, note?: string) => {
        const clamped = Math.min(100, Math.max(0, newDiscountPercent));
        setCartItems((prev) =>
            prev.map((item) => {
                if (item.id !== id) return item;
                
                const originalDiscount = item.discountPercent;
                
                // Determine if this is an override
                let overrideDiscountPercent = item.overrideDiscountPercent;
                let overrideDiscountNote = item.overrideDiscountNote;
                
                if (clamped !== originalDiscount) {
                    // New discount is different from original, set override
                    overrideDiscountPercent = clamped;
                    overrideDiscountNote = note;
                } else {
                    // New discount matches original, clear override
                    overrideDiscountPercent = undefined;
                    overrideDiscountNote = undefined;
                }
                
                // Step 1: Retail price is item.price
                const retailPrice = item.price;
                
                // Step 2: Calculate WOST (Value Without Sales Tax)
                const taxDivisor = 1 + (item.taxPercent / 100);
                const wostPerUnit = retailPrice / taxDivisor;
                const totalWost = wostPerUnit * item.quantity;
                
                // Step 3: Apply discount on WOST
                const discountAmount = Math.round(totalWost * (clamped / 100));
                const afterDiscount = totalWost - discountAmount;
                
                // Step 4: Calculate tax on discounted amount
                const taxAmount = Math.round(afterDiscount * (item.taxPercent / 100));
                
                // Step 5: Total = Math.round(discounted WOST + tax)
                const total = Math.round(afterDiscount + taxAmount);
                
                return { 
                    ...item, 
                    overrideDiscountPercent,
                    overrideDiscountNote,
                    discountAmount, 
                    taxAmount, 
                    total 
                };
            })
        );
    }, []);

    const handleRemoveItem = useCallback((id: string) => {
        setCartItems((prev) => prev.filter((item) => item.id !== id));
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
        
        // Check if we're coming back from checkout (cart should be preserved)
        const checkoutCart = sessionStorage.getItem("pos_cart");
        if (checkoutCart && !resumeCart) {
            try {
                const items = JSON.parse(checkoutCart);
                setCartItems(items);
                // Don't remove pos_cart here - let checkout remove it after successful order
            } catch { /* ignore */ }
        }
        
        // Auto-open hold orders panel if navigated from history with ?showHolds=1
        if (searchParams.get("showHolds") === "1") {
            loadHoldOrders();
            setShowHoldOrders(true);
        }
    }, [searchParams, loadHoldOrders]);

    // ─── Keyboard shortcuts ─────────────────────────────────────────
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const activeEl = document.activeElement;
            const isInputFocused = activeEl && (
                activeEl.tagName === "INPUT" || 
                activeEl.tagName === "TEXTAREA" || 
                activeEl.tagName === "SELECT" ||
                activeEl.getAttribute("contenteditable") === "true"
            );

            // Toggle help panel with F1 or Ctrl+/
            if (e.key === "F1" || (e.ctrlKey && e.key === "/")) {
                e.preventDefault();
                setShowShortcutsHelp(prev => !prev);
                return;
            }

            if (e.key === "F2") {
                e.preventDefault();
                setFocusedCartIndex(-1); // reset active cart row when searching
                searchInputRef.current?.focus();
                searchInputRef.current?.select();
                return;
            }

            if (e.key === "F9" || e.key === "F4") {
                e.preventDefault();
                if (cartItems.length > 0 && !isProcessing) handleCheckout();
                return;
            }

            if (e.key === "Escape") {
                e.preventDefault();
                if (showHoldOrders) { setShowHoldOrders(false); return; }
                if (showShortcutsHelp) { setShowShortcutsHelp(false); return; }
                
                // If focused inside any input, blur it and focus/highlight the cart table/active row
                if (isInputFocused) {
                    (activeEl as HTMLElement).blur();
                    if (cartItems.length > 0 && focusedCartIndex === -1) {
                        setFocusedCartIndex(cartItems.length - 1);
                    }
                    return;
                }

                // If not in input, clear cart
                if (cartItems.length > 0) {
                    if (confirm("Are you sure you want to clear the cart?")) {
                        setCartItems([]);
                        setFocusedCartIndex(-1);
                        toast.info("Cart cleared");
                        searchInputRef.current?.focus();
                    }
                }
                return;
            }

            if (e.key === "F8") {
                e.preventDefault();
                if (cartItems.length > 0 && canHold) {
                    handleHold();
                } else if (canViewHolds) {
                    loadHoldOrders();
                    setShowHoldOrders(true);
                }
                return;
            }

            // --- Cart Table Navigation and Operation Keys (only when not in input) ---
            if (!isInputFocused && cartItems.length > 0) {
                // Arrow keys navigation
                if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                    e.preventDefault();
                    setFocusedCartIndex(prev => {
                        if (prev === -1) return e.key === "ArrowDown" ? 0 : cartItems.length - 1;
                        if (e.key === "ArrowDown") return (prev + 1) % cartItems.length;
                        return (prev - 1 + cartItems.length) % cartItems.length;
                    });
                    return;
                }

                // If we have a highlighted cart item
                if (focusedCartIndex >= 0 && focusedCartIndex < cartItems.length) {
                    const item = cartItems[focusedCartIndex];

                    // Plus / = key -> Increment quantity
                    if (e.key === "+" || e.key === "=") {
                        e.preventDefault();
                        handleQuantityChange(item.id, item.quantity + 1);
                        return;
                    }

                    // Minus key -> Decrement quantity
                    if (e.key === "-") {
                        e.preventDefault();
                        if (item.quantity > 1) {
                            handleQuantityChange(item.id, item.quantity - 1);
                        } else {
                            handleRemoveItem(item.id);
                            setFocusedCartIndex(prev => prev >= cartItems.length - 1 ? cartItems.length - 2 : prev);
                        }
                        return;
                    }

                    // Delete / Backspace -> Remove item
                    if (e.key === "Delete" || e.key === "Backspace") {
                        e.preventDefault();
                        handleRemoveItem(item.id);
                        setFocusedCartIndex(prev => {
                            if (cartItems.length <= 1) return -1;
                            return Math.min(prev, cartItems.length - 2);
                        });
                        toast.info(`Removed ${item.name}`);
                        return;
                    }

                    // Asterisk (*) or Ctrl+D -> Focus discount input for this row
                    if (e.key === "*" || (e.ctrlKey && e.key === "d")) {
                        e.preventDefault();
                        setTimeout(() => {
                            const discountInput = document.getElementById(`discount-input-${focusedCartIndex}`);
                            if (discountInput) {
                                (discountInput as HTMLInputElement).focus();
                                (discountInput as HTMLInputElement).select();
                            }
                        }, 50);
                        return;
                    }

                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [cartItems, isProcessing, showHoldOrders, showShortcutsHelp, focusedCartIndex, handleHold, loadHoldOrders, handleQuantityChange, handleRemoveItem, canHold, canViewHolds, handleCheckout]);

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

    // ─── Derived state ──────────────────────────────────────────────
    const subtotal = cartItems.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const totalDiscount = cartItems.reduce((acc, item) => acc + item.discountAmount, 0);
    const totalTax = cartItems.reduce((acc, item) => acc + item.taxAmount, 0);
    const grandTotal = cartItems.reduce((acc, item) => acc + item.total, 0);

    return (
        <div className="space-y-4 mt-4">
            {/* Keyboard shortcut hints */}
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground font-mono flex-wrap bg-muted/20 px-3 py-2 rounded-lg border border-primary/10">
                <span className="px-1.5 py-0.5 rounded bg-primary text-primary-foreground font-bold shadow-sm animate-pulse">F1</span>
                <span className="font-bold text-foreground">Shortcut Guide</span>
                <span className="text-border">|</span>
                <span className="px-1.5 py-0.5 rounded bg-muted">F2</span>
                <span>Search</span>
                <span className="text-border">|</span>
                <span className="px-1.5 py-0.5 rounded bg-muted">Enter</span>
                <span>Scan</span>
                <span className="text-border">|</span>
                <span className="px-1.5 py-0.5 rounded bg-muted">F9 / F4</span>
                <span>Checkout</span>
                <span className="text-border">|</span>
                <span className="px-1.5 py-0.5 rounded bg-muted">Esc</span>
                <span>Clear</span>
                <span className="text-border">|</span>
                <span className="px-1.5 py-0.5 rounded bg-muted">F8</span>
                <span>Hold / View Holds</span>
                <span className="text-border">|</span>
                <span className="px-1.5 py-0.5 rounded bg-muted">↑/↓</span>
                <span>Navigate Rows</span>
                <span className="text-border">|</span>
                <span className="px-1.5 py-0.5 rounded bg-muted">+/-</span>
                <span>Qty</span>
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
                focusedIndex={focusedCartIndex}
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

            {/* Keyboard Shortcuts Floating Help HUD */}
            <div className={cn(
                "fixed bottom-20 right-6 z-[9999] w-80 rounded-xl border border-primary/20 bg-background/95 backdrop-blur-md shadow-2xl transition-all duration-300 transform",
                showShortcutsHelp ? "translate-y-0 opacity-100 scale-100" : "translate-y-4 opacity-0 scale-95 pointer-events-none"
            )}>
                <div className="flex items-center justify-between border-b px-4 py-3 bg-primary/5 rounded-t-xl">
                    <div className="flex items-center gap-2">
                        <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="font-semibold text-xs uppercase tracking-wider text-foreground">Keyboard Guide</span>
                    </div>
                    <button 
                        onClick={() => setShowShortcutsHelp(false)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground transition-colors font-mono"
                    >
                        Esc to hide
                    </button>
                </div>
                <div className="p-4 space-y-3.5 max-h-[350px] overflow-y-auto text-xs">
                    <div>
                        <p className="font-bold text-[10px] uppercase tracking-wider text-primary mb-1.5 text-left">New Sale Page</p>
                        <div className="space-y-1.5 font-medium">
                            <div className="flex justify-between items-center"><span className="text-muted-foreground">Search / Scan Product</span><kbd className="px-1.5 py-0.5 bg-muted border rounded text-[10px] font-mono">F2</kbd></div>
                            <div className="flex justify-between items-center"><span className="text-muted-foreground">Select Autocomplete</span><kbd className="px-1.5 py-0.5 bg-muted border rounded text-[10px] font-mono">↑ / ↓ + Enter</kbd></div>
                            <div className="flex justify-between items-center"><span className="text-muted-foreground">Proceed to Checkout</span><kbd className="px-1.5 py-0.5 bg-muted border rounded text-[10px] font-mono">F9 / F4</kbd></div>
                            <div className="flex justify-between items-center"><span className="text-muted-foreground">Hold Order / View Holds</span><kbd className="px-1.5 py-0.5 bg-muted border rounded text-[10px] font-mono">F8</kbd></div>
                            <div className="flex justify-between items-center"><span className="text-muted-foreground">Clear Cart</span><kbd className="px-1.5 py-0.5 bg-muted border rounded text-[10px] font-mono">Esc</kbd></div>
                        </div>
                    </div>
                    <div className="border-t pt-2.5">
                        <p className="font-bold text-[10px] uppercase tracking-wider text-primary mb-1.5 text-left">Cart Navigation (No Input Focused)</p>
                        <div className="space-y-1.5 font-medium">
                            <div className="flex justify-between items-center"><span className="text-muted-foreground">Highlight Cart Row</span><kbd className="px-1.5 py-0.5 bg-muted border rounded text-[10px] font-mono">↑ / ↓</kbd></div>
                            <div className="flex justify-between items-center"><span className="text-muted-foreground">Increment Qty</span><kbd className="px-1.5 py-0.5 bg-muted border rounded text-[10px] font-mono">+</kbd></div>
                            <div className="flex justify-between items-center"><span className="text-muted-foreground">Decrement Qty</span><kbd className="px-1.5 py-0.5 bg-muted border rounded text-[10px] font-mono">-</kbd></div>
                            <div className="flex justify-between items-center"><span className="text-muted-foreground">Delete Item</span><kbd className="px-1.5 py-0.5 bg-muted border rounded text-[10px] font-mono">Del / Backspace</kbd></div>
                            <div className="flex justify-between items-center"><span className="text-muted-foreground">Edit Item Discount %</span><kbd className="px-1.5 py-0.5 bg-muted border rounded text-[10px] font-mono">*</kbd></div>
                        </div>
                    </div>
                    <div className="border-t pt-2.5 text-[10px] text-muted-foreground text-center">
                        Press <span className="font-bold text-foreground">F1</span> or <span className="font-bold text-foreground">Ctrl + /</span> at any time.
                    </div>
                </div>
            </div>

            {/* Shortcuts Toggle Trigger */}
            <button
                onClick={() => setShowShortcutsHelp(v => !v)}
                className="fixed bottom-6 right-6 z-[9998] flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-full shadow-lg hover:bg-primary/90 transition-all animate-bounce"
            >
                <kbd className="px-1 bg-primary-foreground/20 rounded text-[9px] font-mono">F1</kbd>
                <span>Shortcut Guide</span>
            </button>
        </div>
    );
}
