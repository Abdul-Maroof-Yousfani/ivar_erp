"use client";

import React from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Loader2, ShoppingCart, UserRound, Search, Plus, CheckCircle2, Trash2,
} from "lucide-react";
import type { CartItem } from "@/components/pos/new-sale/cart-table";
import type { Customer } from "./page";
import { cn } from "@/lib/utils";
import type { DiscountMode } from "./page";

interface OrderSummaryProps {
    // Cashier
    cashiers: any[];
    selectedCashierId: string;
    isLoadingCashiers: boolean;
    onCashierChange: (id: string) => void;
    // Customer
    customers: Customer[];
    selectedCustomer: Customer | null;
    customerSearch: string;
    isLoadingCustomers: boolean;
    requireCustomer: boolean;
    canAddCustomer: boolean;
    onCustomerChange: (val: string) => void;
    onCustomerSearch: (val: string) => void;
    onAddCustomer: () => void;
    onClearCustomer: () => void;
    // Cart items
    cartItems: CartItem[];
    discountMode: DiscountMode;
    orderDiscount: number;
    allianceSharePerItem: number[];
    fmtCurrency: (v: number) => string;
}

export function OrderSummary({
    cashiers, selectedCashierId, isLoadingCashiers, onCashierChange,
    customers, selectedCustomer, customerSearch, isLoadingCustomers,
    requireCustomer, canAddCustomer, onCustomerChange, onCustomerSearch,
    onAddCustomer, onClearCustomer,
    cartItems, discountMode, orderDiscount, allianceSharePerItem, fmtCurrency,
}: OrderSummaryProps) {
    const [showDropdown, setShowDropdown] = React.useState(false);
    const [activeIndex, setActiveIndex] = React.useState(-1);
    const customerSearchRef = React.useRef<HTMLInputElement>(null);

    // Reset active index when customers change
    React.useEffect(() => {
        setActiveIndex(-1);
    }, [customers]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!showDropdown) {
            if (e.key === "ArrowDown" || e.key === "Enter") {
                setShowDropdown(true);
                e.preventDefault();
            }
            return;
        }

        // Options: Walk-in + matches
        const options = ["walk-in", ...customers.map(c => c.id)];

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex(prev => (prev + 1) % options.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex(prev => (prev - 1 + options.length) % options.length);
        } else if (e.key === "Enter") {
            e.preventDefault();
            const idx = activeIndex >= 0 ? activeIndex : 0;
            if (idx < options.length) {
                onCustomerChange(options[idx]);
                setShowDropdown(false);
                customerSearchRef.current?.blur();
            }
        } else if (e.key === "Escape") {
            e.preventDefault();
            setShowDropdown(false);
            customerSearchRef.current?.blur();
        }
    };

    return (
        <div className="rounded-xl border bg-card flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                <span className="font-semibold text-sm">Order Summary</span>
            </div>

            {/* Salesman Selection */}
            <div className="px-4 py-4 border-b space-y-3 bg-muted/5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <UserRound className="h-3 w-3" /> Salesman
                </Label>
                <Select value={selectedCashierId} onValueChange={onCashierChange}>
                    <SelectTrigger 
                        id="cashier-select-trigger"
                        className="w-full bg-muted/20 border-none h-10 px-3 font-medium"
                    >
                        <SelectValue placeholder={isLoadingCashiers ? "Loading salesmen..." : "Select Salesman"} />
                    </SelectTrigger>
                    <SelectContent>
                        {isLoadingCashiers ? (
                            <div className="p-4 text-center text-xs text-muted-foreground">
                                <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1" /> Loading...
                            </div>
                        ) : cashiers.length === 0 ? (
                            <div className="p-4 text-center text-xs text-muted-foreground">
                                No salesmen found for this location
                            </div>
                        ) : (
                            cashiers.map((c) => (
                                <SelectItem key={c.userId} value={c.userId}>
                                    <div className="flex flex-col">
                                        <span className="font-medium">{c.name}</span>
                                        <span className="text-[10px] opacity-70 font-mono">{c.empCode} · {c.email}</span>
                                    </div>
                                </SelectItem>
                            ))
                        )}
                    </SelectContent>
                </Select>
            </div>

            {/* Customer Section */}
            <div className="px-4 py-4 border-b space-y-3">
                <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        Customer{requireCustomer && <span className="text-destructive ml-1">*</span>}
                    </Label>
                    <span className="text-[9px] font-mono text-primary font-bold uppercase">[F6] Search</span>
                </div>
                <div className="flex gap-2 relative">
                    <div className="flex-1 relative">
                        <Input
                            id="customer-search-input"
                            ref={customerSearchRef}
                            placeholder="Search name, phone or code... (F6)"
                            value={customerSearch}
                            onChange={(e) => {
                                onCustomerSearch(e.target.value);
                                setShowDropdown(true);
                            }}
                            onFocus={() => setShowDropdown(true)}
                            onBlur={() => {
                                // Delay blur to allow item click selection
                                setTimeout(() => setShowDropdown(false), 200);
                            }}
                            onKeyDown={handleKeyDown}
                            className="w-full bg-muted/20 border-none h-10 px-3 text-sm focus-visible:ring-1 focus-visible:ring-primary"
                        />

                        {showDropdown && (
                            <div className="absolute left-0 right-0 top-11 bg-popover border border-border shadow-md rounded-md overflow-hidden z-[500] max-h-64 overflow-y-auto">
                                <ul className="flex flex-col">
                                    <li
                                        className={cn(
                                            "px-4 py-2 hover:bg-muted cursor-pointer flex items-center justify-between border-b border-border/50 transition-colors text-xs font-semibold",
                                            (activeIndex === 0) && "bg-primary/10 border-l-4 border-l-primary"
                                        )}
                                        onMouseDown={() => {
                                            onCustomerChange("walk-in");
                                            setShowDropdown(false);
                                        }}
                                    >
                                        Walk-in Customer
                                    </li>
                                    {isLoadingCustomers ? (
                                        <div className="p-3 text-center text-xs text-muted-foreground flex items-center justify-center">
                                            <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Loading...
                                        </div>
                                    ) : customers.length === 0 ? (
                                        <div className="p-3 text-center text-xs text-muted-foreground italic">
                                            No matching customers
                                        </div>
                                    ) : (
                                        customers.map((c, idx) => (
                                            <li
                                                key={c.id}
                                                className={cn(
                                                    "px-4 py-2 hover:bg-muted cursor-pointer flex flex-col border-b border-border/50 last:border-0 transition-colors text-left",
                                                    (idx + 1 === activeIndex) && "bg-primary/10 border-l-4 border-l-primary"
                                                )}
                                                onMouseDown={() => {
                                                    onCustomerChange(c.id);
                                                    setShowDropdown(false);
                                                }}
                                            >
                                                <span className="font-semibold text-xs">{c.name}</span>
                                                <span className="text-[10px] text-muted-foreground">{c.contactNo || c.code}</span>
                                            </li>
                                        ))
                                    )}
                                </ul>
                            </div>
                        )}
                    </div>
                    <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 shrink-0 bg-muted/20 border-none hover:bg-muted/40"
                        disabled={!canAddCustomer}
                        onClick={onAddCustomer}
                        title="Add Customer (Alt+N)"
                    >
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>

                {selectedCustomer && (
                    <div className="flex items-start gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 animate-in fade-in slide-in-from-top-1">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-emerald-500 leading-none">{selectedCustomer.name}</p>
                            <p className="text-[10px] text-muted-foreground mt-1 truncate">{selectedCustomer.contactNo || "No contact"} · {selectedCustomer.code}</p>
                        </div>
                        <button
                            onClick={onClearCustomer}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                            <Trash2 className="h-3 w-3" />
                        </button>
                    </div>
                )}
            </div>

            {/* Cart Items List */}
            <ScrollArea className="flex-1">
                <div className="divide-y">
                    {cartItems.map((item, idx) => {
                        const isOrderDiscountApplied =
                            (discountMode === "alliance" || discountMode === "coupon" || discountMode === "manual") && orderDiscount > 0;
                        const orderDiscountShare = isOrderDiscountApplied ? allianceSharePerItem[idx] : 0;

                        const retailPrice = item.price;
                        const taxDivisor = 1 + (item.taxPercent / 100);
                        const wostPerUnit = retailPrice / taxDivisor;
                        const totalWost = wostPerUnit * item.quantity;

                        const showItemDiscount =
                            !isOrderDiscountApplied &&
                            (item.overrideDiscountPercent ?? item.discountPercent) > 0;
                        const discountPercent = item.overrideDiscountPercent ?? item.discountPercent;
                        const calculatedDiscount = showItemDiscount
                            ? Math.round(totalWost * (discountPercent / 100))
                            : 0;

                        const finalDiscount = isOrderDiscountApplied ? orderDiscountShare : calculatedDiscount;
                        const afterDiscount = totalWost - finalDiscount;
                        const calculatedTax = Math.round(afterDiscount * (item.taxPercent / 100));
                        const calculatedTotal = afterDiscount + calculatedTax;

                        return (
                            <div key={item.id} className="flex items-start gap-3 px-4 py-3">
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate">{item.name}</p>
                                    <p className="text-xs text-muted-foreground">{item.sku} · {item.brand}</p>

                                    <div className="mt-2 space-y-0.5 text-xs text-muted-foreground font-mono">
                                        <div className="flex justify-between">
                                            <span>Retail:</span>
                                            <span>{item.quantity} × {fmtCurrency(retailPrice)} = {fmtCurrency(retailPrice * item.quantity)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>WOST:</span>
                                            <span>{fmtCurrency(wostPerUnit)} × {item.quantity} = {fmtCurrency(totalWost)}</span>
                                        </div>
                                        {finalDiscount > 0 && (
                                            <div className="flex justify-between text-destructive">
                                                <span>
                                                    Discount {isOrderDiscountApplied
                                                        ? `(${discountMode === "alliance" ? "Alliance" : discountMode === "coupon" ? "Coupon" : "Manual"})`
                                                        : `${discountPercent}%`
                                                    }:
                                                </span>
                                                <span>−{fmtCurrency(finalDiscount)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between">
                                            <span>After Discount:</span>
                                            <span>{fmtCurrency(afterDiscount)}</span>
                                        </div>
                                        {item.taxPercent > 0 && (
                                            <div className="flex justify-between text-amber-600 dark:text-amber-400">
                                                <span>Tax {item.taxPercent}%:</span>
                                                <span>+{fmtCurrency(calculatedTax)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between font-semibold text-foreground border-t pt-0.5 mt-0.5">
                                            <span>Total:</span>
                                            <span>{fmtCurrency(calculatedTotal)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </ScrollArea>
        </div>
    );
}
