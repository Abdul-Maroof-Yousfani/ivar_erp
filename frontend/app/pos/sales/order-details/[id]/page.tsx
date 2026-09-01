"use client";

import { useState, useEffect, useTransition, startTransition, addTransitionType } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    ArrowLeft, Printer, ShoppingCart, Wallet, Calendar as CalendarIcon,
    PauseCircle, RotateCcw, Clock, Pencil,
    Banknote, CreditCard, Building2, Ticket, BookOpen,
    UserRound, QrCode, CheckCircle2,
} from "lucide-react";
import { PrintReceipt } from "@/components/pos/print-receipt";
import { PrintReturnReceipt } from "@/components/pos/print-return-receipt";
import { PrintClaimReceipt } from "@/components/pos/print-claim-receipt";
import { cn } from "@/lib/utils";
import { authFetch } from "@/lib/auth";

import { formatCurrency } from "@/lib/utils";

const fmtCurrency = formatCurrency;

function isSameDay(date: Date) {
    const now = new Date();
    return date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();
}

const STATUS_BADGE: Record<string, string> = {
    completed: "bg-emerald-500/10 text-emerald-700 border-emerald-300",
    hold: "bg-amber-500/10 text-amber-700 border-amber-300",
    hold_expired: "bg-muted text-muted-foreground border-border",
    voided: "bg-destructive/10 text-destructive border-destructive/30",
    partially_returned: "bg-blue-500/10 text-blue-700 border-blue-300",
    returned: "bg-purple-500/10 text-purple-700 border-purple-300",
    refunded: "bg-purple-500/10 text-purple-700 border-purple-300",
    exchanged: "bg-cyan-500/10 text-cyan-700 border-cyan-300",
};

export default function OrderDetailsPage() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const params = useParams();
    const orderId = params.id as string;

    const [order, setOrder] = useState<any>(null);
    const [returnDetails, setReturnDetails] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showPrint, setShowPrint] = useState(false);
    const [showGiftPrint, setShowGiftPrint] = useState(false);
    const [showReturnPrint, setShowReturnPrint] = useState(false);
    const [isLoadingReceipt, setIsLoadingReceipt] = useState(false);
    const [isRefundPrint, setIsRefundPrint] = useState(false);
    const [showClaimReceipt, setShowClaimReceipt] = useState(false);
    const [selectedClaim, setSelectedClaim] = useState<any>(null);

    useEffect(() => {
        if (orderId) fetchOrder();
    }, [orderId]);

    const fetchOrder = async () => {
        setIsLoading(true);
        try {
            const res = await authFetch(`/pos-sales/orders/${orderId}`);
            if (res.ok && res.data?.status) {
                setOrder(res.data.data);
            } else {
                toast.error("Failed to load order");
                startTransition(() => {
                    addTransitionType("nav-back");
                    router.push("/pos/sales/history");
                });
            }
        } catch {
            toast.error("Failed to load order");
            startTransition(() => {
                addTransitionType("nav-back");
                router.push("/pos/sales/history");
            });
        } finally {
            setIsLoading(false);
        }
    };

    const handlePrintReturn = async (type: "return" | "refund") => {
        // Open dialog immediately with skeleton
        setReturnDetails(null);
        setIsRefundPrint(type === "refund");
        setIsLoadingReceipt(true);
        setShowReturnPrint(true);
        try {
            const res = await authFetch(`/pos-sales/orders/${orderId}/return-details?type=${type}`);
            if (res.ok && res.data?.status) {
                setReturnDetails(res.data.data);
            } else {
                toast.error(`Failed to load ${type} details`);
                setShowReturnPrint(false);
            }
        } catch {
            toast.error(`Failed to load ${type} details`);
            setShowReturnPrint(false);
        } finally {
            setIsLoadingReceipt(false);
        }
    };

    const handlePrintClaim = async (claimId: string) => {
        try {
            const res = await authFetch(`/pos-claims/${claimId}`);
            if (res.ok && res.data?.status) {
                setSelectedClaim(res.data.data);
                setShowClaimReceipt(true);
            } else {
                toast.error("Failed to load claim details");
            }
        } catch {
            toast.error("Failed to load claim details");
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading order details...</p>
                </div>
            </div>
        );
    }

    if (!order) return null;

    const totalPaid = order.tenders?.reduce((s: number, t: any) => s + Number(t.amount), 0) || 0;
    const balanceDue = Math.max(0, Number(order.grandTotal) - totalPaid);
    const isHold = order.status === "hold";
    const isToday = isSameDay(new Date(order.createdAt));

    return (
        <div className="flex flex-col h-screen">
            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between rounded-lg">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => {
                        startTransition(() => {
                            addTransitionType("nav-back");
                            router.push("/pos/sales/history");
                        });
                    }}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold">Order Details</h1>
                            <Badge variant="outline" className="font-mono text-xs border-primary/20 text-primary">
                                {order.orderNumber}
                            </Badge>
                            {isHold && (
                                <Badge variant="outline" className="uppercase text-xs px-2 border-amber-400 text-amber-600">
                                    <PauseCircle className="h-3 w-3 mr-1" /> On Hold
                                </Badge>
                            )}
                            {!isHold && (
                                <Badge variant={balanceDue > 0 ? "outline" : "default"}
                                    className={cn("uppercase text-xs px-2", balanceDue > 0 ? "border-orange-500 text-orange-500" : "bg-emerald-600")}>
                                    {balanceDue > 0 ? "Partial" : "Fully Paid"}
                                </Badge>
                            )}
                            <Badge variant={order.status === "completed" ? "default" : "secondary"}
                                className={cn("uppercase text-xs px-2", STATUS_BADGE[order.status] ?? "")}>
                                {order.status?.replace(/_/g, " ")}
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                            Placed on {new Date(order.createdAt).toLocaleString()}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {(order.hasReturn || order.status === 'returned' || order.status === 'partially_returned') && (
                        <Button variant="outline" onClick={() => handlePrintReturn("return")} className="gap-2">
                            <RotateCcw className="h-4 w-4" /> Return Slip
                        </Button>
                    )}
                    {(order.hasRefund || order.status === 'refunded' || (order.status === 'partially_returned' && !order.hasReturn && !order.hasRefund)) && (
                        <Button variant="outline" onClick={() => handlePrintReturn("refund")} className="gap-2 border-purple-300 text-purple-600 hover:bg-purple-50 hover:text-purple-700">
                            <RotateCcw className="h-4 w-4" /> Refund Slip
                        </Button>
                    )}
                    {!isHold && order.isGiftReceipt && (
                        <Button variant="outline" onClick={() => setShowGiftPrint(true)}
                            className="gap-2 border-pink-300 text-pink-600 hover:bg-pink-50 hover:text-pink-700">
                            <Printer className="h-4 w-4" /> Gift Receipt
                        </Button>
                    )}
                    {!isHold && (
                        <Button onClick={() => setShowPrint(true)} className="gap-2">
                            <Printer className="h-4 w-4" /> Print Receipt
                        </Button>
                    )}
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="max-w-7xl mx-auto p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 space-y-6">
                            <div className="space-y-3">
                                <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-foreground/70">
                                    <ShoppingCart className="h-5 w-5 text-muted-foreground" /> Items Breakdown
                                </h3>
                                <div className="grid grid-cols-1 gap-4">
                                    {order.items?.map((item: any, i: number) => {
                                        const retailPrice = Number(item.unitPrice);
                                        const qty = Number(item.quantity);
                                        const totalRetail = retailPrice * qty;
                                        const taxPercent = Number(item.taxPercent || 0);
                                        const taxDivisor = 1 + (taxPercent / 100);
                                        const wostPerUnit = retailPrice / taxDivisor;
                                        const totalWost = wostPerUnit * qty;
                                        const discountAmount = Number(item.discountAmount || 0);
                                        const afterDiscount = totalWost - discountAmount;
                                        const taxAmount = Number(item.taxAmount || 0);
                                        const lineTotal = Number(item.lineTotal || 0);

                                        const returnedQty = Number(item.returnedQty || 0);
                                        const remainingQty = qty - returnedQty;
                                        const isFullyReturned = remainingQty === 0;
                                        const isPartiallyReturned = returnedQty > 0 && remainingQty > 0;

                                        return (
                                            <div key={i} className={cn(
                                                "bg-card border rounded-2xl p-4 shadow-sm relative overflow-hidden transition-all hover:shadow-md",
                                                isFullyReturned ? "border-destructive/30 bg-destructive/5" : "border-border/60"
                                            )}>
                                                <div className="flex items-start justify-between gap-4">
                                                    <div>
                                                        <h4 className="font-bold text-sm text-foreground">{item.item?.description}</h4>
                                                        <p className="text-xs text-muted-foreground font-mono mt-0.5">{item.item?.sku}</p>
                                                    </div>
                                                    <div className="flex flex-wrap gap-1.5 justify-end">
                                                        {(item.item?.size?.name || (typeof item.item?.size === "string" && item.item.size)) && (
                                                            <Badge variant="secondary" className="text-[10px] py-0 px-2 font-bold bg-muted/65">
                                                                Size: {typeof item.item.size === "object" ? item.item.size.name : item.item.size}
                                                            </Badge>
                                                        )}
                                                        {(item.item?.color?.name || (typeof item.item?.color === "string" && item.item.color)) && (
                                                            <Badge variant="secondary" className="text-[10px] py-0 px-2 font-bold bg-muted/65">
                                                                Color: {typeof item.item.color === "object" ? item.item.color.name : item.item.color}
                                                            </Badge>
                                                        )}
                                                        <Badge variant="outline" className="text-[10px] py-0 px-2 font-bold border-primary/20 text-primary">
                                                            Qty: {qty}
                                                        </Badge>
                                                        {isPartiallyReturned && (
                                                            <Badge variant="outline" className="text-[10px] py-0 px-2 font-bold bg-amber-500/10 text-amber-600 border-amber-500/30">
                                                                Returned: {returnedQty}
                                                            </Badge>
                                                        )}
                                                        {isFullyReturned && (
                                                            <Badge variant="outline" className="text-[10px] py-0 px-2 font-bold bg-destructive/10 text-destructive border-destructive/30">
                                                                Returned
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>

                                                <Separator className="my-3 opacity-60" />

                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-2 gap-x-4 text-xs font-mono text-muted-foreground">
                                                    <div>
                                                        <span className="block text-[10px] uppercase font-bold tracking-wider text-muted-foreground/60 mb-0.5">Retail Price (Inc. Tax)</span>
                                                        <span className="text-foreground font-semibold">{formatCurrency(retailPrice)}</span>
                                                        <span className="text-[10px] block opacity-70">Total: {formatCurrency(totalRetail)}</span>
                                                    </div>
                                                    <div>
                                                        <span className="block text-[10px] uppercase font-bold tracking-wider text-muted-foreground/60 mb-0.5">WOST (Excl. Tax)</span>
                                                        <span className="text-foreground font-semibold">{formatCurrency(wostPerUnit)}</span>
                                                        <span className="text-[10px] block opacity-70">Total: {formatCurrency(totalWost)}</span>
                                                    </div>
                                                    <div>
                                                        <span className="block text-[10px] uppercase font-bold tracking-wider text-muted-foreground/60 mb-0.5">Discount</span>
                                                        <span className={cn("font-semibold", discountAmount > 0 ? "text-destructive" : "text-foreground")}>
                                                            {discountAmount > 0 ? `−${formatCurrency(discountAmount)}` : "—"}
                                                        </span>
                                                        {discountAmount > 0 && <span className="text-[10px] block opacity-70">Pct: {item.discountPercent}%</span>}
                                                    </div>
                                                    <div>
                                                        <span className="block text-[10px] uppercase font-bold tracking-wider text-muted-foreground/60 mb-0.5">After Discount</span>
                                                        <span className="text-foreground font-semibold">{formatCurrency(afterDiscount)}</span>
                                                    </div>
                                                    <div>
                                                        <span className="block text-[10px] uppercase font-bold tracking-wider text-muted-foreground/60 mb-0.5">Tax ({taxPercent}%)</span>
                                                        <span className={cn("font-semibold", taxAmount > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground")}>
                                                            {taxAmount > 0 ? `+${formatCurrency(taxAmount)}` : "—"}
                                                        </span>
                                                    </div>
                                                    <div className="border-l pl-3 sm:border-none sm:pl-0">
                                                        <span className="block text-[10px] uppercase font-bold tracking-wider text-muted-foreground/60 mb-0.5">Line Total</span>
                                                        <span className="text-sm text-foreground font-bold">{formatCurrency(lineTotal)}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {!isHold && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-foreground/70">
                                            <Wallet className="h-5 w-5 text-muted-foreground" /> Payment Information
                                        </h3>
                                        <span className="text-xs font-black uppercase text-muted-foreground px-3 py-1 bg-muted/50 rounded-lg">
                                            Total Paid: <span className="text-foreground ml-1">{formatCurrency(totalPaid)}</span>
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {order.tenders?.map((t: any, i: number) => (
                                            <div key={i} className="flex items-center justify-between px-4 py-3 rounded-2xl border border-border/80 bg-card shadow-sm">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="p-1.5 bg-background border border-border/40 rounded-lg shadow-sm">
                                                        <Wallet className="h-4 w-4 text-primary" />
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-muted-foreground uppercase">Method</p>
                                                        <p className="text-xs font-black capitalize">{t.method.replace("_", " ")}</p>
                                                    </div>
                                                    {t.cardLast4 && <span className="text-[9px] font-mono font-black text-primary ring-1 ring-primary/20 px-1.5 py-0.5 rounded-md bg-primary/5">••••{t.cardLast4}</span>}
                                                    {t.slipNo && <span className="text-[9px] font-mono font-black text-muted-foreground ring-1 ring-border px-1.5 py-0.5 rounded-md bg-muted/30">{t.method === "voucher" ? `#${t.slipNo}` : t.slipNo}</span>}
                                                    {t.voucherFaceValue && <span className="text-[9px] font-mono font-black text-amber-600 ring-1 ring-amber-500/20 px-1.5 py-0.5 rounded-md bg-amber-500/5">Val: {formatCurrency(t.voucherFaceValue)}</span>}
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[9px] font-black text-muted-foreground uppercase">Paid</p>
                                                    <p className="text-sm font-black font-mono">{formatCurrency(t.amount)}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {order.claims && order.claims.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-foreground/70">
                                        <RotateCcw className="h-5 w-5 text-muted-foreground" /> Warranty Claims
                                    </h3>
                                    <div className="space-y-3">
                                        {order.claims.map((claim: any, idx: number) => {
                                            const statusColors: Record<string, string> = {
                                                SUBMITTED: "bg-blue-500/10 text-blue-700 border-blue-300",
                                                UNDER_REVIEW: "bg-amber-500/10 text-amber-700 border-amber-300",
                                                APPROVED: "bg-green-500/10 text-green-700 border-green-300",
                                                PARTIALLY_APPROVED: "bg-emerald-500/10 text-emerald-700 border-emerald-300",
                                                REJECTED: "bg-red-500/10 text-red-700 border-red-300",
                                                CANCELLED: "bg-gray-500/10 text-gray-700 border-gray-300",
                                            };

                                            return (
                                                <div key={idx} className="rounded-2xl border border-border/60 overflow-hidden shadow-sm bg-card">
                                                    <div className="bg-muted/40 px-4 py-3 flex items-center justify-between">
                                                        <div className="flex items-center gap-3">
                                                            <Badge variant="outline" className="font-mono text-xs">
                                                                {claim.claimNumber}
                                                            </Badge>
                                                            <Badge variant="outline" className={cn("capitalize text-[10px] px-2 py-0.5", statusColors[claim.status] ?? "")}>
                                                                {claim.status.replace(/_/g, " ")}
                                                            </Badge>
                                                            <Badge variant="outline" className="capitalize text-[10px] px-2 py-0.5 bg-purple-500/10 text-purple-700 border-purple-300">
                                                                {claim.claimType}
                                                            </Badge>
                                                            {claim.transferRequestId && (
                                                                <Badge variant="outline" className="capitalize text-[10px] px-2 py-0.5 bg-blue-500/10 text-blue-700 border-blue-300">
                                                                    <ShoppingCart className="h-2.5 w-2.5 mr-1" />
                                                                    Transfer Created
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <Button 
                                                                size="sm" 
                                                                variant="outline" 
                                                                className="gap-2 h-8"
                                                                onClick={() => handlePrintClaim(claim.id)}
                                                            >
                                                                <Printer className="h-3.5 w-3.5" />
                                                                Print Claim Receipt
                                                            </Button>
                                                            <div className="text-right">
                                                                <p className="text-[9px] font-black text-muted-foreground uppercase">Submitted</p>
                                                                <p className="text-xs font-mono">{new Date(claim.submittedAt).toLocaleDateString()}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="p-4 space-y-3">
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div>
                                                                <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">Claimed Amount</p>
                                                                <p className="text-lg font-black font-mono">Rs. {fmtCurrency(claim.claimedAmount)}</p>
                                                            </div>
                                                            {(claim.status === 'APPROVED' || claim.status === 'PARTIALLY_APPROVED') && (
                                                                <div>
                                                                    <p className="text-[9px] font-black text-muted-foreground uppercase mb-1">Approved Amount</p>
                                                                    <p className="text-lg font-black font-mono text-green-600">Rs. {fmtCurrency(claim.approvedAmount)}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {claim.items && claim.items.length > 0 && (
                                                            <div className="space-y-2">
                                                                <p className="text-[9px] font-black text-muted-foreground uppercase">Claimed Items</p>
                                                                <div className="space-y-1.5">
                                                                    {claim.items.map((item: any, i: number) => (
                                                                        <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/30 border border-border/40">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="text-xs font-bold">Item #{i + 1}</span>
                                                                                <Badge variant="outline" className={cn("text-[8px] px-1.5 py-0", statusColors[item.itemStatus] ?? "")}>
                                                                                    {item.itemStatus}
                                                                                </Badge>
                                                                            </div>
                                                                            <div className="flex items-center gap-4 text-xs">
                                                                                <span className="text-muted-foreground">Claimed: <span className="font-bold text-foreground">{item.claimedQty}</span></span>
                                                                                {item.approvedQty > 0 && (
                                                                                    <span className="text-muted-foreground">Approved: <span className="font-bold text-green-600">{item.approvedQty}</span></span>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-6">
                            {order.customer ? (
                                <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm space-y-3">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-wider">
                                        <UserRound className="h-4 w-4 text-emerald-500" /> Customer Details
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-sm font-bold text-foreground">{order.customer.name}</p>
                                        <div className="text-xs text-muted-foreground space-y-1 font-mono">
                                            <div className="flex justify-between">
                                                <span>Code:</span>
                                                <span className="text-foreground">{order.customer.code}</span>
                                            </div>
                                            {order.customer.contactNo && (
                                                <div className="flex justify-between">
                                                    <span>Phone:</span>
                                                    <span className="text-foreground">{order.customer.contactNo}</span>
                                                </div>
                                            )}
                                            {order.customer.email && (
                                                <div className="flex justify-between">
                                                    <span>Email:</span>
                                                    <span className="text-foreground">{order.customer.email}</span>
                                                </div>
                                            )}
                                            {order.customer.address && (
                                                <div className="space-y-0.5 mt-1 border-t pt-1">
                                                    <span className="text-[10px] block opacity-75">Address:</span>
                                                    <span className="text-foreground block not-italic leading-normal">{order.customer.address}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm space-y-3">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-wider">
                                        <UserRound className="h-4 w-4 text-muted-foreground" /> Customer Details
                                    </div>
                                    <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-xl">
                                        <CheckCircle2 className="h-4 w-4" /> Walk-in Customer
                                    </div>
                                </div>
                            )}

                            {order.cashier ? (
                                <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm space-y-3">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-wider">
                                        <UserRound className="h-4 w-4 text-primary" /> Salesman / Cashier
                                    </div>
                                    <div className="space-y-2">
                                        <p className="text-sm font-bold text-foreground">{order.cashier.name}</p>
                                        <div className="text-xs text-muted-foreground space-y-1 font-mono">
                                            {order.cashier.empCode && (
                                                <div className="flex justify-between">
                                                    <span>Employee ID:</span>
                                                    <span className="text-foreground">{order.cashier.empCode}</span>
                                                </div>
                                            )}
                                            {order.cashier.email && (
                                                <div className="flex justify-between">
                                                    <span>Email:</span>
                                                    <span className="text-foreground">{order.cashier.email}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ) : order.cashierUserId ? (
                                <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm space-y-3">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-wider">
                                        <UserRound className="h-4 w-4 text-primary" /> Salesman / Cashier
                                    </div>
                                    <div className="text-xs text-muted-foreground font-mono">
                                        <div className="flex justify-between">
                                            <span>User ID:</span>
                                            <span className="text-foreground font-semibold">{order.cashierUserId.slice(0, 8)}...</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm space-y-3">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-wider">
                                        <UserRound className="h-4 w-4 text-muted-foreground" /> Salesman / Cashier
                                    </div>
                                    <p className="text-xs text-muted-foreground italic">Not Assigned</p>
                                </div>
                            )}

                            {(() => {
                                const subtotal = Number(order.subtotal || 0);
                                const taxAmount = Number(order.taxAmount || 0);
                                const grandTotal = Number(order.grandTotal || 0);
                                const totalDiscount = Number(order.discountAmount || 0);
                                const globalDiscount = Number(order.globalDiscountAmount || 0);
                                const itemDiscounts = Math.max(0, totalDiscount - globalDiscount);

                                const hasCoupon = !!order.coupon;
                                const hasPromo = !!order.promo;
                                const hasAlliance = !!order.alliance;
                                const globalDiscountPercent = Number(order.globalDiscountPercent || 0);
                                const isManualDiscount = globalDiscountPercent > 0 || (globalDiscount > 0 && !hasCoupon && !hasPromo && !hasAlliance);

                                const fbrPosFee = order.fbrInvoiceNumber ? 1 : 0;
                                const balanceDueValue = Math.max(0, grandTotal - totalPaid);
                                const changeAmount = Number(order.changeAmount || 0);

                                return (
                                    <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm space-y-4">
                                        <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-wider">
                                            <ShoppingCart className="h-4 w-4 text-primary" /> Totals Summary
                                        </div>
                                        <div className="space-y-2 text-xs font-mono">
                                            <div className="flex justify-between text-muted-foreground">
                                                <span>Subtotal</span>
                                                <span>{formatCurrency(subtotal)}</span>
                                            </div>

                                            {itemDiscounts > 0 && (
                                                <div className="flex justify-between text-destructive">
                                                    <span>Item Discounts</span>
                                                    <span>−{formatCurrency(itemDiscounts)}</span>
                                                </div>
                                            )}

                                            {globalDiscount > 0 && (
                                                <div className="flex justify-between text-primary">
                                                    <span>
                                                        {hasPromo && `Promo: ${order.promo?.code || order.promo?.name}`}
                                                        {hasCoupon && `Coupon: ${order.coupon?.code}`}
                                                        {hasAlliance && `Alliance: ${order.alliance?.partnerName}`}
                                                        {isManualDiscount && `Manual Discount${order.manualDiscountNote ? ` (${order.manualDiscountNote})` : ""}`}
                                                    </span>
                                                    <span>−{formatCurrency(globalDiscount)}</span>
                                                </div>
                                            )}

                                            {taxAmount > 0 && (
                                                <div className="flex justify-between text-amber-600 dark:text-amber-400">
                                                    <span>Total Tax</span>
                                                    <span>+{formatCurrency(taxAmount)}</span>
                                                </div>
                                            )}

                                            {fbrPosFee > 0 && (
                                                <div className="flex justify-between text-amber-600 dark:text-amber-400">
                                                    <span>FBR POS Fee</span>
                                                    <span>+{formatCurrency(fbrPosFee)}</span>
                                                </div>
                                            )}

                                            <Separator />

                                            <div className="flex justify-between text-base font-bold text-foreground pt-1">
                                                <span className="font-sans">Grand Total</span>
                                                <span>{formatCurrency(grandTotal)}</span>
                                            </div>

                                            <div className="flex justify-between text-muted-foreground">
                                                <span>Total Paid</span>
                                                <span>{formatCurrency(totalPaid)}</span>
                                            </div>

                                            {balanceDueValue > 0 && (
                                                <div className="flex justify-between text-orange-600 font-bold">
                                                    <span>Balance Due</span>
                                                    <span>{formatCurrency(balanceDueValue)}</span>
                                                </div>
                                            )}

                                            {changeAmount > 0 && (
                                                <div className="flex justify-between text-emerald-600 font-bold">
                                                    <span>Change Returned</span>
                                                    <span>{formatCurrency(changeAmount)}</span>
                                                </div>
                                            )}
                                        </div>

                                        {order.notes && (
                                            <div className="text-[11px] text-muted-foreground bg-muted/40 p-2.5 rounded-xl border border-border/30 italic">
                                                "{order.notes}"
                                            </div>
                                        )}
                                    </div>
                                );
                            })()}

                            {order.fbrInvoiceNumber && (
                                <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm space-y-3">
                                    <div className="flex items-center gap-2 text-muted-foreground text-xs font-bold uppercase tracking-wider">
                                        <QrCode className="h-4 w-4 text-amber-500" /> FBR Verification
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-muted-foreground">Invoice Number:</span>
                                            <span className="font-mono font-bold text-foreground">{order.fbrInvoiceNumber}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="text-muted-foreground">FBR Status:</span>
                                            <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-700 border-emerald-300">
                                                {order.fbrStatus || 'SYNCED'}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </ScrollArea>

            {showPrint && order && (
                <PrintReceipt
                    order={{ ...order, isGiftReceipt: false }}
                    tenders={order.tenders || []}
                    creditVouchers={order.creditVouchers}
                    onClose={() => setShowPrint(false)}
                />
            )}

            {showGiftPrint && order && (
                <PrintReceipt
                    order={{ ...order, isGiftReceipt: true }}
                    tenders={order.tenders || []}
                    creditVouchers={order.creditVouchers}
                    onClose={() => setShowGiftPrint(false)}
                />
            )}

            {showReturnPrint && order && (
                <PrintReturnReceipt
                    returnRef={
                        isRefundPrint
                            ? (returnDetails?.refundNumber || order.refundNumber || order.orderNumber || "")
                            : (returnDetails?.returnNumber || order.returnNumber || order.orderNumber || "")
                    }
                    isRefund={isRefundPrint}
                    isAlliance={!!order.alliance}
                    originalOrders={[{ orderNumber: order.orderNumber, grandTotal: Number(order.grandTotal) }]}
                    returnedLines={(returnDetails?.items ?? []).map((item: any) => ({
                        name: item.item?.description || "Unknown Item",
                        sku: item.item?.sku || "-",
                        brand: item.item?.brand?.name,
                        returnQty: item.returnableQty || item.quantity,
                        paidPerUnit: Number(item.originalPaidPerUnit || item.unitPrice),
                        refundAmount: Number(item.refundAmount || 0),
                        orderNumber: order.orderNumber,
                        unitPrice: Number(item.unitPrice || 0),
                        discountAmount: Number(item.discountAmount || 0),
                        discountPercent: Number(item.discountPercent || 0),
                        taxAmount: Number(item.taxAmount || 0),
                        taxPercent: Number(item.taxPercent || 0),
                        refundPerUnit: Number(item.refundPerUnit || item.unitPrice),
                        priceAdjusted: item.priceAdjusted || false,
                        originalPaidPerUnit: Number(item.originalPaidPerUnit || item.unitPrice),
                        couponDeduction: Number(item.couponDeduction || 0),
                    }))}
                    refundTotal={(returnDetails?.items ?? []).reduce((sum: number, item: any) => sum + Number(item.refundAmount || 0), 0)}
                    notes={returnDetails?.reason}
                    discountNotes={returnDetails?.discountNotes}
                    returnedAt={returnDetails?.returnedAt}
                    paymentMethod={order.paymentMethod}
                    customerName={order?.customer?.name || (order as any)?.customerName}
                    customerPhone={order?.customer?.phone || (order as any)?.customerPhone || (order as any)?.customerMobile}
                    isLoading={isLoadingReceipt}
                    onClose={() => { setShowReturnPrint(false); setIsLoadingReceipt(false); }}
                />
            )}

            {/* Claim Receipt */}
            {showClaimReceipt && selectedClaim && (
                <PrintClaimReceipt
                    claim={selectedClaim}
                    onClose={() => {
                        setShowClaimReceipt(false);
                        setSelectedClaim(null);
                    }}
                />
            )}
        </div>
    );
}
