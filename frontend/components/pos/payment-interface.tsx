"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Printer, Trash2, CreditCard, Banknote } from "lucide-react";
import Link from "next/link";
import { ReceiptPreview } from "@/components/pos/receipt-preview";
import { useState } from "react";

export function PaymentInterface() {
  const [showReceipt, setShowReceipt] = useState(false);

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Header Bar */}
      <div className="flex items-center justify-between bg-background p-4 rounded-lg border shadow-sm shrink-0">
         <div className="flex items-center gap-4">
             <Link href="/pos">
                <Button variant="ghost" size="sm" className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Billing
                </Button>
             </Link>
             <div className="h-6 w-px bg-border"></div>
             <h1 className="text-xl font-bold">POS ID: POS-001</h1>
         </div>
         <h2 className="text-lg font-semibold text-muted-foreground mr-4">Payment & Tender</h2>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
          {/* Left Column: Summary & Discounts */}
          <div className="w-1/3 flex flex-col gap-4 overflow-y-auto pr-1">
              
              {/* Sale Summary */}
              <Card>
                  <CardHeader className="py-3 bg-muted/50 border-b">
                      <CardTitle className="text-sm font-bold uppercase text-muted-foreground">Sale Summary</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                      <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">SubTotal</span>
                          <span className="font-semibold">4,500</span>
                      </div>
                      <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Promotion</span>
                          <span className="font-semibold text-green-600">0</span>
                      </div>
                      <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Tax</span>
                          <span className="font-semibold text-destructive">765</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between text-base font-bold">
                          <span>Total Payable</span>
                          <span>5,265</span>
                      </div>
                  </CardContent>
              </Card>

              {/* Global Discount */}
              <Card>
                  <CardHeader className="py-3 bg-muted/50 border-b">
                      <CardTitle className="text-sm font-bold uppercase text-muted-foreground">Global Discount</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                      <div className="grid gap-2">
                          <Label htmlFor="discount-value" className="text-xs">Value</Label>
                          <Input id="discount-value" className="bg-background" placeholder="0" />
                      </div>
                      <div className="grid gap-2">
                          <Label htmlFor="discount-remarks" className="text-xs">Remarks</Label>
                          <Input id="discount-remarks" className="bg-background" />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                          <Button variant="outline" size="sm">Clear</Button>
                          <Button size="sm">Apply</Button>
                      </div>
                  </CardContent>
              </Card>

              {/* Alliance Discount */}
              <Card>
                  <CardHeader className="py-3 bg-muted/50 border-b">
                      <CardTitle className="text-sm font-bold uppercase text-muted-foreground">Alliance Discount</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                      <div className="grid gap-2">
                          <Label className="text-xs">Bank</Label>
                          <Select>
                              <SelectTrigger>
                                  <SelectValue placeholder="Select Bank" />
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="hbl">HBL</SelectItem>
                                  <SelectItem value="mcb">MCB</SelectItem>
                              </SelectContent>
                          </Select>
                      </div>
                      <div className="grid gap-2">
                            <Label className="text-xs">Amount</Label>
                            <Input placeholder="0" />
                      </div>
                       <div className="flex justify-end gap-2 pt-2">
                          <Button variant="outline" size="sm">Clear</Button>
                          <Button size="sm">Apply</Button>
                      </div>
                  </CardContent>
              </Card>

              {/* Club Points */}
              <Card>
                  <CardHeader className="py-3 bg-muted/50 border-b">
                      <CardTitle className="text-sm font-bold uppercase text-muted-foreground">Club Points</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 space-y-2 text-sm">
                      <div className="grid gap-2 mb-2">
                          <Label className="text-xs">Card #</Label>
                          <Input className="bg-background" />
                      </div>
                      <div className="flex justify-between">
                          <span className="text-muted-foreground">Available</span>
                          <span className="font-medium">0</span>
                      </div>
                      <div className="flex justify-between">
                          <span className="text-muted-foreground">Redeem</span>
                          <span className="font-medium">0</span>
                      </div>
                       <Separator />
                       <div className="flex justify-between">
                          <span className="text-muted-foreground font-bold">Balance</span>
                          <span className="font-medium">0</span>
                      </div>
                  </CardContent>
              </Card>
          </div>

          {/* Middle Column: Vouchers */}
          <div className="w-1/3 flex flex-col gap-4 overflow-y-auto pr-1">
               <Card className="h-full flex flex-col">
                  <CardHeader className="py-3 bg-muted/50 border-b">
                      <CardTitle className="text-sm font-bold uppercase text-muted-foreground">Documents & Vouchers</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                      <div className="divide-y">
                          {["Club Member", "Point Redeem", "Gift Voucher", "Sales Return", "Claim Voucher", "Credit Voucher"].map((item) => (
                              <button key={item} className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-sm font-medium">
                                  {item}
                                  <span className="text-muted-foreground">▼</span>
                              </button>
                          ))}
                      </div>
                      
                      <div className="p-4 mt-auto border-t bg-muted/10">
                           <div className="border rounded-lg p-4 bg-background text-center space-y-2">
                               <p className="text-xs font-bold text-muted-foreground uppercase">Credit Voucher Issued</p>
                               <Separator />
                               <div className="flex justify-between items-center pt-2">
                                   <span className="text-xs text-muted-foreground">######</span>
                                   <span className="text-red-500 font-bold">Rs. 0</span>
                               </div>
                           </div>
                           <Button className="w-full mt-4 bg-slate-800 text-white hover:bg-slate-700" variant="default">
                                <Printer className="mr-2 h-4 w-4" />
                                Print Document
                           </Button>
                      </div>
                  </CardContent>
               </Card>
          </div>

          {/* Right Column: Payment */}
          <div className="w-1/3 flex flex-col gap-4">
              <Card className="flex-1 flex flex-col border-none shadow-none bg-transparent">
                  <div className="flex items-center gap-2 mb-4">
                       <Banknote className="h-5 w-5 text-primary" />
                       <h3 className="font-bold text-lg">Payment</h3>
                  </div>

                  <CardContent className="p-5 bg-background rounded-lg border shadow-sm flex-1 space-y-6">
                      <div className="space-y-3">
                          <Label className="text-xs font-bold text-muted-foreground uppercase">Tender Type</Label>
                          <Select defaultValue="cash">
                              <SelectTrigger className="h-10">
                                  <SelectValue placeholder="Select Tender" />
                              </SelectTrigger>
                              <SelectContent>
                                  <SelectItem value="cash">Cash</SelectItem>
                                  <SelectItem value="card">Card</SelectItem>
                              </SelectContent>
                          </Select>
                      </div>

                      <div className="space-y-3">
                           <Label className="text-xs font-bold text-muted-foreground uppercase">Amount To Pay</Label>
                           <Input className="h-12 text-lg font-bold bg-muted/30" defaultValue="Rs. 0" />
                      </div>

                      <Button className="w-full h-12 text-base bg-violet-600 hover:bg-violet-700">ADD PAYMENT</Button>

                      <div className="space-y-2 pt-4">
                          <div className="flex justify-between text-xs font-bold text-muted-foreground uppercase px-1">
                              <span>Method</span>
                              <span>Amount</span>
                          </div>
                          <Separator />
                          <div className="flex justify-between items-center p-2 bg-muted/20 rounded-md">
                              <div className="flex items-center gap-2">
                                  <span className="font-medium">Cash</span>
                              </div>
                              <div className="flex items-center gap-4">
                                  <span className="font-bold">5,265</span>
                                  <button className="text-muted-foreground hover:text-destructive">
                                      <Trash2 className="h-4 w-4" />
                                  </button>
                              </div>
                          </div>
                      </div>
                  </CardContent>
                  
                  <div className="mt-4 bg-background border rounded-lg p-4 shadow-sm space-y-4">
                      <div className="flex justify-between items-center px-2">
                          <span className="text-xs font-bold text-muted-foreground uppercase">Balance Due</span>
                          <span className="text-xl font-bold text-destructive">0</span>
                      </div>
                      <Button 
                        className="w-full h-12 text-base font-bold bg-green-600 hover:bg-green-700"
                        onClick={() => setShowReceipt(true)}
                      >
                          COMPLETE SALE
                      </Button>
                  </div>
              </Card>
          </div>
      </div>

      <ReceiptPreview open={showReceipt} onOpenChange={setShowReceipt} />
    </div>
  );
}
