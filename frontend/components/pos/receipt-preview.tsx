"use client";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface ReceiptPreviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReceiptPreview({ open, onOpenChange }: ReceiptPreviewProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-background">
        <DialogTitle className="sr-only">Receipt Preview</DialogTitle>
        <div className="p-6 flex flex-col items-center text-center space-y-4 font-mono text-sm max-h-[80vh] overflow-y-auto">
            <div className="space-y-1">
                <h2 className="text-xl font-bold font-sans">Speed Limited</h2>
                <p>123 Fashion Avenue</p>
                <p>New York, NY 10001</p>
                <p>Tel: (555) 123-4567</p>
            </div>

            <div className="w-full flex justify-between text-xs pt-2">
                <div className="text-left">
                    <p>Date: 12/19/2025</p>
                    <p>Rcpt #: POS-001</p>
                </div>
                <div className="text-right">
                    <p>Time: 6:38:07 PM</p>
                    <p>Cashier: John Doe</p>
                </div>
            </div>

            <Separator className="border-black" />

            <div className="w-full text-xs">
                <div className="flex justify-between font-bold mb-2">
                    <span className="text-left w-1/2">Item</span>
                    <span className="text-center w-12">Qty</span>
                    <span className="text-right w-16">Price</span>
                    <span className="text-right flex-1">Total</span>
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between">
                        <div className="text-left w-1/2">
                            <p className="font-bold">Air Jordan Sports</p>
                            <p className="text-[10px] text-muted-foreground">Nike</p>
                        </div>
                        <span className="text-center w-12">1</span>
                        <span className="text-right w-16">500.00</span>
                        <span className="text-right flex-1">500.00</span>
                    </div>
                </div>
            </div>

            <Separator />

            <div className="w-full space-y-1 text-xs">
                 <div className="flex justify-between">
                     <span>Subtotal</span>
                     <span>500.00</span>
                 </div>
                 <div className="flex justify-between">
                     <span>Discount (10%)</span>
                     <span>-50.00</span>
                 </div>
                 <div className="flex justify-between">
                     <span>Tax (5% Included)</span>
                     <span>25.00</span>
                 </div>
            </div>

            <Separator className="border-black" />

            <div className="w-full flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>475.00</span>
            </div>

            <Separator className="border-black" />

            <div className="w-full space-y-1 text-xs text-muted-foreground pt-2">
                 <div className="flex justify-between">
                     <span className="italic">Unpaid</span>
                 </div>
                 <div className="flex justify-between font-bold text-black mt-2">
                     <span>Balance Due</span>
                     <span>475.00</span>
                 </div>
            </div>
             
             <div className="text-center text-[10px] pt-4 space-y-1">
                 <p>*** THANK YOU FOR SHOPPING ***</p>
                 <p>Please come again</p>
                 <p>Return Policy: 7 days with receipt</p>
             </div>
             
             <div className="pt-2">
                 {/* Barcode Mock */}
                 <div className="h-10 w-48 bg-black/90 mx-auto"></div>
                 <p className="text-[10px] pt-1">POS-001</p>
             </div>
        </div>

        <div className="p-4 border-t bg-muted/20 flex gap-2">
            <Button className="w-full" onClick={() => window.print()}>
                <Printer className="mr-2 h-4 w-4" />
                Print Receipt
            </Button>
            <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
                Close
            </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
