"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
    Tag, TicketPercent, Handshake, Wallet, Loader2, Search,
    CheckCircle2, XCircle, ChevronDown, ChevronUp, Percent,
} from "lucide-react";
import type { CartItem } from "@/components/pos/new-sale/cart-table";
import { cn } from "@/lib/utils";
import type { PromoConfig, AllianceConfig, AppliedCoupon, DiscountMode, Tender } from "./page";

interface DiscountPanelProps {
    // Modes & data
    discountMode: DiscountMode;
    isLoadingConfig: boolean;
    canPromo: boolean;
    canCoupon: boolean;
    canAlliance: boolean;
    canManualDiscount: boolean;
    tenders?: Tender[];
    // Computed
    orderDiscount: number;
    itemDiscounts: number;
    finalItemDiscounts: number;
    subtotal: number;
    subtotalAfterItems: number;
    cartItems: CartItem[];
    // Promos
    promos: PromoConfig[];
    selectedPromo: PromoConfig | null;
    promoScopeAll: boolean;
    promoScopedItems: Set<string>;
    showPromoScope: boolean;
    onSelectPromo: (promo: PromoConfig) => void;
    onSetPromoScopeAll: (v: boolean) => void;
    onSetPromoScopedItems: (items: Set<string>) => void;
    onTogglePromoScope: () => void;
    // Coupon
    couponInput: string;
    couponError: string;
    isValidatingCoupon: boolean;
    appliedCoupon: AppliedCoupon | null;
    couponInputRef: React.RefObject<HTMLInputElement | null>;
    onCouponInputChange: (val: string) => void;
    onValidateCoupon: () => void;
    // Alliance
    alliances: AllianceConfig[];
    selectedAlliance: AllianceConfig | null;
    allianceSearch: string;
    allianceDetailsRef: React.RefObject<HTMLDetailsElement | null>;
    allianceSearchRef: React.RefObject<HTMLInputElement | null>;
    onAllianceSearch: (val: string) => void;
    onSelectAlliance: (a: AllianceConfig) => void;
    // Manual discount
    manualDiscountType: "percent" | "flat";
    manualDiscountValue: number;
    onManualDiscountTypeChange: (t: "percent" | "flat") => void;
    onManualDiscountValueChange: (v: number) => void;
    // Clear
    onClearDiscount: () => void;
    // Helpers
    fmtCurrency: (v: number) => string;
    calcPromoDiscount: (promo: PromoConfig, subtotal: number) => number;
}

export function DiscountPanel({
    discountMode, isLoadingConfig, canPromo, canCoupon, canAlliance, canManualDiscount,
    tenders = [],
    orderDiscount, itemDiscounts, finalItemDiscounts, subtotal, subtotalAfterItems, cartItems,
    promos, selectedPromo, promoScopeAll, promoScopedItems, showPromoScope,
    onSelectPromo, onSetPromoScopeAll, onSetPromoScopedItems, onTogglePromoScope,
    couponInput, couponError, isValidatingCoupon, appliedCoupon, couponInputRef,
    onCouponInputChange, onValidateCoupon,
    alliances, selectedAlliance, allianceSearch,
    allianceDetailsRef, allianceSearchRef,
    onAllianceSearch, onSelectAlliance,
    manualDiscountType, manualDiscountValue,
    onManualDiscountTypeChange, onManualDiscountValueChange,
    onClearDiscount, fmtCurrency, calcPromoDiscount,
}: DiscountPanelProps) {

    const hasCashTender = tenders.some((t) => t.method === "cash");

    const filteredAlliances = alliances.filter(
        (a) =>
            a.partnerName.toLowerCase().includes(allianceSearch.toLowerCase()) ||
            a.code.toLowerCase().includes(allianceSearch.toLowerCase()) ||
            (allianceSearch.match(/^\d+/) && a.binNumbers.some((bin) => bin.startsWith(allianceSearch.trim())))
    );

    return (
        <div className="flex flex-col gap-3 h-full overflow-y-auto pr-0.5">

            {/* Active discount chip */}
            {discountMode !== "none" && orderDiscount > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    <div className="flex-1 text-sm">
                        <span className="font-medium">
                            {discountMode === "promo" && selectedPromo?.name}
                            {discountMode === "coupon" && `Coupon: ${appliedCoupon?.code}`}
                            {discountMode === "alliance" && selectedAlliance?.partnerName}
                            {discountMode === "manual" && "Manual Discount"}
                        </span>
                        <span className="text-muted-foreground ml-2 font-mono">−{fmtCurrency(orderDiscount)}</span>
                        {discountMode === "alliance" && finalItemDiscounts === 0 && itemDiscounts > 0 && (
                            <span className="text-xs text-muted-foreground ml-2">(replaces item discounts)</span>
                        )}
                    </div>
                    <button onClick={onClearDiscount} className="text-muted-foreground hover:text-foreground">
                        <XCircle className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* Alliance selected but item discounts are better */}
            {discountMode === "alliance" && selectedAlliance && orderDiscount === 0 && itemDiscounts > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-300/50 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-2">
                    <XCircle className="h-4 w-4 text-amber-500 shrink-0" />
                    <div className="flex-1 text-sm">
                        <span className="font-medium text-amber-700 dark:text-amber-400">{selectedAlliance.partnerName}</span>
                        <span className="text-xs text-muted-foreground ml-2">
                            Item discounts ({fmtCurrency(itemDiscounts)}) are more beneficial — alliance not applied
                        </span>
                    </div>
                    <button onClick={onClearDiscount} className="text-muted-foreground hover:text-foreground">
                        <XCircle className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* Discount accordion */}
            <div className="rounded-xl border bg-card overflow-hidden">

                {/* ── Promos ── */}
                {canPromo && (
                    <details
                        className={cn("group", discountMode !== "none" && discountMode !== "promo" && "opacity-50 pointer-events-none")}
                        open
                    >
                        <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none bg-muted/30 hover:bg-muted/50 transition-colors border-b">
                            <Tag className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold text-sm flex-1">Promo Campaigns</span>
                            {selectedPromo && <Badge variant="secondary" className="text-xs">{selectedPromo.code}</Badge>}
                            {discountMode !== "none" && discountMode !== "promo" && (
                                <Badge variant="outline" className="text-[10px]">Disabled</Badge>
                            )}
                        </summary>
                        <div className="p-3">
                            {isLoadingConfig ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                                </div>
                            ) : promos.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic py-2">No active promos for this location.</p>
                            ) : (
                                <div className="space-y-2">
                                    <div className="max-h-[200px] overflow-y-auto">
                                        <div className="space-y-2 pr-1">
                                            {promos.map((promo) => {
                                                const discount = calcPromoDiscount(promo, subtotalAfterItems);
                                                const isSelected = selectedPromo?.id === promo.id && discountMode === "promo";
                                                const disabled = discountMode !== "none" && !isSelected;
                                                return (
                                                    <div key={promo.id}>
                                                        <button
                                                            disabled={disabled}
                                                            onClick={() => {
                                                                if (isSelected) { onClearDiscount(); return; }
                                                                onSelectPromo(promo);
                                                            }}
                                                            className={cn(
                                                                "w-full text-left rounded-lg border px-3 py-2 transition-all text-sm",
                                                                isSelected ? "border-primary bg-primary/10 ring-1 ring-primary" : "hover:border-muted-foreground",
                                                                disabled && "opacity-40 cursor-not-allowed"
                                                            )}
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <div>
                                                                    <p className="font-semibold">{promo.name}</p>
                                                                    <p className="text-xs text-muted-foreground font-mono">{promo.code}</p>
                                                                </div>
                                                                <div className="text-right">
                                                                    <p className="font-bold text-primary font-mono">−{fmtCurrency(discount)}</p>
                                                                    <p className="text-xs text-muted-foreground">
                                                                        {promo.type === "percent" ? `${promo.value}%` : promo.type === "fixed" ? `Flat ${fmtCurrency(Number(promo.value))} off` : "Buy X Get Y"}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </button>

                                                        {/* Per-item scope selector */}
                                                        {isSelected && (
                                                            <div className="mt-2 border rounded-lg px-3 py-2 bg-muted/20 space-y-2">
                                                                <button
                                                                    onClick={onTogglePromoScope}
                                                                    className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                                                                >
                                                                    {showPromoScope ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                                                    Apply to: {promoScopeAll ? "All items" : `${promoScopedItems.size} item(s)`}
                                                                </button>
                                                                {showPromoScope && (
                                                                    <div className="space-y-1.5">
                                                                        <label className="flex items-center gap-2 text-xs cursor-pointer">
                                                                            <Checkbox
                                                                                checked={promoScopeAll}
                                                                                onCheckedChange={(v) => {
                                                                                    onSetPromoScopeAll(!!v);
                                                                                    if (v) onSetPromoScopedItems(new Set(cartItems.map((i) => i.id)));
                                                                                    else onSetPromoScopedItems(new Set());
                                                                                }}
                                                                            />
                                                                            <span className="font-medium">All items</span>
                                                                        </label>
                                                                        {cartItems.map((item) => (
                                                                            <label key={item.id} className="flex items-center gap-2 text-xs cursor-pointer ml-1">
                                                                                <Checkbox
                                                                                    checked={promoScopedItems.has(item.id)}
                                                                                    onCheckedChange={(v) => {
                                                                                        const next = new Set(promoScopedItems);
                                                                                        v ? next.add(item.id) : next.delete(item.id);
                                                                                        onSetPromoScopedItems(next);
                                                                                        onSetPromoScopeAll(next.size === cartItems.length);
                                                                                    }}
                                                                                />
                                                                                <span className="truncate">{item.name}</span>
                                                                                <span className="font-mono text-muted-foreground ml-auto">{fmtCurrency(item.total)}</span>
                                                                            </label>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </details>
                )}

                {canCoupon && <Separator />}

                {/* ── Coupon Code ── */}
                {canCoupon && (
                    <details className={cn(discountMode !== "none" && discountMode !== "coupon" && "opacity-50 pointer-events-none")}>
                        <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none bg-muted/30 hover:bg-muted/50 transition-colors border-b">
                            <TicketPercent className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold text-sm flex-1">Coupon / Voucher Code</span>
                            {appliedCoupon && <Badge variant="secondary" className="text-xs">{appliedCoupon.code}</Badge>}
                            {discountMode !== "none" && discountMode !== "coupon" && (
                                <Badge variant="outline" className="text-[10px]">Disabled</Badge>
                            )}
                        </summary>
                        <div className="p-3 space-y-2">
                            <div className="flex gap-2">
                                <Input
                                    ref={couponInputRef}
                                    className="uppercase font-mono flex-1"
                                    placeholder="Coupon or voucher code... (F2)"
                                    value={couponInput}
                                    onChange={(e) => onCouponInputChange(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && onValidateCoupon()}
                                    disabled={!!appliedCoupon || (discountMode !== "none" && discountMode !== "coupon")}
                                />
                                <Button size="sm" onClick={onValidateCoupon}
                                    disabled={isValidatingCoupon || !couponInput.trim() || (discountMode !== "none" && discountMode !== "coupon")}>
                                    {isValidatingCoupon ? <Loader2 className="h-4 w-4 animate-spin" /> : "Apply"}
                                </Button>
                            </div>
                            {couponError && <p className="text-xs text-destructive">{couponError}</p>}
                            {appliedCoupon?.description && <p className="text-xs text-muted-foreground">{appliedCoupon.description}</p>}
                        </div>
                    </details>
                )}

                {canAlliance && <Separator />}

                {/* ── Alliances ── */}
                {canAlliance && (
                    <details
                        ref={allianceDetailsRef}
                        className={cn(
                            (discountMode !== "none" && discountMode !== "alliance") && "opacity-50 pointer-events-none",
                            hasCashTender && "opacity-50 pointer-events-none"
                        )}
                        open={hasCashTender ? false : undefined}
                    >
                        <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none bg-muted/30 hover:bg-muted/50 transition-colors">
                            <Handshake className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold text-sm flex-1">Alliance / Bank Card</span>
                            {selectedAlliance && <Badge variant="secondary" className="text-xs">{selectedAlliance.code}</Badge>}
                            {hasCashTender ? (
                                <Badge variant="destructive" className="text-[10px]">Disabled (Cash added)</Badge>
                            ) : discountMode !== "none" && discountMode !== "alliance" && (
                                <Badge variant="outline" className="text-[10px]">Disabled</Badge>
                            )}
                        </summary>
                        <div className="p-3 space-y-2">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                    ref={allianceSearchRef}
                                    className="pl-8 text-sm"
                                    placeholder="Search bank, card type, or BIN... (F3)"
                                    value={allianceSearch}
                                    onChange={(e) => onAllianceSearch(e.target.value)}
                                />
                            </div>
                            {isLoadingConfig ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                                </div>
                            ) : (
                                <div className="max-h-[200px] overflow-y-auto">
                                    <div className="space-y-1.5 pr-1">
                                        {filteredAlliances.length === 0 && (
                                            <p className="text-xs text-muted-foreground italic py-1">No matching alliances.</p>
                                        )}
                                        {filteredAlliances.map((a) => {
                                            let disc = 0;
                                            const allianceBase = subtotal;
                                            if (a.maxDiscount) {
                                                disc = Math.min(
                                                    Math.round(allianceBase * (Number(a.discountPercent) / 100) * 100) / 100,
                                                    Number(a.maxDiscount)
                                                );
                                            } else {
                                                disc = Math.round(allianceBase * (Number(a.discountPercent) / 100) * 100) / 100;
                                            }
                                            const isSelected = selectedAlliance?.id === a.id && discountMode === "alliance";
                                            const disabled = discountMode !== "none" && !isSelected;
                                            return (
                                                <div key={a.id}>
                                                    <button
                                                        disabled={disabled}
                                                        onClick={() => {
                                                            if (isSelected) { onClearDiscount(); return; }
                                                            onSelectAlliance(a);
                                                        }}
                                                        className={cn(
                                                            "w-full text-left rounded-lg border px-3 py-2 transition-all text-sm",
                                                            isSelected ? "border-primary bg-primary/10 ring-1 ring-primary" : "hover:border-muted-foreground",
                                                            disabled && "opacity-40 cursor-not-allowed"
                                                        )}
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div>
                                                                <p className="font-medium text-xs">{a.partnerName}</p>
                                                                <p className="text-[10px] text-muted-foreground">{a.description || a.code}</p>
                                                                {a.binNumbers.length > 0 && (
                                                                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                                                                        BIN: {a.binNumbers.slice(0, 3).join(", ")}{a.binNumbers.length > 3 ? ` +${a.binNumbers.length - 3}` : ""}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <div className="text-right shrink-0 ml-2">
                                                                <p className="font-bold text-primary font-mono text-xs">−{fmtCurrency(disc)}</p>
                                                                <p className="text-[10px] text-muted-foreground">{a.discountPercent}% off</p>
                                                            </div>
                                                        </div>
                                                    </button>

                                                    {/* Alliance selected — card details are captured in the Payment section */}
                                                    {isSelected && (
                                                        <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                                                            <p className="text-xs text-primary font-medium">
                                                                ✓ Alliance selected — enter card details in the Payment section below.
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </details>
                )}

                {canManualDiscount && <Separator />}

                {/* ── Manual Global Discount ── */}
                {canManualDiscount && (
                    <details className={cn(discountMode !== "none" && discountMode !== "manual" && "opacity-50 pointer-events-none")}>
                        <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer select-none bg-muted/30 hover:bg-muted/50 transition-colors">
                            <Wallet className="h-4 w-4 text-muted-foreground" />
                            <span className="font-semibold text-sm flex-1">Manual Discount</span>
                            {discountMode === "manual" && orderDiscount > 0 &&
                                <Badge variant="secondary" className="text-xs">−{fmtCurrency(orderDiscount)}</Badge>}
                            {discountMode !== "none" && discountMode !== "manual" && (
                                <Badge variant="outline" className="text-[10px]">Disabled</Badge>
                            )}
                        </summary>
                        <div className="p-3 space-y-3">
                            <RadioGroup
                                value={manualDiscountType}
                                onValueChange={(v: any) => onManualDiscountTypeChange(v)}
                                className="flex gap-4"
                                disabled={discountMode !== "none" && discountMode !== "manual"}
                            >
                                <div className="flex items-center gap-1.5">
                                    <RadioGroupItem value="percent" id="disc-pct" />
                                    <Label htmlFor="disc-pct" className="text-sm flex items-center gap-1">
                                        <Percent className="h-3 w-3" /> Percentage
                                    </Label>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <RadioGroupItem value="flat" id="disc-flat" />
                                    <Label htmlFor="disc-flat" className="text-sm">Flat PKR</Label>
                                </div>
                            </RadioGroup>
                            <div className="flex gap-2">
                                <Input
                                    type="number"
                                    min={0}
                                    max={manualDiscountType === "percent" ? 100 : undefined}
                                    className="font-mono"
                                    placeholder={manualDiscountType === "percent" ? "0 – 100" : "Amount"}
                                    value={manualDiscountValue || ""}
                                    onChange={(e) => onManualDiscountValueChange(parseFloat(e.target.value) || 0)}
                                    disabled={discountMode !== "none" && discountMode !== "manual"}
                                />
                                {discountMode === "manual" && (
                                    <Button variant="ghost" size="icon" onClick={onClearDiscount}>
                                        <XCircle className="h-4 w-4 text-muted-foreground" />
                                    </Button>
                                )}
                            </div>
                            {discountMode === "manual" && orderDiscount > 0 && (
                                <p className="text-xs text-primary font-semibold">Discount: −{fmtCurrency(orderDiscount)}</p>
                            )}
                        </div>
                    </details>
                )}
            </div>
        </div>
    );
}
