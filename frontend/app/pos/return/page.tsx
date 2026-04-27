"use client";

import { PosHeader } from "@/components/pos/pos-header";
import { PosSidebar } from "@/components/pos/pos-sidebar";
import { Card, CardContent } from "@/components/ui/card";
import { RotateCcw, RefreshCw, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function PosReturnPage() {
  return (
    <div className="flex h-screen overflow-hidden">
      <PosSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <PosHeader />
        <main className="flex-1 flex flex-col p-6 bg-muted/20 overflow-auto">
             <div className="flex items-center justify-center mb-8">
                 <h1 className="text-xl font-bold text-foreground">Return & Exchange</h1>
             </div>

             <div className="flex-1 flex items-center justify-center">
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl w-full">
                     {/* Refund Item */}
                     <Link href="/pos/return/refund" className="contents">
                        <Card className="hover:shadow-lg transition-shadow cursor-pointer border-none shadow-sm h-64 flex flex-col items-center justify-center text-center p-6">
                            <div className="h-20 w-20 rounded-full bg-violet-100 flex items-center justify-center mb-6 text-violet-600">
                                <RotateCcw className="h-10 w-10" />
                            </div>
                            <h3 className="text-xl font-bold mb-3">Refund Item</h3>
                            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                                Process a refund for returned merchandise to original payment method or store credit.
                            </p>
                        </Card>
                     </Link>

                     {/* Exchange Item */}
                     <Card className="hover:shadow-lg transition-shadow cursor-pointer border-none shadow-sm h-64 flex flex-col items-center justify-center text-center p-6">
                         <div className="h-20 w-20 rounded-full bg-violet-100 flex items-center justify-center mb-6 text-violet-600">
                             <RefreshCw className="h-10 w-10" />
                         </div>
                         <h3 className="text-xl font-bold mb-3">Exchange Item</h3>
                         <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                             Swap items for different sizes, colors, or completely different products.
                         </p>
                     </Card>

                     {/* Claim Item */}
                     <Card className="hover:shadow-lg transition-shadow cursor-pointer border-none shadow-sm h-64 flex flex-col items-center justify-center text-center p-6">
                         <div className="h-20 w-20 rounded-full bg-violet-100 flex items-center justify-center mb-6 text-violet-600">
                             <RefreshCw className="h-10 w-10" />
                         </div>
                         <h3 className="text-xl font-bold mb-3">Claim Item</h3>
                         <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                             Swap items for different sizes, colors, or completely different products.
                         </p>
                     </Card>
                 </div>
             </div>
        </main>
      </div>
    </div>
  );
}
