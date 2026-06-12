"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";

interface CheckoutHeaderProps {
    cartItemCount: number;
    onBack: () => void;
}

export function CheckoutHeader({ cartItemCount, onBack }: CheckoutHeaderProps) {
    return (
        <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back to Cart
            </Button>
            <h1 className="text-xl font-bold tracking-tight">Checkout</h1>
            <div className="ml-auto flex items-center gap-2">
                <div className="hidden md:flex items-center gap-1.5 text-xs text-muted-foreground border rounded-md px-2 py-1 bg-muted/30">
                    <kbd className="px-1 bg-background border rounded text-[10px]">F2</kbd><span>Coupon</span>
                    <span className="mx-1 opacity-30">|</span>
                    <kbd className="px-1 bg-background border rounded text-[10px]">F3</kbd><span>Alliance</span>
                    <span className="mx-1 opacity-30">|</span>
                    <kbd className="px-1 bg-background border rounded text-[10px]">F4</kbd><span>Pay</span>
                    <span className="mx-1 opacity-30">|</span>
                    <kbd className="px-1 bg-background border rounded text-[10px]">F5</kbd><span>Fill</span>
                    <span className="mx-1 opacity-30">|</span>
                    <kbd className="px-1 bg-background border rounded text-[10px]">F12</kbd><span>Complete</span>
                </div>
                <Badge variant="outline" className="font-mono">
                    {cartItemCount} item{cartItemCount !== 1 ? "s" : ""}
                </Badge>
            </div>
        </div>
    );
}
