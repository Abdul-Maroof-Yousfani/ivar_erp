"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Monitor, AlertCircle, CheckCircle2, Building2, ArrowLeft, Store } from "lucide-react";
import { posLoginClient, getGlobalPosContext, adminFetchLocationsClient } from "@/lib/client-auth";
import Image from "next/image";
import { buildSubdomainUrl } from "@/lib/navigation";
import { toast } from "sonner";
import { setPosTerminalAction } from "@/lib/actions/pos";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/providers/auth-provider";

type LoginStep = 'loading' | 'location-list' | 'location-code' | 'terminal-select' | 'pin';

interface Terminal {
    id: string;
    name: string;
    code: string;
    status: string;
}

interface LocationContext {
    location: {
        id: string;
        name: string;
        code: string;
    };
    terminals: Terminal[];
    tenantContext?: {
        tenantId: string;
        companyCode: string;
    };
}

export default function PosLoginPage() {
    const { user, isAdmin, refreshUser } = useAuth();
    const [step, setStep] = useState<LoginStep>('loading');
    const [isPending, startTransition] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const submittingRef = useRef(false);

    // Context Data
    const [context, setContext] = useState<LocationContext | null>(null);
    const [locationCode, setLocationCode] = useState("");
    const [adminLocations, setAdminLocations] = useState<any[]>([]);

    // Terminal Selection
    const [selectedTerminal, setSelectedTerminal] = useState<Terminal | null>(null);

    // Auth Data
    const [pin, setPin] = useState("");
    const [rememberTerminal, setRememberTerminal] = useState(true);

    // ── Keyboard listener for PIN ──
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (step !== 'pin') return;
            if (/^[0-9]$/.test(e.key)) {
                setPin((prev) => (prev.length < 4 ? prev + e.key : prev));
            }
            if (e.key === "Backspace") {
                setPin((prev) => prev.slice(0, -1));
            }
        };
        window.addEventListener("keyup", handleKey);
        return () => window.removeEventListener("keyup", handleKey);
    }, [step]);

    // ── Auto-submit PIN at 4 digits ──
    useEffect(() => {
        if (pin.length === 4) {
            handlePinSubmit();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pin]);

    // ── Initialization: determine first step based on auth state ──
    useEffect(() => {
        if (!user) {
            // Not authenticated → redirect to login
            window.location.href = buildSubdomainUrl("auth", "/login?callbackUrl=" + encodeURIComponent("/auth/pos-login"));
            return;
        }

        if (user.isPosUser || user.terminalId) {
            // User already has an active POS terminal session → skip login
            window.location.href = buildSubdomainUrl("pos", "/pos");
            return;
        }

        async function init() {
            if (isAdmin()) {
                // Admin → fetch all locations
                try {
                    const res = await adminFetchLocationsClient();
                    if (res.status && Array.isArray(res.data?.data)) {
                        setAdminLocations(res.data.data);
                        setStep('location-list');
                        return;
                    }
                } catch (e) { }
            }
            // Non-admin or fetch failed → manual code entry
            setStep('location-code');
        }
        init();
    }, [user, isAdmin]);

    // ── Handlers ──

    const handleLocationCodeSubmit = () => {
        if (!locationCode) return;
        setError(null);
        startTransition(async () => {
            const result = await getGlobalPosContext(locationCode);
            if (result.status && result.data) {
                setContext(result.data);
                setStep('terminal-select');
            } else {
                setError(result.message || "Invalid Location Code");
            }
        });
    };

    const handleAdminSelectLocation = (loc: any) => {
        setContext({
            location: { id: loc.id, name: loc.name, code: loc.code },
            terminals: loc.pos || []
        });
        setStep('terminal-select');
        setError(null);
    };

    const handleTerminalSelect = (terminal: Terminal) => {
        setSelectedTerminal(terminal);
        setStep('pin');
        setError(null);
        setPin("");
    };

    const handlePinSubmit = () => {
        if (!selectedTerminal || !pin || pin.length < 4) return;
        if (submittingRef.current) return;
        submittingRef.current = true;
        setPin("");

        startTransition(async () => {
            try {
                const result = await posLoginClient(
                    selectedTerminal.code,
                    pin,
                    context?.tenantContext?.tenantId
                );
                if (result.status && result.data) {
                    if (rememberTerminal) {
                        await setPosTerminalAction({
                            code: selectedTerminal.code,
                            name: selectedTerminal.name,
                            locationName: context?.location.name,
                            locationCode: context?.location.code,
                        });
                    }
                    toast.success("POS Authenticated Successfully!");
                    await refreshUser();
                    const params = new URLSearchParams(window.location.search);
                    const callbackUrl = params.get("callbackUrl");
                    window.location.href = buildSubdomainUrl("pos", callbackUrl || "/pos/new-sale");
                } else {
                    setError(result.message || "Terminal Login Failed");
                }
            } catch {
                setError("An error occurred during terminal login");
            } finally {
                submittingRef.current = false;
            }
        });
    };

    const handleBack = () => {
        setError(null);
        if (step === 'pin') {
            setStep('terminal-select');
            setPin("");
        } else if (step === 'terminal-select') {
            setContext(null);
            if (adminLocations.length > 0) {
                setStep('location-list');
            } else {
                setStep('location-code');
            }
        }
    };

    // ── Render: Loading ──
    const renderLoading = () => (
        <div className="flex flex-col items-center justify-center py-12 space-y-4 animate-in fade-in duration-500">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-muted-foreground font-medium">Initializing...</p>
        </div>
    );

    // ── Render: Admin Location List ──
    const renderLocationList = () => (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center space-y-2 mb-4">
                <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto text-primary mb-2 shadow-sm border border-primary/20">
                    <Building2 className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold">Select Location</h3>
                <p className="text-sm text-muted-foreground">Choose a location to set up the POS terminal.</p>
            </div>

            <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold ml-1">Company Locations</Label>
                <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-1">
                    {adminLocations.map((loc) => (
                        <Button
                            key={loc.id}
                            variant="outline"
                            className="h-14 flex items-center justify-between px-4 hover:border-primary hover:bg-primary/5 transition-all w-full"
                            onClick={() => handleAdminSelectLocation(loc)}
                        >
                            <span className="font-bold">{loc.name}</span>
                            <Badge variant="secondary" className="text-xs">{loc.pos?.length || 0} Terminals</Badge>
                        </Button>
                    ))}
                    {adminLocations.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-lg bg-muted/30">
                            No locations found.
                        </div>
                    )}
                </div>
            </div>

            {/* Fallback: manual code entry */}
            <div className="relative py-2">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
            </div>
            <Button variant="ghost" className="w-full text-xs h-9" onClick={() => setStep('location-code')}>
                <Store className="h-3 w-3 mr-1.5" /> Enter Location Code Manually
            </Button>
        </div>
    );

    // ── Render: Location Code Input ──
    const renderLocationCode = () => (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center space-y-2 mb-6">
                <div className="bg-primary/10 w-12 h-12 rounded-full flex items-center justify-center mx-auto text-primary mb-4 shadow-sm border border-primary/20">
                    <Store className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold">Enter Location Code</h3>
                <p className="text-sm text-muted-foreground">Enter the code assigned to your store location.</p>
            </div>

            <div className="space-y-2">
                <Label>Location Code</Label>
                <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="e.g. NYC-01"
                        value={locationCode}
                        onChange={(e) => setLocationCode(e.target.value.toUpperCase())}
                        className="pl-9 font-mono uppercase text-lg h-11 border-primary/20 focus-visible:ring-primary/30 transition-all"
                        onKeyDown={(e) => e.key === 'Enter' && handleLocationCodeSubmit()}
                        autoFocus
                    />
                </div>
            </div>

            <Button className="w-full h-11 font-medium" onClick={handleLocationCodeSubmit} disabled={isPending || !locationCode}>
                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                Verify Location
            </Button>

            {adminLocations.length > 0 && (
                <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground" onClick={() => setStep('location-list')}>
                    <ArrowLeft className="h-3 w-3 mr-2" /> Back to Location List
                </Button>
            )}
        </div>
    );

    // ── Render: Terminal Select ──
    const renderTerminalSelect = () => (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex items-center justify-between border-b pb-4 mb-2">
                <div className="flex items-center gap-3">
                    <div className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 p-2.5 rounded-xl border border-green-200 dark:border-green-800">
                        <Store className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Current Location</p>
                        <h3 className="font-bold leading-tight text-lg">{context?.location.name}</h3>
                    </div>
                </div>
                <Button variant="ghost" size="sm" onClick={handleBack} className="h-8 text-xs hover:bg-destructive/10 hover:text-destructive">
                    Change
                </Button>
            </div>

            <div className="space-y-2">
                <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold ml-1">Available Terminals</Label>
                <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1">
                    {context?.terminals.map((terminal) => (
                        <Button
                            key={terminal.id}
                            variant="outline"
                            className="h-20 flex flex-col items-center justify-center gap-1.5 hover:border-primary hover:bg-primary/5 hover:scale-[1.02] transition-all text-wrap border-2"
                            onClick={() => handleTerminalSelect(terminal)}
                        >
                            <Monitor className="h-5 w-5 text-muted-foreground" />
                            <span className="font-bold text-sm leading-tight">{terminal.name}</span>
                        </Button>
                    ))}
                </div>
                {context?.terminals.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-lg bg-muted/30">
                        No active terminals found.<br />Please contact admin.
                    </div>
                )}
            </div>
        </div>
    );

    // ── Render: PIN Entry ──
    const renderPinEntry = () => (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="text-center space-y-1 mb-2 bg-muted/30 p-3 rounded-lg border">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Authorizing Terminal</p>
                <div className="flex items-center justify-center gap-2">
                    <Monitor className="h-5 w-5 text-primary" />
                    <h3 className="text-xl font-bold">{selectedTerminal?.name}</h3>
                </div>
            </div>

            <div className="flex justify-center mb-6">
                <div className="flex gap-2.5">
                    {[...Array(4)].map((_, i) => (
                        <div
                            key={i}
                            className={cn(
                                "h-3 w-3 rounded-full transition-all duration-300 transform",
                                pin.length > i ? "bg-primary scale-110 shadow-[0_0_10px_var(--color-primary)]" : "bg-muted-foreground/30 scale-90"
                            )}
                        />
                    ))}
                </div>
            </div>

            {/* Numeric Keypad */}
            <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <Button
                        key={num}
                        variant="outline"
                        className="h-14 text-2xl font-medium border-muted-foreground/20 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all active:scale-95"
                        onClick={() => pin.length < 4 && setPin(pin + num)}
                    >
                        {num}
                    </Button>
                ))}
                <Button
                    variant="ghost"
                    className="h-14 text-sm font-medium hover:bg-destructive/10 hover:text-destructive transition-colors"
                    onClick={() => setPin("")}
                >
                    CLEAR
                </Button>
                <Button
                    variant="outline"
                    className="h-14 text-2xl font-medium border-muted-foreground/20 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all active:scale-95"
                    onClick={() => pin.length < 4 && setPin(pin + "0")}
                >
                    0
                </Button>
                <Button
                    variant="ghost"
                    className="h-14 hover:bg-muted transition-colors"
                    onClick={() => setPin(pin.slice(0, -1))}
                >
                    <ArrowLeft className="h-6 w-6" />
                </Button>
            </div>

            <div className="space-y-4 mt-2">
                {isPending && (
                    <div className="flex items-center justify-center gap-2 text-primary animate-in fade-in duration-200">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="text-sm font-medium">Authenticating...</span>
                    </div>
                )}

                {!isPending && pin.length < 4 && (
                    <p className="text-center text-xs text-muted-foreground">
                        Enter terminal PIN to complete setup
                    </p>
                )}

                <div className="flex items-center space-x-2 justify-center py-2">
                    <Checkbox id="remember" checked={rememberTerminal} onCheckedChange={(c) => setRememberTerminal(!!c)} />
                    <Label htmlFor="remember" className="text-xs font-medium leading-none cursor-pointer">
                        Remember this terminal
                    </Label>
                </div>

                <Button variant="link" size="sm" className="w-full text-xs text-muted-foreground h-auto p-0" onClick={handleBack}>
                    Back to terminal list
                </Button>
            </div>
        </div>
    );

    // ── Card title per step ──
    const stepTitles: Record<LoginStep, string> = {
        'loading': 'POS Setup',
        'location-list': 'Select Location',
        'location-code': 'POS Setup',
        'terminal-select': 'Select Terminal',
        'pin': 'Unlock Terminal',
    };

    return (
        <Card className="shadow-2xl backdrop-blur-sm bg-card/95">
            <CardHeader className="pb-2">
                <CardTitle className="text-2xl text-center font-bold tracking-tight">{stepTitles[step]}</CardTitle>
            </CardHeader>
            <CardContent className="pt-2 min-h-[300px] flex flex-col justify-center">
                {error && (
                    <Alert variant="destructive" className="mb-6 animate-in slide-in-from-top-2 shadow-sm border-destructive/50 bg-destructive/10 text-destructive-foreground">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="font-medium text-sm">{error}</AlertDescription>
                    </Alert>
                )}

                {step === 'loading' && renderLoading()}
                {step === 'location-list' && renderLocationList()}
                {step === 'location-code' && renderLocationCode()}
                {step === 'terminal-select' && renderTerminalSelect()}
                {step === 'pin' && renderPinEntry()}
            </CardContent>
            <CardFooter className="flex flex-col gap-4 pb-6">
                {/* <div className="flex items-center gap-2 text-[10px] text-muted-foreground uppercase tracking-widest font-bold opacity-60">
                    <Monitor className="h-3 w-3" />
                    <span>Secure POS System &bull; v2.5</span>
                </div> */}

                <div className="w-full pt-4 mt-2 border-t border-border/50">
                    <div className="flex items-center justify-center gap-2">
                        <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60">
                            Powered by
                        </p>
                        <div className="flex items-center gap-1.5 opacity-80">
                            <Image
                                src="/logo.png"
                                alt="Innovative Network Logo"
                                width={18}
                                height={18}
                                className="object-contain"
                            />
                            <span className="text-xs font-bold bg-linear-to-r from-primary to-primary/80 bg-clip-text text-transparent">
                                Innovative Network Pvt Ltd
                            </span>
                        </div>
                    </div>
                </div>
            </CardFooter>
        </Card>
    );
}
