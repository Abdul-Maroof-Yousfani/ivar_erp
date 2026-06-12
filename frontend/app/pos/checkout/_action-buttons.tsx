"use client";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Loader2, PauseCircle, BookOpen, Receipt, Printer } from "lucide-react";
import type { Customer } from "./page";

interface ActionButtonsProps {
    isSubmitting: boolean;
    isHolding: boolean;
    balanceDue: number;
    changeAmount: number;
    cartItemCount: number;
    selectedCustomer: Customer | null;
    isGiftReceipt: boolean;
    canHold: boolean;
    onGiftReceiptChange: (v: boolean) => void;
    onHold: () => void;
    onCreditSale: () => void;
    onPreviewReceipt: () => void;
    onConfirm: () => void;
    fmtCurrency: (v: number) => string;
}

export function ActionButtons({
    isSubmitting, isHolding, balanceDue, changeAmount, cartItemCount,
    selectedCustomer, isGiftReceipt, canHold,
    onGiftReceiptChange, onHold, onCreditSale, onPreviewReceipt, onConfirm,
    fmtCurrency,
}: ActionButtonsProps) {
    return (
        <>
            {/* Gift Receipt Option */}
            <div className="rounded-xl border bg-card px-4 py-3">
                <div className="flex items-center gap-3">
                    <Checkbox
                        id="gift-receipt"
                        checked={isGiftReceipt}
                        onCheckedChange={(checked) => onGiftReceiptChange(checked as boolean)}
                    />
                    <div className="flex-1">
                        <Label htmlFor="gift-receipt" className="text-sm font-semibold cursor-pointer">
                            Gift Receipt
                        </Label>
                        <p className="text-xs text-muted-foreground">
                            Print receipt without price information
                        </p>
                    </div>
                </div>
            </div>

            {/* Action buttons layout */}
            <div className="flex flex-col gap-2">
                {/* Secondary Actions (Hold, Preview, Credit) */}
                {(canHold || (selectedCustomer && balanceDue > 0) || (balanceDue === 0 && cartItemCount > 0)) && (
                    <div className="flex gap-2 w-full">
                        {canHold && (
                            <Button
                                variant="outline"
                                size="lg"
                                className="h-12 flex-1 font-bold gap-2 rounded-xl border-amber-300 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                                onClick={onHold}
                                disabled={isSubmitting || isHolding || cartItemCount === 0}
                            >
                                {isHolding
                                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Holding...</>
                                    : <><PauseCircle className="h-4 w-4" /> Hold</>
                                }
                            </Button>
                        )}

                        {/* Credit Sale — only when customer selected and balance due */}
                        {selectedCustomer && balanceDue > 0 && (
                            <Button
                                variant="outline"
                                size="lg"
                                className="h-12 flex-1 font-bold gap-2 rounded-xl border-blue-300 text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                                onClick={onCreditSale}
                                disabled={isSubmitting || cartItemCount === 0}
                            >
                                {isSubmitting
                                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
                                    : <><BookOpen className="h-4 w-4" /> Credit Sale</>
                                }
                            </Button>
                        )}

                        {/* Preview Receipt — only when fully paid */}
                        {balanceDue === 0 && cartItemCount > 0 && (
                            <Button
                                variant="outline"
                                size="lg"
                                className="h-12 flex-1 font-bold gap-2 rounded-xl border-purple-300 text-purple-600 hover:bg-purple-50 hover:text-purple-700"
                                onClick={onPreviewReceipt}
                                disabled={isSubmitting}
                            >
                                <Receipt className="h-4 w-4" /> Preview Receipt
                            </Button>
                        )}
                    </div>
                )}

                {/* Complete Sale */}
                <Button
                    size="lg"
                    className="h-14 w-full text-base font-bold gap-2 rounded-xl"
                    onClick={onConfirm}
                    disabled={isSubmitting || cartItemCount === 0 || balanceDue > 0}
                >
                    {isSubmitting
                        ? <><Loader2 className="h-5 w-5 animate-spin" /> Processing...</>
                        : balanceDue > 0
                            ? `Balance Due: ${fmtCurrency(balanceDue)}`
                            : <><Printer className="h-5 w-5" /> Complete Sale &amp; Print Receipt</>
                    }
                </Button>
            </div>
        </>
    );
}
