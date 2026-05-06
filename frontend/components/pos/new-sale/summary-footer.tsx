"use client";

import { Button } from "@/components/ui/button";
import { ArrowRight, PauseCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface SummaryFooterProps {
    subtotal: number;
    discount: number;
    tax: number;
    grandTotal: number;
    onCheckout: () => void;
    onHold?: () => void;
    disabled?: boolean;
}

export function SummaryFooter({
    subtotal,
    discount,
    tax,
    grandTotal,
    onCheckout,
    onHold,
    disabled = false,
}: SummaryFooterProps) {
    return (
        <div className="sticky bottom-0 z-0 rounded-xl border bg-card shadow-md p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                {/* Summary values */}
                <div className="flex items-center gap-8 flex-wrap">
                    {/* Subtotal */}
                    <div className="flex flex-col">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Subtotal
                        </span>
                        <span className="text-xl font-bold tabular-nums">
                            {formatCurrency(subtotal)}
                        </span>
                    </div>

                    {/* Discount */}
                    <div className="flex flex-col">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Discount
                        </span>
                        <span className="text-xl font-bold tabular-nums text-primary">
                            {formatCurrency(discount)}
                        </span>
                    </div>

                    {/* Tax */}
                    <div className="flex flex-col">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Tax
                        </span>
                        <span className="text-xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
                            {formatCurrency(tax)}
                        </span>
                    </div>

                    {/* Grand Total */}
                    <div className="flex flex-col">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Grand Total
                        </span>
                        <span className="text-3xl font-extrabold tabular-nums">
                            {formatCurrency(grandTotal)}
                        </span>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3">
                    {onHold && (
                        <Button
                            onClick={onHold}
                            disabled={disabled}
                            size="lg"
                            variant="outline"
                            className="border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 font-bold text-base px-6 h-14 rounded-xl"
                        >
                            <PauseCircle className="h-5 w-5 mr-2" />
                            HOLD
                            <span className="ml-2 text-[10px] font-mono bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 rounded">F8</span>
                        </Button>
                    )}
                    <Button
                        onClick={onCheckout}
                        disabled={disabled}
                        size="lg"
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base px-8 h-14 rounded-xl shadow-lg hover:shadow-xl transition-all min-w-[200px]"
                    >
                        CHECKOUT
                        <ArrowRight className="h-5 w-5 ml-2" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
