"use client";

import React, { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Package, Send, AlertCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { createTransferRequest } from "@/lib/actions/transfer-request";

interface RequestStockModalProps {
    item: {
        id: string;
        sku: string;
        description: string;
    } | null;
    fromLocation: {
        location: {
            name: string;
            warehouse: {
                id: string;
                name: string;
            };
        };
        quantity: number;
    } | null;
    isOpen: boolean;
    onClose: () => void;
}

export function RequestStockModal({
    item,
    fromLocation,
    isOpen,
    onClose,
}: RequestStockModalProps) {
    const [quantity, setQuantity] = useState("1");
    const [notes, setNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!item || !fromLocation) return;

        const qty = parseFloat(quantity);
        if (isNaN(qty) || qty <= 0) {
            toast.error("Please enter a valid quantity");
            return;
        }

        if (qty > fromLocation.quantity) {
            toast.error(`Requested quantity exceeds available stock (${fromLocation.quantity})`);
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await createTransferRequest({
                fromWarehouseId: fromLocation.location.warehouse.id,
                toWarehouseId: "CURRENT_WAREHOUSE_ID", // TODO: Replace with actual current POS warehouse ID from context/auth
                items: [
                    {
                        itemId: item.id,
                        quantity: qty,
                    },
                ],
                notes,
            });

            if (res.status) {
                setIsSuccess(true);
                toast.success(res.message || "Stock transfer request sent successfully");
                setTimeout(() => {
                    onClose();
                    setIsSuccess(false);
                    setQuantity("1");
                    setNotes("");
                }, 2000);
            } else {
                toast.error(res.message || "Failed to send transfer request");
            }
        } catch (error: any) {
            console.error("Transfer request error:", error);
            toast.error(error.message || "An error occurred while sending the request");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                {isSuccess ? (
                    <div className="py-10 flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                            <CheckCircle2 className="w-10 h-10" />
                        </div>
                        <h3 className="text-xl font-bold text-foreground">Request Sent!</h3>
                        <p className="text-muted-foreground mt-2 font-medium">
                            Your transfer request for {quantity} units has been submitted for approval.
                        </p>
                    </div>
                ) : (
                    <>
                        <DialogHeader>
                            <div className="flex items-center gap-2 mb-1">
                                <Package className="w-5 h-5 text-primary" />
                                <DialogTitle className="text-xl font-bold tracking-tight">Request Stock Transfer</DialogTitle>
                            </div>
                            <DialogDescription className="text-muted-foreground font-medium">
                                Request stock for <span className="font-bold text-foreground tracking-tight">{item?.sku}</span> from
                                <span className="font-bold text-foreground tracking-tight"> {fromLocation?.location.warehouse.name}</span>.
                            </DialogDescription>
                        </DialogHeader>

                        <form onSubmit={handleSubmit} className="grid gap-6 py-4">
                            <div className="grid gap-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="quantity" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                        Quantity to Request
                                    </Label>
                                    <span className="text-xs font-bold text-primary font-mono bg-primary/10 px-1.5 py-0.5 rounded">
                                        Max: {fromLocation?.quantity}
                                    </span>
                                </div>
                                <Input
                                    id="quantity"
                                    type="number"
                                    min="1"
                                    max={fromLocation?.quantity}
                                    value={quantity}
                                    onChange={(e) => setQuantity(e.target.value)}
                                    className="text-lg py-6 focus-visible:ring-ring font-mono bg-muted/30"
                                    required
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="notes" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                    Additional Notes (Optional)
                                </Label>
                                <Textarea
                                    id="notes"
                                    placeholder="e.g. Urgent requirement for customer order #123"
                                    className="resize-none focus-visible:ring-ring bg-muted/30 min-h-[100px]"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                />
                            </div>

                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 flex gap-3 text-amber-700 dark:text-amber-400 text-xs font-medium">
                                <AlertCircle className="w-5 h-5 flex-none mt-0.5 text-amber-600" />
                                <p className="leading-relaxed">
                                    This request will be sent to the sourcing branch manager for approval.
                                    Stock will be reserved upon approval and notified to your terminal.
                                </p>
                            </div>

                            <DialogFooter className="gap-2 sm:gap-0">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={onClose}
                                    disabled={isSubmitting}
                                    className="font-bold uppercase tracking-wider text-xs h-11"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold uppercase tracking-wider text-xs h-11 shadow-lg shadow-primary/20"
                                >
                                    {isSubmitting ? "Sending..." : (
                                        <>
                                            <Send className="w-4 h-4 mr-2" />
                                            Submit Request
                                        </>
                                    )}
                                </Button>
                            </DialogFooter>
                        </form>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
