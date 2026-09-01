"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, Wallet, ArrowRight, Loader2, Lock, X, Clock, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/components/providers/auth-provider";
import { authFetch } from "@/lib/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function ShiftGuard({ children }: { children: React.ReactNode }) {
    const { user, isAdmin, hasPermission, logout } = useAuth();
    const isParentTerminal = user?.terminal ? user.terminal.isParent : true;
    const pathname = usePathname();
    const router = useRouter();

    const [sessionData, setSessionData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form inputs for opening shift
    const [floatAmount, setFloatAmount] = useState<number | "">("");
    const [floatNote, setFloatNote] = useState("");

    // Real-time clock for countdown
    const [currentTime, setCurrentTime] = useState(new Date());

    // Dismissal states for reminder banner
    const [isDismissed, setIsDismissed] = useState(false);
    const [dismissedUntil, setDismissedUntil] = useState<number | null>(null);
    const [prevUrgencyLevel, setPrevUrgencyLevel] = useState<string>("quiet");

    // Start clock interval
    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    // Helper to calculate local midnight deadline relative to openedAt date
    const getDeadline = (openedAtVal: string) => {
        const openedDate = new Date(openedAtVal);
        const deadlineDate = new Date(openedDate);
        deadlineDate.setHours(24, 0, 0, 0); // Midnight of the next day (end of openedAt day) in local time
        return deadlineDate;
    };

    const openedAtStr = sessionData?.session?.openedAt;
    const deadline = openedAtStr ? getDeadline(openedAtStr) : null;
    const msDiff = deadline ? deadline.getTime() - currentTime.getTime() : 0;
    const isPastDeadline = deadline ? msDiff <= 0 : false;

    // Remaining time calculations
    const absMs = Math.abs(msDiff);
    const remainingHours = Math.floor(absMs / (1000 * 60 * 60));
    const remainingMinutes = Math.floor((absMs % (1000 * 60 * 60)) / (1000 * 60));
    const remainingSeconds = Math.floor((absMs % (1000 * 60)) / 1000);

    // Determine urgency level
    const getUrgencyLevel = (diff: number) => {
        if (diff <= 0) return "overdue";
        if (diff <= 1 * 60 * 60 * 1000) return "high"; // <= 1 hour
        if (diff <= 2 * 60 * 60 * 1000) return "medium"; // <= 2 hours
        if (diff <= 3 * 60 * 60 * 1000) return "low"; // <= 3 hours
        return "quiet";
    };

    const urgencyLevel = deadline ? getUrgencyLevel(msDiff) : "quiet";

    // Track escalation to reset user dismissals
    useEffect(() => {
        if (urgencyLevel !== prevUrgencyLevel) {
            setIsDismissed(false);
            setDismissedUntil(null);
            setPrevUrgencyLevel(urgencyLevel);
        }
    }, [urgencyLevel, prevUrgencyLevel]);

    const isCurrentlyDismissed = isDismissed && dismissedUntil !== null && Date.now() < dismissedUntil;

    const fetchSession = useCallback(async () => {
        try {
            const res = await authFetch("/pos-session/current");
            if (res.ok) {
                setSessionData(res.data || null);
            } else {
                setSessionData(null);
            }
        } catch {
            setSessionData(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Fetch session status on mount
        fetchSession();

        // Listen for a custom window event to force-refresh the guard state when shifts are opened/closed in shifts page
        const handleShiftUpdate = () => {
            fetchSession();
        };
        window.addEventListener("shift-session-updated", handleShiftUpdate);
        return () => window.removeEventListener("shift-session-updated", handleShiftUpdate);
    }, [fetchSession]);

    const handleOpenShift = async (e: React.FormEvent) => {
        e.preventDefault();
        if (floatAmount === "" || Number(floatAmount) < 0) {
            toast.error("Please enter a valid starting float amount");
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await authFetch("/pos-session/current/open", {
                method: "PUT",
                body: {
                    amount: Number(floatAmount),
                    note: floatNote,
                },
            });

            if (res.ok) {
                toast.success("Shift successfully opened! POS unlocked.");
                setFloatAmount("");
                setFloatNote("");
                
                // Refetch session locally
                await fetchSession();

                // Dispatch global event so other pages (like shifts/page.tsx) know they should refetch
                window.dispatchEvent(new Event("shift-session-updated"));
            } else {
                toast.error(res.data?.message || "Failed to open shift drawer");
            }
        } catch {
            toast.error("An error occurred while opening the shift.");
        } finally {
            setIsSubmitting(false);
        }
    };

    // ─── BYPASS RULES ───
    
    // 1. If loading active session, show premium loading screen to prevent any layout flash
    if (loading) {
        return (
            <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm gap-4">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
                <p className="text-sm font-semibold tracking-tight text-muted-foreground">Verifying Active Shift Status...</p>
            </div>
        );
    }

    // 2. Super Admins/Managers bypass shift float requirements on non-transactional routes,
    // but MUST open a shift to access transactional views (new-sale, checkout, pos dashboard)
    const isTransactionalPath = pathname === "/pos" || pathname === "/pos/new-sale" || pathname === "/pos/checkout";
    if (isAdmin() && !isTransactionalPath) {
        return <>{children}</>;
    }

    // 3. Always exclude the Shift Management screen itself so users can click "Open Shift" or view history
    if (pathname === "/pos/shifts") {
        return <>{children}</>;
    }

    const isDrawerOpen = sessionData?.isDrawerOpen;
    const hasSession = !!sessionData;

    // 4. If the drawer/shift is already open, check if a warning/reconciliation banner is needed
    if (hasSession && isDrawerOpen) {
        // RENDER POS VIEW WRAPPED WITH REMINDER BANNER IF TIME-NEARING OR OVERDUE
        return (
            <div className="flex flex-col h-full w-full">
                {/* Reconciliation Banner */}
                {deadline && urgencyLevel !== "quiet" && !isCurrentlyDismissed && (
                    <div className={cn(
                        "w-full px-6 py-3 border-b flex items-center justify-between transition-all duration-300 shadow-xs",
                        urgencyLevel === "low" && "bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400",
                        urgencyLevel === "medium" && "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400",
                        urgencyLevel === "high" && "bg-destructive/15 border-destructive/25 text-destructive animate-pulse",
                        urgencyLevel === "overdue" && "bg-destructive/20 border-destructive/30 text-destructive font-bold animate-pulse"
                    )}>
                        <div className="flex items-center gap-3">
                            {(urgencyLevel === "high" || urgencyLevel === "overdue") ? (
                                <AlertTriangle className="h-5 w-5 animate-bounce shrink-0 text-destructive" />
                            ) : (
                                <Clock className="h-5 w-5 shrink-0 text-current" />
                            )}
                            <div className="text-sm font-medium">
                                {urgencyLevel === "low" && (
                                    <span>Upcoming Shift Reconciliation: Please reconcile and close the shift before 12:00 AM (Midnight).</span>
                                )}
                                {urgencyLevel === "medium" && (
                                    <span>
                                        Reconciliation due in <span className="font-bold">{remainingHours}h {remainingMinutes}m</span> (Deadline: 12:00 AM).
                                    </span>
                                )}
                                {urgencyLevel === "high" && (
                                    <span className="font-bold">
                                        URGENT: Reconcile shift before midnight! Countdown: {remainingMinutes.toString().padStart(2, "0")}:{remainingSeconds.toString().padStart(2, "0")} remaining.
                                    </span>
                                )}
                                {urgencyLevel === "overdue" && (
                                    <span>
                                        SHIFT RECONCILIATION OVERDUE: The 12:00 AM deadline has passed. Please reconcile and close this shift as soon as possible.
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <Button
                                size="sm"
                                variant={(urgencyLevel === "high" || urgencyLevel === "overdue") ? "destructive" : "outline"}
                                className={cn(
                                    "rounded-full text-xs font-bold px-4 h-8 transition-all shadow-xs",
                                    urgencyLevel === "low" && "border-blue-500/30 hover:bg-blue-500/10 text-blue-700 dark:text-blue-400",
                                    urgencyLevel === "medium" && "border-amber-500/30 hover:bg-amber-500/10 text-amber-700 dark:text-amber-400"
                                )}
                                onClick={() => router.push("/pos/shifts")}
                            >
                                Reconcile & Close Shift
                            </Button>
                            {urgencyLevel !== "high" && urgencyLevel !== "overdue" && (
                                <button
                                    onClick={() => {
                                        setIsDismissed(true);
                                        // Dismiss for 1 hour for low urgency, 15 mins for medium urgency
                                        const delay = urgencyLevel === "low" ? 60 * 60 * 1000 : 15 * 60 * 1000;
                                        setDismissedUntil(Date.now() + delay);
                                    }}
                                    className="p-1.5 hover:bg-black/5 rounded-full transition-colors"
                                    title="Dismiss reminder"
                                >
                                    <X className="h-4 w-4 text-current" />
                                </button>
                            )}
                        </div>
                    </div>
                )}
                <div className="flex-1 w-full h-full">
                    {children}
                </div>
            </div>
        );
    }

    // 5. Enforce blocking overlay for all standard cashiers when shift is closed/not started
    return (
        <div className="relative w-full h-full min-h-[calc(100vh-4rem)]">
            {/* Display page blurred and non-interactive underneath for premium aesthetic */}
            <div className="absolute inset-0 pointer-events-none blur-[6px] opacity-40 select-none overflow-hidden">
                {children}
            </div>

            {/* The rigid, locked overlay card */}
            <div className="fixed inset-0 z-[90] flex items-center justify-center bg-background/70 backdrop-blur-md p-4">
                <Card className="w-full max-w-md shadow-2xl border-primary/20 border-2 rounded-[32px] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    <CardHeader className="text-center pb-4 space-y-3 pt-8">
                        <div className="bg-primary/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto border border-primary/20 shadow-inner">
                            <Lock className="h-8 w-8 text-primary animate-bounce" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-black tracking-tight text-foreground">
                                Shift Enforcer
                            </CardTitle>
                            <CardDescription className="text-sm font-medium mt-1">
                                Starting float registration is required to start accepting cash sales and performing transactions.
                            </CardDescription>
                        </div>
                    </CardHeader>

                    <CardContent className="space-y-4 px-6 pb-8">
                        {!isParentTerminal ? (
                            <div className="space-y-4 text-center py-2">
                                <p className="text-sm text-muted-foreground font-medium">
                                    Shifts can only be opened and managed from the Parent Terminal. Please ask your manager to open the shift.
                                </p>
                                <Button
                                    type="button"
                                    onClick={() => {
                                        setLoading(true);
                                        fetchSession();
                                    }}
                                    className="w-full h-12 rounded-full font-bold text-base bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shadow-lg shadow-primary/20"
                                >
                                    <Clock className="w-5 h-5 shrink-0" />
                                    Check Shift Status
                                </Button>
                            </div>
                        ) : (
                            <form onSubmit={handleOpenShift} className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="float-amount" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                        Starting Float (PKR)
                                    </Label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-muted-foreground text-sm">Rs.</span>
                                        <Input
                                            id="float-amount"
                                            type="number"
                                            min="0"
                                            required
                                            value={floatAmount}
                                            onChange={(e) => setFloatAmount(e.target.value ? Number(e.target.value) : "")}
                                            className="pl-12 h-12 rounded-2xl text-lg font-bold bg-muted/40 border-transparent focus-visible:ring-primary focus-visible:bg-background"
                                            placeholder="0"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="float-note" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                        Opening Note (Optional)
                                    </Label>
                                    <Textarea
                                        id="float-note"
                                        value={floatNote}
                                        onChange={(e) => setFloatNote(e.target.value)}
                                        className="rounded-2xl bg-muted/40 border-transparent focus-visible:ring-primary focus-visible:bg-background resize-none"
                                        placeholder="E.g. Morning Shift Cashier A"
                                        rows={2}
                                    />
                                </div>

                                <Button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full h-12 rounded-full font-bold text-base bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 shadow-lg shadow-primary/20"
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            Registering Float...
                                        </>
                                    ) : (
                                        <>
                                            Open Shift & Unlock POS
                                            <ArrowRight className="w-4 h-4" />
                                        </>
                                    )}
                                </Button>
                            </form>
                        )}

                        <div className="h-px bg-border w-full my-4" />

                        <div className="flex flex-col gap-2">
                            <p className="text-xs text-center text-muted-foreground">
                                Need to view historical reports or review settings?
                            </p>
                            <Button
                                variant="outline"
                                className="w-full h-11 rounded-full text-xs font-bold border-dashed hover:bg-muted"
                                onClick={() => router.push("/pos/shifts")}
                            >
                                Go to Shift & History Board
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
