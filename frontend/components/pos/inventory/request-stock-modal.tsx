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
import { Package, Send, AlertCircle, CheckCircle2, Printer } from "lucide-react";
import { toast } from "sonner";
import { createTransferRequest } from "@/lib/actions/transfer-request";
import { useAuth } from "@/components/providers/auth-provider";
import { format } from "date-fns";

interface RequestStockModalProps {
    item: {
        id: string;
        sku: string;
        description: string;
        size?: string;
        color?: string;
    } | null;
    fromLocation: {
        location: {
            id?: string;
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
    const { user } = useAuth();
    const [quantity, setQuantity] = useState("1");
    const [notes, setNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [createdRequest, setCreatedRequest] = useState<any>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!item || !fromLocation) return;

        const qty = parseFloat(quantity);
        if (isNaN(qty) || qty <= 0) {
            toast.error("Please enter a valid quantity");
            return;
        }

        const toLocationId = user?.terminal?.location?.id || user?.locationId;
        if (!toLocationId) {
            toast.error("Your terminal/outlet location is not configured");
            return;
        }

        setIsSubmitting(true);
        try {
            const isFromOutlet = !!fromLocation.location.id;
            let res;
            if (isFromOutlet) {
                // Direct Outlet-to-Outlet Transfer Request
                res = await createTransferRequest({
                    fromLocationId: fromLocation.location.id,
                    toLocationId: toLocationId,
                    transferType: "OUTLET_TO_OUTLET",
                    items: [
                        {
                            itemId: item.id,
                            quantity: qty,
                        },
                    ],
                    notes,
                });
            } else {
                // Stock Requisition (SRN) from Warehouse
                res = await createTransferRequest({
                    fromWarehouseId: fromLocation.location.warehouse.id,
                    toLocationId: toLocationId,
                    transferType: "WAREHOUSE_TO_OUTLET",
                    items: [
                        {
                            itemId: item.id,
                            quantity: qty,
                        },
                    ],
                    notes,
                });
            }

            if (res.status) {
                setCreatedRequest(res.data);
                setIsSuccess(true);
                toast.success(res.message || "Request sent successfully");
            } else {
                toast.error(res.message || "Failed to send Request");
            }
        } catch (error: any) {
            console.error("Request stock error:", error);
            toast.error(error.message || "An error occurred while sending the request");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCloseSuccess = () => {
        onClose();
        setIsSuccess(false);
        setCreatedRequest(null);
        setQuantity("1");
        setNotes("");
    };

    const handlePrintCreatedRequest = () => {
        if (!createdRequest) return;
        const refNo = createdRequest.requestNo || createdRequest.requisitionNo || "N/A";
        const isOutletToOutlet = createdRequest.transferType === "OUTLET_TO_OUTLET" || createdRequest.documentType === "OUTLET_TO_OUTLET";
        const typeTitle = isOutletToOutlet ? "OUTLET-TO-OUTLET TRANSFER REQUEST" : "STOCK REQUISITION NOTE";
        const win = window.open("", "_blank");
        if (!win) {
            toast.error("Allow popups to print");
            return;
        }

        const dateStr = format(new Date(), "dd MMM yyyy HH:mm");
        const companyName = "Speed Limit";
        const sourceLoc = fromLocation?.location?.warehouse?.name || fromLocation?.location?.name || "N/A";
        const destLoc = user?.terminal?.location?.name || user?.locationId || "N/A";

        win.document.write(`
            <html><head><title>Transfer Request - ${refNo}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: 'Segoe UI', Arial, sans-serif; color: #333; line-height: 1.4; padding: 40px; }
                .header-container { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #3b82f6; padding-bottom: 16px; margin-bottom: 20px; }
                .company-name { font-size: 24px; font-weight: 800; color: #1e3a8a; letter-spacing: 1px; }
                .document-title { font-size: 14px; font-weight: 600; color: #4b5563; text-transform: uppercase; margin-top: 4px; }
                .status-badge { padding: 6px 12px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase; border: 1px solid; display: inline-block; }
                .status-pending { background-color: #fef3c7; color: #d97706; border-color: #f59e0b; }
                
                .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 30px; background-color: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; }
                .meta-item { display: flex; flex-direction: column; }
                .meta-label { font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 2px; }
                .meta-value { font-size: 13px; font-weight: 600; color: #1e293b; }
                
                table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
                th { background-color: #f1f5f9; color: #475569; font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 10px 12px; border-bottom: 2px solid #cbd5e1; text-align: left; }
                td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #334155; }
                .text-right { text-align: right; }
                .font-bold { font-weight: 700; }
                
                .notes-section { background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 12px 16px; margin-bottom: 40px; border-radius: 0 8px 8px 0; }
                .notes-title { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #475569; margin-bottom: 4px; }
                .notes-content { font-size: 12px; color: #334155; }
                
                .signature-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 40px; margin-top: 60px; }
                .signature-box { border-top: 1px solid #94a3b8; text-align: center; padding-top: 8px; font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; }
                
                @media print {
                    body { padding: 0; }
                    .meta-grid { background-color: #fff !important; border: 1px solid #cbd5e1; }
                    th { background-color: #e2e8f0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            </style></head><body>
                <div class="header-container">
                    <div>
                        <div class="company-name">${companyName}</div>
                        <div class="document-title">${typeTitle}</div>
                    </div>
                    <div>
                        <span class="status-badge status-pending">PENDING SOURCE APPROVAL</span>
                    </div>
                </div>
                
                <div class="meta-grid">
                    <div class="meta-item">
                        <span class="meta-label">Reference No</span>
                        <span class="meta-value">${refNo}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Request Date</span>
                        <span class="meta-value">${dateStr}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Source Outlet / Location</span>
                        <span class="meta-value">${sourceLoc}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Destination Outlet</span>
                        <span class="meta-value">${destLoc}</span>
                    </div>
                </div>
                
                <table>
                    <thead>
                        <tr>
                            <th style="width: 60px;">S.No</th>
                            <th>SKU Code</th>
                            <th>Item Description</th>
                            <th>Size</th>
                            <th>Color</th>
                            <th class="text-right" style="width: 100px;">Quantity</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>1</td>
                            <td class="font-bold">${item?.sku || "—"}</td>
                            <td>${item?.description || "Item"}</td>
                            <td>${item?.size || "—"}</td>
                            <td>${item?.color || "—"}</td>
                            <td class="text-right font-bold">${quantity}</td>
                        </tr>
                    </tbody>
                </table>
                
                ${notes ? `
                    <div class="notes-section">
                        <div class="notes-title">Request Notes / Remarks</div>
                        <div class="notes-content">${notes}</div>
                    </div>
                ` : ''}
                
                <div class="signature-grid">
                    <div class="signature-box">Prepared By</div>
                    <div class="signature-box">Source Authorized By</div>
                    <div class="signature-box">Received By</div>
                </div>
            </body></html>
        `);
        win.document.close();
        win.focus();
        win.print();
        win.close();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[425px]">
                {isSuccess ? (
                    <div className="py-6 flex flex-col items-center justify-center text-center">
                        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
                            <CheckCircle2 className="w-10 h-10" />
                        </div>
                        <h3 className="text-xl font-bold text-foreground">Request Sent!</h3>
                        <p className="text-muted-foreground mt-2 font-medium text-sm">
                            Your transfer request has been submitted successfully.
                        </p>
                        
                        {createdRequest && (
                            <div className="mt-4 p-4 bg-muted/40 rounded-xl w-full border text-left font-mono text-xs space-y-1.5">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Ref No:</span>
                                    <span className="font-bold text-foreground">{createdRequest.requestNo || createdRequest.requisitionNo || "N/A"}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Item SKU:</span>
                                    <span className="font-bold text-foreground">{item?.sku}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Qty:</span>
                                    <span className="font-bold text-foreground">{quantity} Units</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Source:</span>
                                    <span className="font-bold text-foreground truncate max-w-[180px]">{fromLocation?.location.warehouse.name}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Type:</span>
                                    <span className="font-bold text-foreground">{createdRequest.transferType || createdRequest.documentType || "Outlet Request"}</span>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col gap-2 w-full mt-6">
                            <Button 
                                type="button" 
                                className="w-full h-11 font-bold gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={() => handlePrintCreatedRequest()}
                            >
                                <Printer className="h-4 w-4" /> Print Request Slip
                            </Button>
                            <Button 
                                type="button" 
                                variant="outline" 
                                className="w-full h-11 font-bold"
                                onClick={handleCloseSuccess}
                            >
                                Close
                            </Button>
                        </div>
                    </div>
                ) : (
                    <>
                        <DialogHeader>
                            <div className="flex items-center gap-2 mb-1">
                                <Package className="w-5 h-5 text-primary" />
                                <DialogTitle className="text-xl font-bold tracking-tight">Request Stock Transfer</DialogTitle>
                            </div>
                            <DialogDescription className="text-muted-foreground font-medium flex flex-col gap-1 mt-1">
                                <div className="flex items-center flex-wrap gap-1.5">
                                    <span>Request stock for</span>
                                    <span className="font-bold text-foreground tracking-tight">{item?.sku}</span>
                                    {item?.size && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 ring-1 ring-inset ring-indigo-700/10 dark:ring-indigo-300/20">
                                            Size: {item.size}
                                        </span>
                                    )}
                                    {item?.color && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-pink-50 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300 ring-1 ring-inset ring-pink-700/10 dark:ring-pink-300/20">
                                            Color: {item.color}
                                        </span>
                                    )}
                                    <span>from</span>
                                    <span className="font-bold text-foreground tracking-tight">{fromLocation?.location.warehouse.name}</span>.
                                </div>
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
