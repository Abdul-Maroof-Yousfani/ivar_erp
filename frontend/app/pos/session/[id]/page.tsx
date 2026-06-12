"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
    ArrowLeft, Printer, FileText, Clock, Wallet, Banknote,
    AlertTriangle, CreditCard, User, MapPin, Loader2, Monitor, 
    TrendingUp, LayoutDashboard
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { authFetch } from "@/lib/auth";
import { PrintReconciliation } from "@/components/pos/print-reconciliation";

export default function SessionSummaryPage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const sessionId = params.id as string;
    const dateQuery = searchParams?.get("date");
    
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [showPrintModal, setShowPrintModal] = useState(false);

    useEffect(() => {
        if (!sessionId) return;
        
        const fetchDetails = async () => {
            setLoading(true);
            try {
                let resolvedId = sessionId;
                if (sessionId === "current") {
                    const currentRes = await authFetch("/pos-session/current");
                    if (currentRes.ok && currentRes.data) {
                        const id = currentRes.data.session?.id || currentRes.data.id;
                        if (id) {
                            resolvedId = id;
                        } else {
                            toast.error("No active POS session found");
                            router.replace("/pos/shifts");
                            return;
                        }
                    } else {
                        toast.error("No active POS session found");
                        router.replace("/pos/shifts");
                        return;
                    }
                }

                const url = `/pos-session/${resolvedId}/reconciliation${dateQuery ? `?date=${dateQuery}` : ""}`;
                const res = await authFetch(url);
                if (res.ok) {
                    setData(res.data);
                } else {
                    toast.error(res.data?.message || "Failed to load session details");
                }
            } catch (err) {
                toast.error("Failed to fetch session report.");
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [sessionId, dateQuery, router]);

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center font-inter text-center p-6">
                <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
                <h2 className="text-xl font-semibold">Loading Session Data</h2>
                <p className="text-muted-foreground">Fetching complete reconciliation report...</p>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center font-inter text-center p-6">
                <AlertTriangle className="w-12 h-12 text-destructive mb-4" />
                <h2 className="text-2xl font-bold mb-2">Session Not Found</h2>
                <p className="text-muted-foreground mb-6">Could not load the requested session summary.</p>
                <Button onClick={() => router.push("/pos/shifts")} className="rounded-full px-8">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Shifts
                </Button>
            </div>
        );
    }

    const { session, metrics, paymentBreakdown } = data;
    const isOpen = session.status === "open";
    const variance = session.difference;

    return (
        <div className="min-h-screen font-inter pb-20">
            {/* HEADER */}
            <div className="max-w-6xl mx-auto pt-6 px-4 mb-6">
                <div className="bg-card text-card-foreground rounded-[32px] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between shadow-sm border border-border gap-4">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => router.push("/pos/shifts")} 
                            className="text-muted-foreground hover:bg-accent rounded-full shrink-0">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div>
                            <div className="flex items-center gap-3 mb-1">
                                <h1 className="text-xl font-bold tracking-tight">Session Summary</h1>
                                <Badge variant="outline" className={cn(
                                    "capitalize px-2.5 py-0.5 text-xs font-semibold rounded-full",
                                    isOpen 
                                        ? "bg-emerald-500/10 text-emerald-700 border-emerald-300"
                                        : "bg-muted text-muted-foreground border-border"
                                )}>
                                    {session.status}
                                </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground font-mono bg-muted/50 px-2 py-0.5 rounded-md inline-block">
                                ID: {session.id}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Button 
                            variant="outline" 
                            className="rounded-full flex-1 sm:flex-none gap-2 px-6"
                            onClick={() => setShowPrintModal(true)}
                        >
                            <Printer className="w-4 h-4" />
                            Print Report
                        </Button>
                    </div>
                </div>
            </div>

            {data?.availableDates && data.availableDates.length > 1 && (
                <div className="max-w-6xl mx-auto px-4 mb-6 flex justify-center animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="flex items-center gap-1.5 bg-card border border-border p-1 rounded-full shadow-sm">
                        {data.availableDates.map((d: string) => {
                            const formatted = new Date(d).toLocaleDateString("en-PK", {
                                day: "2-digit", month: "short", year: "numeric"
                            });
                            const isActive = data.selectedDate === d;
                            return (
                                <Button
                                    key={d}
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => router.push(`/pos/session/${sessionId}?date=${d}`)}
                                    className={cn(
                                        "rounded-full h-8 px-4 text-xs font-bold transition-all",
                                        isActive ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:bg-muted"
                                    )}
                                >
                                    {formatted}
                                </Button>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="max-w-6xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* LEFT COLUMN: Meta & Drawer */}
                <div className="lg:col-span-1 space-y-6">
                    {/* Meta Info Card */}
                    <div className="bg-card rounded-[32px] p-6 shadow-sm border border-border">
                        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-5">
                            <LayoutDashboard className="w-4 h-4" /> Overview
                        </h2>
                        
                        <div className="space-y-4">
                            <div className="flex items-start gap-3 p-3 rounded-2xl bg-muted/30 border border-border/50">
                                <div className="bg-primary/10 p-2 rounded-xl text-primary">
                                    <Monitor className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground font-medium mb-0.5">Terminal</p>
                                    <p className="font-semibold text-sm">{session.terminal.terminalCode} ({session.terminal.name})</p>
                                    <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                        <MapPin className="w-3 h-3" /> {session.terminal.locationName}
                                    </p>
                                </div>
                            </div>
                            
                            <div className="flex items-start gap-3 p-3 rounded-2xl bg-muted/30 border border-border/50">
                                <div className="bg-blue-500/10 p-2 rounded-xl text-blue-600">
                                    <User className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground font-medium mb-0.5">Cashier</p>
                                    <p className="font-semibold text-sm">{session.cashier.fullName}</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3 p-3 rounded-2xl bg-muted/30 border border-border/50">
                                <div className="bg-amber-500/10 p-2 rounded-xl text-amber-600">
                                    <Clock className="w-5 h-5" />
                                </div>
                                <div className="w-full">
                                    <div className="flex justify-between items-center mb-1">
                                        <p className="text-xs text-muted-foreground font-medium">Opened At</p>
                                        <p className="text-xs font-semibold">{new Date(session.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                                    </div>
                                    <p className="text-sm font-medium mb-2">{new Date(session.openedAt).toLocaleDateString()}</p>
                                    
                                    <div className="border-t border-border/50 my-2"></div>
                                    
                                    <div className="flex justify-between items-center mb-1">
                                        <p className="text-xs text-muted-foreground font-medium">Closed At</p>
                                        <p className="text-xs font-semibold">
                                            {session.closedAt ? new Date(session.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}
                                        </p>
                                    </div>
                                    <p className="text-sm font-medium">
                                        {session.closedAt ? new Date(session.closedAt).toLocaleDateString() : <span className="italic text-muted-foreground">Ongoing</span>}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Notes Card */}
                    {(session.openingNote || session.closingNote) && (
                        <div className="bg-card rounded-[32px] p-6 shadow-sm border border-border">
                            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-4">
                                <FileText className="w-4 h-4" /> Remarks
                            </h2>
                            <div className="space-y-4">
                                {session.openingNote && (
                                    <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-2xl">
                                        <p className="text-xs font-bold text-emerald-700 uppercase mb-1">Opening Note</p>
                                        <p className="text-sm italic text-emerald-900/80 dark:text-emerald-100">"{session.openingNote}"</p>
                                    </div>
                                )}
                                {session.closingNote && (
                                    <div className="bg-slate-500/5 border border-slate-500/10 p-4 rounded-2xl">
                                        <p className="text-xs font-bold text-slate-700 uppercase mb-1">Closing Note</p>
                                        <p className="text-sm italic text-slate-900/80 dark:text-slate-100">"{session.closingNote}"</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT COLUMN: Financials */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Cash Drawer Widget */}
                    <div className="bg-card rounded-[32px] p-6 sm:p-8 shadow-sm border border-border relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
                            <Wallet className="w-32 h-32" />
                        </div>
                        <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-6">
                            <Banknote className="w-4 h-4" /> Cash Drawer Reconciliation
                        </h2>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            <div className="bg-muted/40 rounded-2xl p-4 sm:p-5 border border-border/50 text-center flex flex-col items-center justify-center">
                                <p className="text-xs text-muted-foreground font-semibold mb-1 uppercase">Float</p>
                                <p className="text-xl sm:text-2xl font-black text-foreground">{formatCurrency(session.openingFloat)}</p>
                            </div>
                            <div className="bg-muted/40 rounded-2xl p-4 sm:p-5 border border-border/50 text-center flex flex-col items-center justify-center">
                                <p className="text-xs text-muted-foreground font-semibold mb-1 uppercase">Expected</p>
                                <p className="text-xl sm:text-2xl font-black text-foreground">{formatCurrency(session.expectedCash)}</p>
                            </div>
                            <div className="bg-muted/40 rounded-2xl p-4 sm:p-5 border border-border/50 text-center flex flex-col items-center justify-center">
                                <p className="text-xs text-muted-foreground font-semibold mb-1 uppercase">Actual</p>
                                <p className="text-xl sm:text-2xl font-black text-foreground">
                                    {session.actualCash !== null ? formatCurrency(session.actualCash) : "—"}
                                </p>
                            </div>
                            <div className={cn(
                                "rounded-2xl p-4 sm:p-5 border text-center flex flex-col items-center justify-center transition-colors",
                                variance === null ? "bg-muted/40 border-border/50 text-foreground" :
                                variance < 0 ? "bg-destructive/10 border-destructive/20 text-destructive" :
                                variance > 0 ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" :
                                "bg-muted/40 border-border/50 text-foreground"
                            )}>
                                <p className="text-xs font-semibold mb-1 uppercase opacity-80">Variance</p>
                                <p className="text-xl sm:text-2xl font-black">
                                    {variance === null ? "—" : `${variance > 0 ? "+" : ""}${formatCurrency(variance)}`}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Sales & Payments Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Financial Metrics */}
                        <div className="bg-card rounded-[32px] p-6 shadow-sm border border-border">
                            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-6">
                                <TrendingUp className="w-4 h-4" /> Financial Summary
                            </h2>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-muted/40 transition-colors">
                                    <span className="text-sm font-medium text-muted-foreground">Gross Sales</span>
                                    <span className="font-bold text-foreground">{formatCurrency(metrics.grossSales)}</span>
                                </div>
                                <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-muted/40 transition-colors">
                                    <span className="text-sm font-medium text-muted-foreground">Total Discounts</span>
                                    <span className="font-bold text-destructive">{formatCurrency(metrics.totalDiscounts)}</span>
                                </div>
                                <div className="flex items-center justify-between p-3 rounded-2xl hover:bg-muted/40 transition-colors">
                                    <span className="text-sm font-medium text-muted-foreground">Total Taxes</span>
                                    <span className="font-bold text-foreground">{formatCurrency(metrics.totalTaxes)}</span>
                                </div>
                                <Separator className="my-2" />
                                <div className="flex items-center justify-between p-4 rounded-2xl bg-primary/5 border border-primary/10">
                                    <span className="text-sm font-bold text-primary uppercase">Net Sales</span>
                                    <span className="font-black text-xl text-primary">{formatCurrency(metrics.netSales)}</span>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3 mt-4">
                                    <div className="bg-muted/30 p-3 rounded-2xl border border-border/50 text-center">
                                        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5">Total Orders</p>
                                        <p className="font-bold text-lg">{metrics.orderCount}</p>
                                    </div>
                                    <div className="bg-muted/30 p-3 rounded-2xl border border-border/50 text-center">
                                        <p className="text-[10px] uppercase font-bold text-muted-foreground mb-0.5">Average Order</p>
                                        <p className="font-bold text-lg">{formatCurrency(metrics.averageOrderValue)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Payment Breakdown */}
                        <div className="bg-card rounded-[32px] p-6 shadow-sm border border-border flex flex-col">
                            <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 mb-6">
                                <CreditCard className="w-4 h-4" /> Payments by Method
                            </h2>
                            
                            <div className="flex-1 flex flex-col justify-center space-y-4">
                                {/* Cash */}
                                <div className="flex items-center justify-between p-4 rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-emerald-500/10 p-2.5 rounded-xl text-emerald-600">
                                            <Banknote className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm">Cash Sales</p>
                                            <p className="text-xs text-muted-foreground">{paymentBreakdown.cash.count} order(s)</p>
                                        </div>
                                    </div>
                                    <p className="font-bold text-lg">{formatCurrency(paymentBreakdown.cash.amount)}</p>
                                </div>

                                {/* Card */}
                                <div className="flex items-center justify-between p-4 rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-blue-500/10 p-2.5 rounded-xl text-blue-600">
                                            <CreditCard className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm">Card Sales</p>
                                            <p className="text-xs text-muted-foreground">{paymentBreakdown.card.count} order(s)</p>
                                        </div>
                                    </div>
                                    <p className="font-bold text-lg">{formatCurrency(paymentBreakdown.card.amount)}</p>
                                </div>

                                {/* Voucher */}
                                <div className="flex items-center justify-between p-4 rounded-2xl border border-border bg-card shadow-sm hover:shadow-md transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-amber-500/10 p-2.5 rounded-xl text-amber-600">
                                            <Wallet className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm">Gift Vouchers</p>
                                            <p className="text-xs text-muted-foreground">{paymentBreakdown.voucher.count} order(s)</p>
                                        </div>
                                    </div>
                                    <p className="font-bold text-lg">{formatCurrency(paymentBreakdown.voucher.amount)}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <PrintReconciliation
                sessionId={sessionId}
                open={showPrintModal}
                onOpenChange={setShowPrintModal}
            />
        </div>
    );
}
