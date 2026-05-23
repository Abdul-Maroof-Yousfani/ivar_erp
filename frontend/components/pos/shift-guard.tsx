"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AlertTriangle, Wallet, ArrowRight, Loader2, Lock } from "lucide-react";
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
    const { user, isAdmin } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    const [sessionData, setSessionData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form inputs
    const [floatAmount, setFloatAmount] = useState<number | "">("");
    const [floatNote, setFloatNote] = useState("");

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

    // 4. If the drawer/shift is already open, grant immediate seamless access
    if (hasSession && isDrawerOpen) {
        return <>{children}</>;
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
