"use client";

import { useState } from "react";
import { PosHeader } from "@/components/pos/pos-header";
import { PosSidebar } from "@/components/pos/pos-sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Search, Package, RefreshCw, Printer, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

// Mock Data for "Select Items"
const mockInvoiceItems = [
    { id: 1, sku: "AH6073-011", name: "NSW PANT JERSEY JO L", size: "L / Black", price: 4500, selected: true },
    { id: 2, sku: "NK-TSHIRT-M", name: "NIKE T-SHIRT COTTON M", size: "M / White", price: 2500, selected: false },
];

export default function PosRefundPage() {
    const [step, setStep] = useState<"search" | "select" | "confirm">("search");
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedItems, setSelectedItems] = useState<number[]>([1]);
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    const handleSearch = () => {
        if (searchTerm) setStep("select");
    };

    const handleToggleItem = (id: number) => {
        if (selectedItems.includes(id)) {
            setSelectedItems(selectedItems.filter(i => i !== id));
        } else {
            setSelectedItems([...selectedItems, id]);
        }
    };

    const handleConfirmReturn = () => {
        setStep("confirm");
    };

    const handleProcessRefund = () => {
        setShowSuccessModal(true);
    };

    const totalRefund = mockInvoiceItems
        .filter(item => selectedItems.includes(item.id))
        .reduce((sum, item) => sum + item.price, 0);

    return (
        <div className="flex h-screen overflow-hidden">
            <PosSidebar />
            <div className="flex flex-col flex-1 overflow-hidden">
                <PosHeader />
                <main className="flex-1 flex flex-col bg-muted/20 overflow-auto">
                    
                    {/* Header with Back Button */}
                    <div className="bg-background border-b p-4 flex items-center justify-between">
                         <div className="flex items-center gap-4">
                             <Button variant="ghost" size="sm" asChild>
                                 <Link href={step === "search" ? "/pos/return" : "#"} onClick={() => step !== "search" && setStep("search")}>
                                     <ArrowLeft className="h-4 w-4 mr-2" />
                                     {step === "search" ? "Back to Selection" : "Back"}
                                 </Link>
                             </Button>
                             <h1 className="text-xl font-bold">Return</h1>
                         </div>
                    </div>

                    <div className="flex-1 p-6 flex justify-center">
                        
                        {/* STEP 1: FIND TRANSACTION */}
                        {step === "search" && (
                            <div className="w-full max-w-2xl mt-10">
                                <div className="text-center mb-8">
                                    <h2 className="text-2xl font-bold mb-2">Find Transaction</h2>
                                    <p className="text-muted-foreground">Scan the receipt barcode or enter the invoice number manually.</p>
                                </div>
                                <Card className="p-6">
                                    <CardContent className="space-y-6 pt-4">
                                        <div className="space-y-2">
                                            <Label className="font-bold">Invoice / Receipt Number</Label>
                                            <div className="relative">
                                                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                                <Input 
                                                    className="pl-9 h-12" 
                                                    placeholder="e.g. 1001" 
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                        <div className="relative flex items-center py-2">
                                            <div className="flex-grow border-t"></div>
                                            <span className="flex-shrink-0 mx-4 text-xs font-bold text-muted-foreground">OR</span>
                                            <div className="flex-grow border-t"></div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="font-bold">Customer Phone (Optional)</Label>
                                            <Input className="h-12" placeholder="(555) 000-0000" />
                                        </div>

                                        <Button 
                                            className="w-full h-12 text-base font-bold bg-violet-600 hover:bg-violet-700 mt-4"
                                            onClick={handleSearch}
                                        >
                                            Search Invoice
                                        </Button>
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {/* STEP 2: SELECT ITEMS */}
                        {step === "select" && (
                            <div className="flex gap-6 w-full max-w-6xl h-full items-start">
                                <div className="flex-1 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h2 className="text-xl font-bold">Select Items to Return</h2>
                                            <p className="text-sm text-muted-foreground">Inv #1001 • 2025-10-24 10:30 AM • Walk-in</p>
                                        </div>
                                        <Button variant="outline" size="sm">Change Invoice</Button>
                                    </div>
                                    
                                    <Card>
                                        <div className="bg-muted/50 px-6 py-3 border-b text-xs font-bold text-muted-foreground flex justify-between">
                                            <span>Product Details</span>
                                            <div className="flex gap-16 mr-12">
                                                <span>Size/Color</span>
                                                <span>Paid Price</span>
                                            </div>
                                        </div>
                                        <div>
                                            {mockInvoiceItems.map((item) => (
                                                <div key={item.id} className={`flex items-center p-4 border-b last:border-0 hover:bg-muted/20 ${selectedItems.includes(item.id) ? "bg-violet-50/50" : ""}`}>
                                                    <Checkbox 
                                                        checked={selectedItems.includes(item.id)} 
                                                        onCheckedChange={() => handleToggleItem(item.id)}
                                                        className="mr-4"
                                                    />
                                                    <div className="h-10 w-10 bg-muted rounded flex items-center justify-center mr-4 text-muted-foreground">
                                                        <Package className="h-5 w-5" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="font-bold text-sm">{item.name}</p>
                                                        <p className="text-xs text-muted-foreground">{item.sku}</p>
                                                    </div>
                                                    <div className="flex gap-16 mr-6 text-sm">
                                                        <span className="w-20">{item.size}</span>
                                                        <span className="font-bold w-12 text-right">{item.price.toLocaleString()}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </Card>
                                </div>

                                <Card className="w-80 shrink-0 sticky top-4">
                                    <CardContent className="p-6 space-y-6">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-muted-foreground">Reason for Return</Label>
                                            <Select defaultValue="changed_mind">
                                                <SelectTrigger>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="changed_mind">Customer Changed Mind</SelectItem>
                                                    <SelectItem value="defective">Defective Item</SelectItem>
                                                    <SelectItem value="wrong_item">Wrong Item</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold text-muted-foreground">Additional Notes</Label>
                                            <Textarea placeholder="Optional comments..." className="h-32 resize-none" />
                                        </div>

                                        <div className="pt-4 border-t space-y-2">
                                            <div className="flex justify-between text-sm text-muted-foreground">
                                                <span>Selected Items</span>
                                                <span>{selectedItems.length}</span>
                                            </div>
                                            <div className="flex justify-between font-bold text-lg">
                                                <span>Refund Total</span>
                                                <span>{totalRefund.toLocaleString()}</span>
                                            </div>
                                        </div>

                                        <Button 
                                            className="w-full bg-violet-600 hover:bg-violet-700"
                                            onClick={handleConfirmReturn}
                                            disabled={selectedItems.length === 0}
                                        >
                                            Confirm Return
                                        </Button>
                                    </CardContent>
                                </Card>
                            </div>
                        )}

                        {/* STEP 3: REFUND CONFIRMATION */}
                        {step === "confirm" && (
                            <div className="w-full max-w-2xl mt-10">
                                <Card className="bg-violet-600 text-white rounded-t-lg rounded-b-none border-none">
                                    <CardContent className="p-8 text-center space-y-2">
                                        <h3 className="text-xl font-medium opacity-90">REFUND DUE</h3>
                                        <div className="text-4xl font-bold">{totalRefund.toLocaleString()}</div>
                                    </CardContent>
                                </Card>
                                <Card className="rounded-t-none pt-8 p-8 space-y-8">
                                    <div className="grid grid-cols-3 gap-4">
                                        <Button variant="outline" className="h-24 flex flex-col gap-2 border-muted hover:border-violet-600 hover:bg-violet-50">
                                            <RefreshCw className="h-5 w-5" />
                                            <div className="text-center">
                                                <div className="text-xs font-bold">Original Payment</div>
                                                <div className="text-[10px] text-muted-foreground">Card ending 4242</div>
                                            </div>
                                        </Button>
                                        <Button variant="outline" className="h-24 flex flex-col gap-2 border-violet-600 bg-violet-50 text-violet-700">
                                            <span className="text-lg font-bold">$</span>
                                            <div className="text-center">
                                                <div className="text-xs font-bold">Cash Refund</div>
                                            </div>
                                        </Button>
                                        <Button variant="outline" className="h-24 flex flex-col gap-2 border-muted hover:border-violet-600 hover:bg-violet-50">
                                            <span className="text-sm font-bold">CREDIT</span>
                                            <div className="text-center">
                                                <div className="text-xs font-bold">Store Credit</div>
                                            </div>
                                        </Button>
                                    </div>

                                    <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                                         <div className="flex justify-between text-sm">
                                             <span className="text-muted-foreground">Subtotal</span>
                                             <span>{totalRefund.toLocaleString()}</span>
                                         </div>
                                         <div className="flex justify-between text-sm">
                                             <span className="text-muted-foreground">Tax Adjustment</span>
                                             <span>0.00</span>
                                         </div>
                                         <Separator />
                                         <div className="flex justify-between font-bold text-lg">
                                             <span>Total Refund</span>
                                             <span>{totalRefund.toLocaleString()}</span>
                                         </div>
                                    </div>

                                    <Button 
                                        className="w-full h-12 text-base font-bold bg-violet-600 hover:bg-violet-700"
                                        onClick={handleProcessRefund}
                                    >
                                        Confirm Return Process
                                    </Button>
                                    
                                    <Button variant="ghost" className="w-full text-muted-foreground text-xs" onClick={() => setStep("select")}>
                                        Cancel & Start Over
                                    </Button>
                                </Card>
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {/* Success Modal */}
            <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
                <DialogContent className="sm:max-w-md text-center p-0 overflow-hidden gap-0">
                    <DialogTitle className="sr-only">Return Processed</DialogTitle>
                    <div className="p-8 pb-4">
                        <div className="h-16 w-16 bg-violet-100 rounded-full flex items-center justify-center mx-auto mb-4 text-violet-600">
                             <RefreshCw className="h-8 w-8" />
                        </div>
                        <h2 className="text-xl font-bold tracking-tight mb-2 uppercase">RETURN PROCESSED</h2>
                        <p className="text-xs text-muted-foreground font-mono mb-6">Transaction saved successfully</p>
                        
                        <div className="text-xs font-mono space-y-1 mb-6">
                            <p className="font-bold">FASHION RETAIL STORE</p>
                            <p>123 Fashion Ave, Retail City</p>
                            <p>Tel: +1 234 567 890</p>
                        </div>
                        
                        <div className="text-[10px] text-muted-foreground flex justify-between font-mono mb-4 border-b pb-2">
                             <div className="text-left">
                                 <p>Date: 12/24/2025, 5:08:58 PM</p>
                                 <p>Tx Type: RETURN</p>
                                 <p>Ref Invoice: #1001</p>
                             </div>
                             <div className="text-right">
                                 <p>New Receipt #: R-150197</p>
                             </div>
                        </div>

                        <div className="text-xs font-mono mb-4">
                            <div className="text-left font-bold text-destructive mb-1 text-[10px] uppercase">Returned Items</div>
                             {mockInvoiceItems.filter(i => selectedItems.includes(i.id)).map(item => (
                                 <div key={item.id} className="flex justify-between mb-1">
                                     <span className="text-left max-w-[150px] truncate">{item.name}</span>
                                     <span className="text-destructive">-{item.price.toLocaleString()}</span>
                                 </div>
                             ))}
                             
                             <Separator className="my-2" />
                             
                             <div className="flex justify-between font-bold text-base">
                                 <span>Total Refund</span>
                                 <span>{totalRefund.toLocaleString()}</span>
                             </div>
                              <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                                 <span>Method:</span>
                                 <span>ORIGINAL PAYMENT</span>
                             </div>
                        </div>
                    </div>
                    
                    <div className="bg-muted/30 p-4 border-t space-y-3">
                         <div className="text-[10px] text-muted-foreground text-center">Refund Policy Applied</div>
                         <Button variant="outline" className="w-full bg-background" onClick={() => window.print()}>
                             <Printer className="mr-2 h-4 w-4" />
                             Print
                         </Button>
                         <Button className="w-full bg-violet-600 hover:bg-violet-700" onClick={() => window.location.href = "/pos"}>
                             Done (New Transaction)
                         </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
