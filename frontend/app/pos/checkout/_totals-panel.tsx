"use client";

import { Separator } from "@/components/ui/separator";
import type { PromoConfig, AllianceConfig, AppliedCoupon, DiscountMode } from "./page";

export const FBR_POS_FEE = 1;

interface TotalsPanelProps {
    cartItemCount: number;
    subtotal: number;
    finalItemDiscounts: number;
    itemDiscounts: number;
    discountMode: DiscountMode;
    selectedPromo: PromoConfig | null;
    appliedCoupon: AppliedCoupon | null;
    selectedAlliance: AllianceConfig | null;
    orderDiscount: number;
    itemTax: number;
    fbrPosFee: number;
    grandTotal: number;
    fmtCurrency: (v: number) => string;
}

export function TotalsPanel({
    cartItemCount, subtotal, finalItemDiscounts, itemDiscounts,
    discountMode, selectedPromo, appliedCoupon, selectedAlliance,
    orderDiscount, itemTax, fbrPosFee, grandTotal, fmtCurrency,
}: TotalsPanelProps) {
    return (
        <div className="rounded-xl border bg-card px-4 py-3 space-y-2 text-sm">
            {/* Subtotal */}
            <div className="flex justify-between text-muted-foreground">
                <span>Subtotal ({cartItemCount} item{cartItemCount !== 1 ? "s" : ""})</span>
                <span className="font-mono">{fmtCurrency(subtotal)}</span>
            </div>

            {/* Item Discounts */}
            {finalItemDiscounts > 0 && (
                <div className="flex justify-between text-destructive">
                    <span>Item Discounts</span>
                    <span className="font-mono">−{fmtCurrency(finalItemDiscounts)}</span>
                </div>
            )}

            {/* Suppressed item discounts (alliance overrides) */}
            {discountMode === "alliance" && finalItemDiscounts === 0 && itemDiscounts > 0 && (
                <div className="flex justify-between text-muted-foreground line-through text-xs">
                    <span>Item Discounts (overridden)</span>
                    <span className="font-mono">−{fmtCurrency(itemDiscounts)}</span>
                </div>
            )}

            {/* Order-level discount label */}
            {orderDiscount > 0 && (
                <div className="flex justify-between text-primary">
                    <span>
                        {discountMode === "promo" && selectedPromo && `Promo: ${selectedPromo.code}`}
                        {discountMode === "coupon" && appliedCoupon && `Coupon: ${appliedCoupon.code}`}
                        {discountMode === "alliance" && selectedAlliance && `Alliance: ${selectedAlliance.code}`}
                        {discountMode === "manual" && "Manual Discount"}
                    </span>
                    <span className="font-mono">−{fmtCurrency(orderDiscount)}</span>
                </div>
            )}

            {/* Total Tax */}
            {itemTax > 0 && (
                <div className="flex justify-between text-amber-600 dark:text-amber-400">
                    <span>Total Tax</span>
                    <span className="font-mono">+{fmtCurrency(itemTax)}</span>
                </div>
            )}

            {/* FBR POS Fee */}
            <div className="flex justify-between text-amber-600 dark:text-amber-400">
                <span>FBR POS Fee</span>
                <span className="font-mono">+{fmtCurrency(fbrPosFee)}</span>
            </div>

            <Separator />

            {/* Grand Total */}
            <div className="flex justify-between text-lg font-bold">
                <span>Grand Total</span>
                <span className="font-mono">{fmtCurrency(grandTotal)}</span>
            </div>
        </div>
    );
}
