"use client";

/**
 * Desktop Login Page — Electron app entry point.
 *
 * Phase 1 — Silent re-auth / Credential login + device registration
 * Phase 2 — POS setup: Location → Terminal → PIN  (same flow as /auth/pos-login)
 *
 * The app always lands here. On success it navigates to /pos/new-sale.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card, CardContent, CardFooter, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, AlertCircle, Eye, EyeOff, Monitor, ShieldCheck,
  Wifi, WifiOff, Building2, ArrowLeft, Store, CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buildSubdomainUrl } from "@/lib/navigation";
import { posLoginClient, getGlobalPosContext, adminFetchLocationsClient } from "@/lib/client-auth";
import { setPosTerminalAction } from "@/lib/actions/pos";
import { toast } from "sonner";
import Image from "next/image";

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "checking" | "login" | "registering" | "pos-setup" | "success";
type PosStep = "location-list" | "location-code" | "terminal-select" | "pin";

interface Terminal { id: string; name: string; code: string; status: string; }
interface LocationContext {
  location: { id: string; name: string; code: string; };
  terminals: Terminal[];
  tenantContext?: { tenantId: string; companyCode: string; };
}

// ─── Bridge helper ────────────────────────────────────────────────────────────

function getBridge(): any | null {
  if (typeof window !== "undefined" && (window as any).posDesktop) {
    return (window as any).posDesktop;
  }
  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DesktopLoginPage() {
  // ── Phase / step state ──
  const [phase, setPhase] = useState<Phase>("checking");
  const [posStep, setPosStep] = useState<PosStep>("location-code");

  // ── Credential login state ──
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [appVersion, setAppVersion] = useState("");
  const [loginPending, setLoginPending] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // ── POS setup state ──
  const [isPending, startTransition] = useTransition();
  const [posError, setPosError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const [context, setContext] = useState<LocationContext | null>(null);
  const [locationCode, setLocationCode] = useState("");
  const [adminLocations, setAdminLocations] = useState<any[]>([]);
  const [selectedTerminal, setSelectedTerminal] = useState<Terminal | null>(null);
  const [pin, setPin] = useState("");
  const [rememberTerminal, setRememberTerminal] = useState(true);

  // ── Phase 1: silent re-auth on mount ──────────────────────────────────────
  useEffect(() => {
    const bridge = getBridge();

    async function trySilentAuth() {
      if (!bridge) {
        // Not in Electron — redirect to normal login
        window.location.href = "/auth/login";
        return;
      }

      try {
        const [version, connectivity] = await Promise.all([
          bridge.getAppVersion(),
          bridge.checkConnectivity(),
        ]);
        setAppVersion(version);
        setIsOnline(connectivity.online);

        const result = await bridge.validateDesktopSession();

        if (result.status && result.data?.accessToken) {
          // Valid session — skip credential login, go straight to POS setup
          await initPosSetup();
          return;
        }

        if (result.offline && result.data?.accessToken) {
          // Offline with cached token — go to POS setup
          await initPosSetup();
          return;
        }

        // No valid session — show login form
        setPhase("login");
      } catch {
        setPhase("login");
      }
    }

    trySilentAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── PIN keyboard listener ─────────────────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (phase !== "pos-setup" || posStep !== "pin") return;
      if (/^[0-9]$/.test(e.key)) setPin((p) => p.length < 4 ? p + e.key : p);
      if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
    };
    window.addEventListener("keyup", handleKey);
    return () => window.removeEventListener("keyup", handleKey);
  }, [phase, posStep]);

  // ── Auto-submit PIN at 4 digits ───────────────────────────────────────────
  useEffect(() => {
    if (pin.length === 4) handlePinSubmit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  // ── POS setup initializer ─────────────────────────────────────────────────
  async function initPosSetup() {
    setPhase("pos-setup");
    try {
      const res = await adminFetchLocationsClient();
      if (res.status && Array.isArray(res.data?.data) && res.data.data.length > 0) {
        setAdminLocations(res.data.data);
        setPosStep("location-list");
        return;
      }
    } catch { /* fall through to manual code */ }
    setPosStep("location-code");
  }

  // ── Phase 1: credential login ─────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoginError(null);
    setLoginPending(true);
    const bridge = getBridge();

    try {
      // Always proxy auth through the local service (server-to-server → no CORS).
      // The local service /api/auth/* forwards to the live backend transparently.
      const config = bridge ? await bridge.getConfig() : null;
      const localServiceUrl = `http://127.0.0.1:${config?.localServicePort ?? 3099}/api`;

      const res = await fetch(`${localServiceUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });
      const data = await res.json();

      if (!data.status) {
        setLoginError(data.message || "Invalid credentials");
        setLoginPending(false);
        return;
      }

      const accessToken: string = data.data?.accessToken ?? '';
      const refreshToken: string = data.data?.refreshToken ?? '';

      if (bridge) {
        await bridge.saveTokens({ accessToken, refreshToken });
      }

      // Register device (non-fatal)
      setPhase("registering");
      if (bridge) {
        const reg = await bridge.registerDevice(accessToken);
        if (!reg.status) console.warn("[DesktopLogin] Device registration:", reg.message);
      }

      // Move to POS setup
      await initPosSetup();
    } catch {
      setLoginError("Could not connect to the server. Check your internet connection.");
      setPhase("login");
      setLoginPending(false);
    }
  };

  // ── POS handlers ─────────────────────────────────────────────────────────
  const handleLocationCodeSubmit = () => {
    if (!locationCode) return;
    setPosError(null);
    startTransition(async () => {
      const result = await getGlobalPosContext(locationCode);
      if (result.status && result.data) {
        setContext(result.data);
        setPosStep("terminal-select");
      } else {
        setPosError(result.message || "Invalid Location Code");
      }
    });
  };

  const handleAdminSelectLocation = (loc: any) => {
    setContext({ location: { id: loc.id, name: loc.name, code: loc.code }, terminals: loc.pos || [] });
    setPosStep("terminal-select");
    setPosError(null);
  };

  const handleTerminalSelect = (terminal: Terminal) => {
    setSelectedTerminal(terminal);
    setPosStep("pin");
    setPosError(null);
    setPin("");
  };

  const handlePinSubmit = () => {
    if (!selectedTerminal || pin.length < 4) return;
    if (submittingRef.current) return;
    submittingRef.current = true;
    setPin("");

    startTransition(async () => {
      try {
        const result = await posLoginClient(
          selectedTerminal.code,
          pin,
          context?.tenantContext?.tenantId,
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
          toast.success("POS Authenticated!");
          setPhase("success");
          setTimeout(async () => {
            const b = getBridge();
            const posUrl = buildSubdomainUrl("pos", "/pos/new-sale");
            if (b) {
              await b.navigate(posUrl);
            } else {
              window.location.href = posUrl;
            }
          }, 1200);
        } else {
          setPosError(result.message || "Terminal login failed");
        }
      } catch {
        setPosError("An error occurred during terminal login");
      } finally {
        submittingRef.current = false;
      }
    });
  };

  const handlePosBack = () => {
    setPosError(null);
    if (posStep === "pin") { setPosStep("terminal-select"); setPin(""); }
    else if (posStep === "terminal-select") {
      setContext(null);
      setPosStep(adminLocations.length > 0 ? "location-list" : "location-code");
    }
  };

  // ── Render helpers ────────────────────────────────────────────────────────

  const renderChecking = () => (
    <div className="flex flex-col items-center justify-center py-14 gap-5 animate-in fade-in duration-500">
      <div className="relative">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Monitor className="h-8 w-8 text-primary" />
        </div>
        <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-background border-2 border-primary/20 flex items-center justify-center">
          <Loader2 className="h-3 w-3 text-primary animate-spin" />
        </div>
      </div>
      <div className="text-center space-y-1">
        <p className="font-semibold text-foreground">Speed Pvt. Limited POS</p>
        <p className="text-sm text-muted-foreground">Verifying your session...</p>
      </div>
    </div>
  );

  const renderRegistering = () => (
    <div className="flex flex-col items-center justify-center py-14 gap-5 animate-in fade-in duration-300">
      <div className="h-16 w-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
        <ShieldCheck className="h-8 w-8 text-primary animate-pulse" />
      </div>
      <div className="text-center space-y-1">
        <p className="font-semibold">Registering this device</p>
        <p className="text-sm text-muted-foreground">Securing your session with the cloud...</p>
      </div>
      <Loader2 className="h-5 w-5 text-primary animate-spin" />
    </div>
  );

  const renderSuccess = () => (
    <div className="flex flex-col items-center justify-center py-14 gap-5 animate-in zoom-in-95 fade-in duration-500">
      <div className="h-20 w-20 rounded-full bg-green-500/10 border-2 border-green-500/30 flex items-center justify-center">
        <ShieldCheck className="h-10 w-10 text-green-500" />
      </div>
      <div className="text-center space-y-2">
        <p className="text-xl font-bold">You&apos;re all set!</p>
        <p className="text-sm text-muted-foreground">Opening POS...</p>
      </div>
      <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
    </div>
  );

  const renderLogin = () => (
    <form onSubmit={handleLogin} className="space-y-4 animate-in fade-in duration-300">
      {/* Connectivity badge */}
      <div className="flex items-center justify-center gap-1.5 pb-1">
        {isOnline ? (
          <><Wifi className="h-3 w-3 text-green-500" /><span className="text-[11px] text-green-600 font-semibold">Connected to cloud</span></>
        ) : (
          <><WifiOff className="h-3 w-3 text-amber-500" /><span className="text-[11px] text-amber-600 font-semibold">Offline — login required when connected</span></>
        )}
      </div>

      {loginError && (
        <Alert variant="destructive" className="animate-in slide-in-from-top-2 border-destructive/50 bg-destructive/10">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="font-medium">{loginError}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label htmlFor="email" className="text-sm font-semibold">Email Address</Label>
        <Input
          id="email" type="email" placeholder="name@company.com" required autoFocus
          disabled={loginPending} value={email} onChange={(e) => setEmail(e.target.value)}
          className="h-11 border-primary/10 focus-visible:ring-primary/20"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-sm font-semibold">Password</Label>
        <div className="relative">
          <Input
            id="password" type={showPassword ? "text" : "password"} placeholder="••••••••"
            required disabled={loginPending} value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="pr-10 h-11 border-primary/10 focus-visible:ring-primary/20"
          />
          <Button type="button" variant="ghost" size="icon"
            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent text-muted-foreground hover:text-primary"
            onClick={() => setShowPassword(!showPassword)} disabled={loginPending}>
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-primary/10 bg-primary/5 p-3 space-y-1.5">
        <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" /> What happens next
        </p>
        <ul className="text-[11px] text-muted-foreground space-y-1 ml-5 list-disc">
          <li>Credentials verified with the cloud</li>
          <li>Device gets a secure token in your OS keychain</li>
          <li>Future startups sign you in automatically</li>
        </ul>
      </div>

      <Button type="submit" className="w-full h-11 font-bold tracking-wide"
        disabled={loginPending || !isOnline}>
        {loginPending
          ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</>
          : "Sign in & Register Device"}
      </Button>
    </form>
  );

  // ── POS step renderers (lifted from pos-login) ────────────────────────────

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
        <div className="grid grid-cols-1 gap-2 max-h-[280px] overflow-y-auto pr-1">
          {adminLocations.map((loc) => (
            <Button key={loc.id} variant="outline"
              className="h-14 flex items-center justify-between px-4 hover:border-primary hover:bg-primary/5 transition-all w-full"
              onClick={() => handleAdminSelectLocation(loc)}>
              <span className="font-bold">{loc.name}</span>
              <Badge variant="secondary" className="text-xs">{loc.pos?.length || 0} Terminals</Badge>
            </Button>
          ))}
          {adminLocations.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-lg bg-muted/30">No locations found.</div>
          )}
        </div>
      </div>
      <div className="relative py-2">
        <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">Or</span>
        </div>
      </div>
      <Button variant="ghost" className="w-full text-xs h-9" onClick={() => setPosStep("location-code")}>
        <Store className="h-3 w-3 mr-1.5" /> Enter Location Code Manually
      </Button>
    </div>
  );

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
            placeholder="e.g. NYC-01" value={locationCode}
            onChange={(e) => setLocationCode(e.target.value.toUpperCase())}
            className="pl-9 font-mono uppercase text-lg h-11 border-primary/20 focus-visible:ring-primary/30"
            onKeyDown={(e) => e.key === "Enter" && handleLocationCodeSubmit()}
            autoFocus
          />
        </div>
      </div>
      <Button className="w-full h-11 font-medium" onClick={handleLocationCodeSubmit}
        disabled={isPending || !locationCode}>
        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
        Verify Location
      </Button>
      {adminLocations.length > 0 && (
        <Button variant="ghost" size="sm" className="w-full text-xs text-muted-foreground"
          onClick={() => setPosStep("location-list")}>
          <ArrowLeft className="h-3 w-3 mr-2" /> Back to Location List
        </Button>
      )}
    </div>
  );

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
        <Button variant="ghost" size="sm" onClick={handlePosBack}
          className="h-8 text-xs hover:bg-destructive/10 hover:text-destructive">Change</Button>
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold ml-1">Available Terminals</Label>
        <div className="grid grid-cols-2 gap-3 max-h-[280px] overflow-y-auto pr-1">
          {context?.terminals.map((t) => (
            <Button key={t.id} variant="outline"
              className="h-20 flex flex-col items-center justify-center gap-1.5 hover:border-primary hover:bg-primary/5 hover:scale-[1.02] transition-all border-2"
              onClick={() => handleTerminalSelect(t)}>
              <Monitor className="h-5 w-5 text-muted-foreground" />
              <span className="font-bold text-sm leading-tight">{t.name}</span>
            </Button>
          ))}
          {context?.terminals.length === 0 && (
            <div className="col-span-2 text-center py-8 text-muted-foreground text-sm border-2 border-dashed rounded-lg bg-muted/30">
              No active terminals found.<br />Please contact admin.
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderPin = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="text-center bg-muted/30 p-3 rounded-lg border">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Authorizing Terminal</p>
        <div className="flex items-center justify-center gap-2 mt-1">
          <Monitor className="h-5 w-5 text-primary" />
          <h3 className="text-xl font-bold">{selectedTerminal?.name}</h3>
        </div>
      </div>

      <div className="flex justify-center">
        <div className="flex gap-2.5">
          {[...Array(4)].map((_, i) => (
            <div key={i} className={cn(
              "h-3 w-3 rounded-full transition-all duration-300 transform",
              pin.length > i ? "bg-primary scale-110 shadow-[0_0_10px_var(--color-primary)]" : "bg-muted-foreground/30 scale-90"
            )} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto">
        {[1,2,3,4,5,6,7,8,9].map((n) => (
          <Button key={n} variant="outline"
            className="h-14 text-2xl font-medium border-muted-foreground/20 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all active:scale-95"
            onClick={() => pin.length < 4 && setPin(pin + n)}>{n}</Button>
        ))}
        <Button variant="ghost" className="h-14 text-sm font-medium hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setPin("")}>CLEAR</Button>
        <Button variant="outline"
          className="h-14 text-2xl font-medium border-muted-foreground/20 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all active:scale-95"
          onClick={() => pin.length < 4 && setPin(pin + "0")}>0</Button>
        <Button variant="ghost" className="h-14 hover:bg-muted"
          onClick={() => setPin(pin.slice(0, -1))}><ArrowLeft className="h-6 w-6" /></Button>
      </div>

      <div className="space-y-3">
        {isPending && (
          <div className="flex items-center justify-center gap-2 text-primary animate-in fade-in">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm font-medium">Authenticating...</span>
          </div>
        )}
        {!isPending && pin.length < 4 && (
          <p className="text-center text-xs text-muted-foreground">Enter terminal PIN to complete setup</p>
        )}
        <div className="flex items-center space-x-2 justify-center py-1">
          <Checkbox id="remember" checked={rememberTerminal} onCheckedChange={(c) => setRememberTerminal(!!c)} />
          <Label htmlFor="remember" className="text-xs font-medium cursor-pointer">Remember this terminal</Label>
        </div>
        <Button variant="link" size="sm" className="w-full text-xs text-muted-foreground h-auto p-0"
          onClick={handlePosBack}>Back to terminal list</Button>
      </div>
    </div>
  );

  // ── Step titles ───────────────────────────────────────────────────────────
  const titles: Record<string, string> = {
    checking: "Speed Limit POS",
    login: "Sign in to POS",
    registering: "Registering Device",
    "pos-setup:location-list": "Select Location",
    "pos-setup:location-code": "POS Setup",
    "pos-setup:terminal-select": "Select Terminal",
    "pos-setup:pin": "Unlock Terminal",
    success: "All Set!",
  };
  const titleKey = phase === "pos-setup" ? `pos-setup:${posStep}` : phase;

  // ── Layout ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-linear-to-br from-background to-secondary/20 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-125 h-125 bg-primary/5 rounded-full blur-[100px] opacity-50" />
        <div className="absolute bottom-0 left-0 w-125 h-125 bg-blue-500/5 rounded-full blur-[100px] opacity-30" />
      </div>

      <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-500">
        <Card className="shadow-2xl backdrop-blur-sm bg-card/95">
          <CardHeader className="pb-2 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
              <Monitor className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">{titles[titleKey]}</CardTitle>
          </CardHeader>

          <CardContent className="pt-2 min-h-[320px] flex flex-col justify-center">
            {/* POS error (shown during pos-setup phase) */}
            {phase === "pos-setup" && posError && (
              <Alert variant="destructive" className="mb-4 animate-in slide-in-from-top-2 border-destructive/50 bg-destructive/10">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="font-medium text-sm">{posError}</AlertDescription>
              </Alert>
            )}

            {phase === "checking" && renderChecking()}
            {phase === "login" && renderLogin()}
            {phase === "registering" && renderRegistering()}
            {phase === "success" && renderSuccess()}
            {phase === "pos-setup" && posStep === "location-list" && renderLocationList()}
            {phase === "pos-setup" && posStep === "location-code" && renderLocationCode()}
            {phase === "pos-setup" && posStep === "terminal-select" && renderTerminalSelect()}
            {phase === "pos-setup" && posStep === "pin" && renderPin()}
          </CardContent>

          <CardFooter className="flex flex-col gap-2 pb-6">
            <div className="w-full pt-4 border-t border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 opacity-70">
                  <Image src="/logo.png" alt="INPL" width={14} height={14} className="object-contain" />
                  <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                    Innovative Network Pvt Ltd
                  </span>
                </div>
                {appVersion && (
                  <span className="text-[10px] text-muted-foreground/40 font-mono">v{appVersion}</span>
                )}
              </div>
            </div>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
