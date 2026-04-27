import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Minus, Plus, Trash2, User, CreditCard, Banknote, QrCode } from "lucide-react";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";

const cartItems = [
    { id: 1, name: "Product Item 1", price: 120.00, quantity: 2 },
    { id: 2, name: "Product Item 5", price: 45.50, quantity: 1 },
    { id: 3, name: "Product Item 8", price: 15.00, quantity: 5 },
];

export function CartSidebar() {
  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h2 className="font-semibold text-lg">Current Order</h2>
        <div className="mt-4 flex gap-2">
            <Button variant="outline" className="flex-1 gap-2" size="sm">
                <User className="h-4 w-4" />
                Walk-in Customer
            </Button>
            <Button variant="outline" size="icon" className="shrink-0 h-9 w-9">
                <Plus className="h-4 w-4" />
            </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
            {cartItems.map((item) => (
                <div key={item.id} className="flex gap-3 items-start bg-muted/30 p-3 rounded-lg border">
                     <div className="flex-1 grid gap-1">
                         <div className="flex justify-between items-start">
                             <span className="font-medium text-sm">{item.name}</span>
                             <span className="font-bold text-sm">{formatCurrency(item.price * item.quantity)}</span>
                         </div>
                         <div className="text-xs text-muted-foreground">{formatCurrency(item.price)} / unit</div>
                         
                         <div className="flex items-center gap-3 mt-1">
                             <div className="flex items-center border rounded-md bg-background">
                                 <button className="h-7 w-7 flex items-center justify-center hover:bg-muted transition-colors rounded-l-md">
                                     <Minus className="h-3 w-3" />
                                 </button>
                                 <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                                 <button className="h-7 w-7 flex items-center justify-center hover:bg-muted transition-colors rounded-r-md">
                                     <Plus className="h-3 w-3" />
                                 </button>
                             </div>
                         </div>
                     </div>
                     <button className="text-muted-foreground hover:text-destructive transition-colors">
                         <Trash2 className="h-4 w-4" />
                     </button>
                </div>
            ))}
        </div>
      </ScrollArea>

      <div className="p-4 border-t bg-muted/10 space-y-4">
          <div className="space-y-2">
              <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(285.50)}</span>
              </div>
              <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Tax (10%)</span>
                  <span>{formatCurrency(28.55)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-primary pt-2 border-t">
                  <span>Total</span>
                  <span>{formatCurrency(314.05)}</span>
              </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
              <Button variant="outline" className="flex flex-col items-center justify-center h-auto py-2 gap-1" size="sm">
                  <Banknote className="h-4 w-4" />
                  <span className="text-[10px]">Cash</span>
              </Button>
              <Button variant="outline" className="flex flex-col items-center justify-center h-auto py-2 gap-1" size="sm">
                  <CreditCard className="h-4 w-4" />
                  <span className="text-[10px]">Card</span>
              </Button>
               <Button variant="outline" className="flex flex-col items-center justify-center h-auto py-2 gap-1" size="sm">
                  <QrCode className="h-4 w-4" />
                  <span className="text-[10px]">QR</span>
              </Button>
              <Button variant="outline" className="flex flex-col items-center justify-center h-auto py-2 gap-1" size="sm">
                  <span className="font-bold text-xs">...</span>
                  <span className="text-[10px]">Split</span>
              </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
               <Button variant="secondary" className="w-full">
                   Hold
               </Button>
               <Link href="/pos/payment" className="w-full">
                   <Button className="w-full">
                       Pay Now
                   </Button>
               </Link>
          </div>
      </div>
    </div>
  );
}
