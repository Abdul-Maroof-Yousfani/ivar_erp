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
} from "lucide-react";
import { PrintReceipt } from "@/components/pos/print-receipt";
import { PrintReturnReceipt } from "@/components/pos/print-return-receipt";
import { PrintClaimReceipt } from "@/components/pos/print-claim-receipt";
import { cn } from "@/lib/utils";
import { authFetch } from "@/lib/auth";

import { formatCurrency } from "@/lib/utils";

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

            {/* Content */}
            <ScrollArea className="flex-1">
                <div className="max-w-7xl mx-auto p-6 space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="bg-muted/50 px-4 py-3 rounded-xl border border-border/50">
                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Subtotal</p>
                            <p className="text-lg font-black tracking-tight">{formatCurrency(order.subtotal || 0)}</p>
                        </div>
                        <div className="bg-primary/5 px-4 py-3 rounded-xl border border-primary/20">
                            <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-1.5">Discount</p>
                            <p className="text-lg font-black tracking-tight text-primary">{formatCurrency(order.discountAmount || 0)}</p>
                        </div>
                        <div className="bg-primary px-4 py-3 rounded-xl shadow-lg shadow-primary/20">
                            <p className="text-[9px] font-black text-primary-foreground/70 uppercase tracking-widest mb-1.5">Grand Total</p>
                            <p className="text-lg font-black tracking-tight text-primary-foreground">{formatCurrency(order.grandTotal || 0)}</p>
                        </div>
                        {!isHold && (
                            <div className={cn("px-4 py-3 rounded-xl border shadow-lg",
                                balanceDue > 0 ? "bg-orange-500/10 border-orange-500/30 text-orange-600" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-600")}>
                                <p className="text-[9px] font-black uppercase tracking-widest mb-1.5 opacity-80">{balanceDue > 0 ? "Balance Due" : "Settled"}</p>
                                <p className="text-lg font-black tracking-tight">{formatCurrency(balanceDue)}</p>
                            </div>
                        )}
                    </div>

                    {/* Promo/Coupon/Alliance */}
                    {(order.promo || order.coupon || order.alliance || order.notes) && (
                        <div className="bg-muted/30 rounded-2xl p-4 border border-border/40 space-y-3">
                            <div className="flex flex-wrap gap-2">
                                {order.promo && (
                                    <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 gap-1.5 py-1 px-3 rounded-lg">
                                        <ShoppingCart className="h-3 w-3" />
                                        Promo: <span className="font-black">{order.promo.name || order.promo.code}</span>
                                    </Badge>
                                )}
                                {order.coupon && (
                                    <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-500/20 gap-1.5 py-1 px-3 rounded-lg">
                                        <Wallet className="h-3 w-3" />
                                        Coupon: <span className="font-black">{order.coupon.code}</span>
                                    </Badge>
                                )}
                                {order.alliance && (
                                    <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1.5 py-1 px-3 rounded-lg">
                                        <CalendarIcon className="h-3 w-3" />
                                        Alliance: <span className="font-black">{order.alliance.partnerName}</span>
                                    </Badge>
                                )}
                            </div>
                            {order.notes && (
                                <div className="text-xs text-muted-foreground bg-background/50 p-2.5 rounded-xl border border-border/30 italic">
                                    "{order.notes}"
                                </div>
                            )}
                        </div>
                    )}

                    {/* Items Table */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2 text-foreground/70">
                            <ShoppingCart className="h-5 w-5 text-muted-foreground" /> Items Breakdown
                        </h3>
                        <div className="rounded-2xl border border-border/60 overflow-hidden shadow-sm bg-card">
                            <Table>
                                <TableHeader className="bg-muted/40">
                                    <TableRow>
                                        <TableHead className="text-xs font-bold uppercase text-muted-foreground px-4">Item</TableHead>
                                        <TableHead className="text-center text-xs font-bold uppercase text-muted-foreground w-24">Size</TableHead>
                                        <TableHead className="text-center text-xs font-bold uppercase text-muted-foreground w-24">Color</TableHead>
                                        <TableHead className="text-center text-xs font-bold uppercase text-muted-foreground w-20">Qty</TableHead>
                                        {(order.status === 'returned' || order.status === 'partially_returned') && (
                                            <>
                                                <TableHead className="text-center text-xs font-bold uppercase text-destructive w-20">Ret</TableHead>
                                                <TableHead className="text-center text-xs font-bold uppercase text-emerald-600 w-20">Rem</TableHead>
                                            </>
                                        )}
                                        <TableHead className="text-right text-xs font-bold uppercase text-muted-foreground w-32">Price</TableHead>
                                        <TableHead className="text-right text-xs font-bold uppercase text-muted-foreground w-28">Disc</TableHead>
                                        <TableHead className="text-right text-xs font-bold uppercase text-muted-foreground pr-4 w-32">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {order.items?.map((item: any, i: number) => {
                                        const orderedQty = Number(item.quantity);
                                        const returnedQty = Number(item.returnedQty || 0);
                                        const remainingQty = orderedQty - returnedQty;
                                        const isFullyReturned = remainingQty === 0;
                                        const isPartiallyReturned = returnedQty > 0 && remainingQty > 0;

                                        return (
                                            <TableRow key={i} className={cn(
                                                "hover:bg-muted/10",
                                                isFullyReturned && "bg-destructive/5"
                                            )}>
                                                <TableCell className="px-4 py-3">
                                                    <div className="flex items-start gap-2">
                                                        <div className="flex-1">
                                                            <p className="font-bold text-sm">
                                                                {item.item?.description}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground font-mono">{item.item?.sku}</p>
                                                        </div>
                                                        {isPartiallyReturned && (
                                                            <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 bg-amber-500/10 text-amber-600 border-amber-500/30">
                                                                Partial
                                                            </Badge>
                                                        )}
                                                        {isFullyReturned && (
                                                            <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 bg-destructive/10 text-destructive border-destructive/30">
                                                                Returned
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <span className="inline-block px-2 py-0.5 rounded text-sm font-bold bg-muted/50">{item.item?.size?.name || "—"}</span>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <span className="inline-block px-2 py-0.5 rounded text-sm font-bold bg-muted/50">{item.item?.color?.name || "—"}</span>
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <span className="inline-block px-2 py-0.5 rounded text-sm font-bold bg-muted/50">{orderedQty}</span>
                                                </TableCell>
                                                {(order.status === 'returned' || order.status === 'partially_returned') && (
                                                    <>
                                                        <TableCell className="text-center">
                                                            {returnedQty > 0 ? (
                                                                <span className="inline-block px-2 py-0.5 rounded text-sm font-bold bg-destructive/10 text-destructive">{returnedQty}</span>
                                                            ) : (
                                                                <span className="text-muted-foreground text-sm">—</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            {remainingQty > 0 ? (
                                                                <span className="inline-block px-2 py-0.5 rounded text-sm font-bold bg-emerald-500/10 text-emerald-600">{remainingQty}</span>
                                                            ) : (
                                                                <span className="text-muted-foreground text-sm">—</span>
                                                            )}
                                                        </TableCell>
                                                    </>
                                                )}
                                                <TableCell className="text-right text-sm font-mono">{formatCurrency(item.unitPrice)}</TableCell>
                                                <TableCell className="text-right text-sm font-mono text-destructive">
                                                    {Number(item.discountAmount) > 0 ? `-${formatCurrency(item.discountAmount)}` : "—"}
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-sm font-mono pr-4">
                                                    {formatCurrency(item.lineTotal ?? (item.unitPrice - (item.discountAmount || 0)) * item.quantity)}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </div>

                    {/* Payment Information */}
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

                    {/* Claims Information */}
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
            </ScrollArea>

            {/* Print Modals */}
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
                    returnRef={order.orderNumber}
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
