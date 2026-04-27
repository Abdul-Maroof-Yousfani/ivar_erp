"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    ArrowLeft, Clock, Wallet, TrendingUp, Banknote, CreditCard,
    CheckCircle2, ChevronLeft, ChevronRight, ShoppingCart, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { authFetch } from "@/lib/auth";
import { useAuth } from "@/components/providers/auth-provider";

function fmt(val: number) {
    return val.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
import { formatCurrency } from "@/lib/utils";

function fmtTime(dateStr: string) {
    return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("en-PK", {
        day: "2-digit", month: "short", year: "numeric",
    });
}

function duration(openedAt: string, closedAt?: string | null) {
    const start = new Date(openedAt).getTime();
    const end = closedAt ? new Date(closedAt).getTime() : Date.now();
    const mins = Math.floor((end - start) / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

// ─── Shift Detail Modal ───────────────────────────────────────────────────────
function ShiftDetailModal({ shift, open, onOpenChange }: {
    shift: any; open: boolean; onOpenChange: (v: boolean) => void;
}) {
    if (!shift) return null;
    const variance = shift.difference;
    const isOpen = shift.status === "open";

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px] rounded-3xl">
                <DialogHeader>
                    <DialogTitle className="text-xl flex items-center gap-2">
                        <Clock className="w-5 h-5 text-primary" />
                        Shift Details
                    </DialogTitle>
                    <DialogDescription>
                        {fmtDate(shift.openedAt)} · {fmtTime(shift.openedAt)}
                        {shift.closedAt ? ` → ${fmtTime(shift.closedAt)}` : " (ongoing)"}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-2">
                    {/* Sales breakdown */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="bg-muted/50 rounded-2xl p-4 border border-border text-center">
                            <ShoppingCart className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
                            <p className="text-xs text-muted-foreground">Orders</p>
                            <p className="text-xl font-bold">{shift.metrics.orderCount}</p>
                        </div>
                        <div className="bg-muted/50 rounded-2xl p-4 border border-border text-center">
                            <Banknote className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
                            <p className="text-xs text-muted-foreground">Cash</p>
                            <p className="text-xl font-bold">{formatCurrency(shift.metrics.cashSales)}</p>
                        </div>
                        <div className="bg-muted/50 rounded-2xl p-4 border border-border text-center">
                            <CreditCard className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
                            <p className="text-xs text-muted-foreground">Card</p>
                            <p className="text-xl font-bold">{formatCurrency(shift.metrics.cardSales)}</p>
                        </div>
                    </div>

                    {/* Cash reconciliation */}
                    <div className="bg-muted/30 rounded-2xl p-4 border border-border space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Opening Float</span>
                            <span className="font-medium">{formatCurrency(shift.openingFloat)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Cash Sales</span>
                            <span className="font-medium">{formatCurrency(shift.metrics.cashSales)}</span>
                        </div>
                        <div className="flex justify-between border-t border-border pt-2">
                            <span className="font-semibold">Expected Cash</span>
                            <span className="font-bold">{formatCurrency(shift.expectedCash)}</span>
                        </div>
                        {!isOpen && shift.actualCash !== null && (
                            <>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Actual Cash</span>
                                    <span className="font-medium">{formatCurrency(shift.actualCash)}</span>
                                </div>
                                <div className="flex justify-between border-t border-border pt-2">
                                    <span className="font-semibold">Variance</span>
                                    <span className={cn("font-bold", variance < 0 ? "text-destructive" : variance > 0 ? "text-emerald-600" : "text-muted-foreground")}>
                                        {variance > 0 ? "+" : ""}{formatCurrency(variance ?? 0)}
                                    </span>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Notes */}
                    {(shift.openingNote || shift.closingNote) && (
                        <div className="space-y-1 text-sm">
                            {shift.openingNote && (
                                <p className="text-muted-foreground">
                                    <span className="font-medium text-foreground">Opening note:</span> {shift.openingNote}
                                </p>
                            )}
                            {shift.closingNote && (
                                <p className="text-muted-foreground">
                                    <span className="font-medium text-foreground">Closing note:</span> {shift.closingNote}
                                </p>
                            )}
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-full">
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ShiftsPage() {
    const router = useRouter();
    const { hasPermission } = useAuth();
    const canOpen = hasPermission('pos.shift.open');
    const canClose = hasPermission('pos.shift.close');

    // Current session state
    const [sessionData, setSessionData] = useState<any>(null);
    const [sessionLoading, setSessionLoading] = useState(true);

    // History state
    const [shifts, setShifts] = useState<any[]>([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [total, setTotal] = useState(0);

    // Modals
    const [showOpenModal, setShowOpenModal] = useState(false);
    const [showCloseModal, setShowCloseModal] = useState(false);
    const [showSummaryModal, setShowSummaryModal] = useState(false);
    const [selectedShift, setSelectedShift] = useState<any>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);

    // Form state
    const [floatAmount, setFloatAmount] = useState<number | "">("");
    const [floatNote, setFloatNote] = useState("");
    const [actualCash, setActualCash] = useState<number | "">("");
    const [closeNote, setCloseNote] = useState("");
    const [closeSummary, setCloseSummary] = useState<any>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchSession = useCallback(async () => {
        setSessionLoading(true);
        try {
            const res = await authFetch("/pos-session/current");
            setSessionData(res.ok ? (res.data || null) : null);
        } catch {
            toast.error("Failed to load current shift");
        } finally {
            setSessionLoading(false);
        }
    }, []);

    const fetchHistory = useCallback(async () => {
        setHistoryLoading(true);
        try {
            const res = await authFetch("/pos-session/history", { params: { page, limit: 15 } });
            if (res.ok) {
                setShifts(res.data?.data || []);
                setTotalPages(res.data?.meta?.totalPages || 1);
                setTotal(res.data?.meta?.total || 0);
            }
        } catch {
            toast.error("Failed to load shift history");
        } finally {
            setHistoryLoading(false);
        }
    }, [page]);

    useEffect(() => { fetchSession(); }, [fetchSession]);
    useEffect(() => { fetchHistory(); }, [fetchHistory]);

    const handleOpenShift = async () => {
        if (floatAmount === "" || Number(floatAmount) < 0) {
            toast.error("Enter a valid opening float amount");
            return;
        }
        setIsSubmitting(true);
        try {
            const res = await authFetch("/pos-session/current/open", {
                method: "PUT",
                body: { amount: Number(floatAmount), note: floatNote },
            });
            if (res.ok) {
                toast.success("Shift opened");
                setShowOpenModal(false);
                setFloatAmount(""); setFloatNote("");
                fetchSession(); fetchHistory();
            } else {
                toast.error(res.data?.message || "Failed to open shift");
            }
        } catch { toast.error("Failed to open shift"); }
        finally { setIsSubmitting(false); }
    };

    const handleCloseShift = async () => {
        if (actualCash === "" || Number(actualCash) < 0) {
            toast.error("Enter the counted cash amount");
            return;
        }
        setIsSubmitting(true);
        try {
            const res = await authFetch("/pos-session/current/close", {
                method: "POST",
                body: { actualCash: Number(actualCash), note: closeNote },
            });
            if (res.ok) {
                setCloseSummary({
                    expected: sessionData?.metrics?.expectedCash ?? 0,
                    actual: Number(actualCash),
                    variance: res.data?.variance ?? 0,
                });
                setShowCloseModal(false);
                setShowSummaryModal(true);
                fetchSession(); fetchHistory();
            } else {
                toast.error(res.data?.message || "Failed to close shift");
            }
        } catch { toast.error("Failed to close shift"); }
        finally { setIsSubmitting(false); }
    };

    const isDrawerOpen = sessionData?.isDrawerOpen;
    const hasSession = !!sessionData;
    const metrics = sessionData?.metrics || {};

    return (
        <div className="min-h-screen font-inter">
            {/* HEADER */}
            <div className="max-w-5xl mx-auto pt-6 px-4 mb-6">
                <div className="bg-card text-card-foreground rounded-[32px] p-4 flex items-center justify-between shadow-sm border border-border">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => router.push("/pos/new-sale")}
                            className="text-muted-foreground hover:bg-accent rounded-full">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">Shifts & Cash Drawer</h1>
                            <p className="text-sm text-muted-foreground">Manage your cash drawer and view shift history</p>
                        </div>
                    </div>
                    <div className={cn(
                        "px-4 py-2 rounded-full font-medium text-sm border",
                        !hasSession ? "bg-muted text-muted-foreground border-border" :
                            isDrawerOpen ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" :
                                "bg-amber-500/10 text-amber-600 border-amber-500/20"
                    )}>
                        {!hasSession ? "No Session" : isDrawerOpen ? "Shift Open" : "Shift Closed"}
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 space-y-6">
                {/* CURRENT SHIFT CARD */}
                <div className="bg-card rounded-[32px] p-8 shadow-sm border border-border">
                    <h2 className="text-base font-semibold mb-5 flex items-center gap-2 text-muted-foreground uppercase tracking-wide text-xs">
                        <Clock className="w-4 h-4" /> Cash Drawer — Current Shift
                    </h2>

                    {sessionLoading ? (
                        <p className="text-muted-foreground text-sm py-4">Loading...</p>
                    ) : !hasSession ? (
                        <div className="text-center py-8">
                            <Wallet className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                            <p className="text-muted-foreground mb-4">No active POS session. Log in to a terminal first.</p>
                            <Button onClick={() => router.push("/pos/login")} className="rounded-full px-8">
                                Go to Terminal Login
                            </Button>
                        </div>
                    ) : !isDrawerOpen ? (
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="font-semibold text-lg">Shift not started</p>
                                <p className="text-sm text-muted-foreground">Open the shift to start accepting cash sales</p>
                            </div>
                            <Button onClick={() => { setFloatAmount(""); setFloatNote(""); setShowOpenModal(true); }}
                                className="rounded-full px-8" disabled={!canOpen}>
                                Open Shift
                            </Button>
                        </div>
                    ) : (
                        <div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                <div className="bg-muted/50 rounded-2xl p-5 border border-border">
                                    <p className="text-xs text-muted-foreground mb-1">Opening Float</p>
                                    <p className="text-2xl font-bold">{formatCurrency(metrics.openingFloat || 0)}</p>
                                </div>
                                <div className="bg-muted/50 rounded-2xl p-5 border border-border">
                                    <p className="text-xs text-muted-foreground mb-1">Cash Sales</p>
                                    <p className="text-2xl font-bold">{formatCurrency(metrics.cashSales || 0)}</p>
                                </div>
                                <div className="bg-primary/10 rounded-2xl p-5 border border-primary/20 md:col-span-2">
                                    <p className="text-xs text-primary mb-1">Expected Cash in Drawer</p>
                                    <p className="text-2xl font-black text-primary">{formatCurrency(metrics.expectedCash || 0)}</p>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-border">
                                <Button variant="outline" onClick={() => router.push("/pos/new-sale")} className="rounded-full px-6">
                                    Continue Selling
                                </Button>
                                <Button onClick={() => { setActualCash(""); setCloseNote(""); setShowCloseModal(true); }}
                                    className="rounded-full px-8 bg-slate-800 hover:bg-slate-900 text-white" disabled={!canClose}>
                                    Close Shift
                                </Button>
                            </div>
                        </div>
                    )}
                </div>

                {/* SHIFT HISTORY TABLE */}
                <div className="bg-card rounded-[32px] p-8 shadow-sm border border-border">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" /> Shift History
                            {total > 0 && <span className="text-foreground">({total})</span>}
                        </h2>
                    </div>

                    {historyLoading ? (
                        <p className="text-muted-foreground text-sm py-6 text-center">Loading history...</p>
                    ) : shifts.length === 0 ? (
                        <p className="text-muted-foreground text-sm py-6 text-center">No shifts recorded yet.</p>
                    ) : (
                        <>
                            <div className="rounded-2xl border border-border overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow className="bg-muted/30">
                                            <TableHead>Date</TableHead>
                                            <TableHead>Opened</TableHead>
                                            <TableHead>Closed</TableHead>
                                            <TableHead>Duration</TableHead>
                                            <TableHead className="text-right">Orders</TableHead>
                                            <TableHead className="text-right">Total Sales</TableHead>
                                            <TableHead className="text-right">Variance</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {shifts.map((shift) => {
                                            const variance = shift.difference;
                                            const isOpen = shift.status === "open";
                                            return (
                                                <TableRow
                                                    key={shift.id}
                                                    className="cursor-pointer hover:bg-muted/30 transition-colors"
                                                    onClick={() => { setSelectedShift(shift); setShowDetailModal(true); }}
                                                >
                                                    <TableCell className="font-medium">{fmtDate(shift.openedAt)}</TableCell>
                                                    <TableCell className="text-muted-foreground">{fmtTime(shift.openedAt)}</TableCell>
                                                    <TableCell className="text-muted-foreground">
                                                        {shift.closedAt ? fmtTime(shift.closedAt) : "—"}
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground text-sm">
                                                        {duration(shift.openedAt, shift.closedAt)}
                                                    </TableCell>
                                                    <TableCell className="text-right">{shift.metrics.orderCount}</TableCell>
                                                    <TableCell className="text-right font-semibold">
                                                        {formatCurrency(shift.metrics.totalSales)}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {isOpen ? (
                                                            <span className="text-muted-foreground text-xs">—</span>
                                                        ) : variance === null ? (
                                                            <span className="text-muted-foreground text-xs">—</span>
                                                        ) : (
                                                            <span className={cn("font-semibold text-sm flex items-center justify-end gap-1",
                                                                variance < 0 ? "text-destructive" : variance > 0 ? "text-emerald-600" : "text-muted-foreground"
                                                            )}>
                                                                {variance !== 0 && <AlertTriangle className="w-3 h-3" />}
                                                                {variance > 0 ? "+" : ""}{formatCurrency(variance)}
                                                            </span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className={cn(
                                                            "text-[10px] px-2 py-0 h-5 capitalize",
                                                            isOpen
                                                                ? "bg-emerald-500/10 text-emerald-700 border-emerald-300"
                                                                : "bg-muted text-muted-foreground border-border"
                                                        )}>
                                                            {shift.status}
                                                        </Badge>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-end gap-2 mt-4">
                                    <Button variant="ghost" size="icon" className="rounded-full h-8 w-8"
                                        disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                                        <ChevronLeft className="w-4 h-4" />
                                    </Button>
                                    <span className="text-sm text-muted-foreground">
                                        Page {page} of {totalPages}
                                    </span>
                                    <Button variant="ghost" size="icon" className="rounded-full h-8 w-8"
                                        disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                                        <ChevronRight className="w-4 h-4" />
                                    </Button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* OPEN SHIFT MODAL */}
            <Dialog open={showOpenModal} onOpenChange={setShowOpenModal}>
                <DialogContent className="sm:max-w-[420px] rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl">Open Shift</DialogTitle>
                        <DialogDescription>Enter the starting float amount in the cash drawer.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="space-y-2">
                            <Label>Opening Float (Rs.)</Label>
                            <Input type="number" min="0" value={floatAmount}
                                onChange={(e) => setFloatAmount(e.target.value ? Number(e.target.value) : "")}
                                className="rounded-xl h-12 text-lg px-4 bg-muted/30 border-transparent focus-visible:ring-primary"
                                placeholder="0" />
                        </div>
                        <div className="space-y-2">
                            <Label>Note (Optional)</Label>
                            <Textarea value={floatNote} onChange={(e) => setFloatNote(e.target.value)}
                                className="rounded-xl bg-muted/30 border-transparent focus-visible:ring-primary resize-none"
                                placeholder="E.g. Morning shift" rows={2} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowOpenModal(false)} className="rounded-full">Cancel</Button>
                        <Button onClick={handleOpenShift} disabled={isSubmitting} className="rounded-full px-8">
                            Open Shift
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* CLOSE SHIFT MODAL */}
            <Dialog open={showCloseModal} onOpenChange={setShowCloseModal}>
                <DialogContent className="sm:max-w-[420px] rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl">Close Shift</DialogTitle>
                        <DialogDescription>Count the cash and enter the actual amount in the drawer.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="bg-muted/50 p-4 rounded-xl border border-border flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">Expected Cash</span>
                            <span className="font-bold">{formatCurrency(metrics.expectedCash || 0)}</span>
                        </div>
                        <div className="space-y-2">
                            <Label>Actual Counted Cash (Rs.)</Label>
                            <Input type="number" min="0" value={actualCash}
                                onChange={(e) => setActualCash(e.target.value ? Number(e.target.value) : "")}
                                className="rounded-xl h-12 text-lg px-4 bg-destructive/5 border-destructive/20 focus-visible:ring-destructive"
                                placeholder="Enter counted amount..." />
                        </div>
                        <div className="space-y-2">
                            <Label>Closing Note (Optional)</Label>
                            <Textarea value={closeNote} onChange={(e) => setCloseNote(e.target.value)}
                                className="rounded-xl bg-muted/30 border-transparent focus-visible:ring-primary resize-none"
                                placeholder="Reason for variance or general note" rows={2} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowCloseModal(false)} className="rounded-full">Cancel</Button>
                        <Button onClick={handleCloseShift} disabled={isSubmitting}
                            className="rounded-full px-8 bg-slate-800 hover:bg-slate-900 text-white">
                            Confirm & Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* POST-CLOSE SUMMARY MODAL */}
            <Dialog open={showSummaryModal} onOpenChange={setShowSummaryModal}>
                <DialogContent className="sm:max-w-[380px] rounded-3xl" showCloseButton={false}>
                    <div className="pt-6 pb-2 text-center">
                        <CheckCircle2 className="w-14 h-14 text-emerald-500 mx-auto mb-3" />
                        <h2 className="text-2xl font-bold mb-1">Shift Closed</h2>
                        <p className="text-muted-foreground mb-5">Your shift has been recorded.</p>
                        <div className="bg-muted/50 rounded-2xl p-4 text-left space-y-3 mb-5 border border-border">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Expected Cash</span>
                                <span className="font-medium">{formatCurrency(closeSummary?.expected || 0)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Actual Cash</span>
                                <span className="font-medium">{formatCurrency(closeSummary?.actual || 0)}</span>
                            </div>
                            <div className="flex justify-between border-t border-border pt-3">
                                <span className="font-semibold">Variance</span>
                                <span className={cn("font-bold",
                                    (closeSummary?.variance ?? 0) < 0 ? "text-destructive" :
                                        (closeSummary?.variance ?? 0) > 0 ? "text-emerald-600" : "text-muted-foreground"
                                )}>
                                    {(closeSummary?.variance ?? 0) > 0 ? "+" : ""}{formatCurrency(closeSummary?.variance || 0)}
                                </span>
                            </div>
                        </div>
                        <Button onClick={() => setShowSummaryModal(false)} className="w-full rounded-full h-11">
                            Done
                        </Button>
                        <Button
                            variant="ghost"
                            onClick={() => { setShowSummaryModal(false); router.push("/pos/login"); }}
                            className="w-full rounded-full h-11 mt-2 text-muted-foreground"
                        >
                            Back to Terminal Login
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* SHIFT DETAIL MODAL */}
            <ShiftDetailModal
                shift={selectedShift}
                open={showDetailModal}
                onOpenChange={setShowDetailModal}
            />
        </div>
    );
}
