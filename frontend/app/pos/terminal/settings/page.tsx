"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    ArrowLeft, Receipt, Monitor, ShoppingCart, Info,
    Save, RotateCcw, Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { authFetch } from "@/lib/auth";
import { PermissionGuard } from "@/components/auth/permission-guard";

// ─── Types ────────────────────────────────────────────────────────────────────
interface PosSettings {
    // Receipt
    receiptStoreName: string;
    receiptFooter: string;
    receiptShowTax: boolean;
    receiptAutoPrint: boolean;
    receiptShowCashier: boolean;
    // Sale defaults
    defaultPaymentMethod: string;
    requireCustomer: boolean;
    defaultTaxPercent: string;
    // Display
    theme: string;
}

const DEFAULTS: PosSettings = {
    receiptStoreName: "",
    receiptFooter: "Thank you for your purchase!",
    receiptShowTax: true,
    receiptAutoPrint: false,
    receiptShowCashier: true,
    defaultPaymentMethod: "cash",
    requireCustomer: false,
    defaultTaxPercent: "0",
    theme: "system",
};

const PREF_KEY = "pos.terminal.settings";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getCookie(name: string): string {
    if (typeof document === "undefined") return "";
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(";").shift() || "";
    return "";
}

function getTerminalContext() {
    const token = getCookie("posTerminalToken");
    if (!token) return null;
    try {
        const parts = token.split(".");
        if (parts.length !== 3) return null;
        const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const padded = payload + "=".repeat((4 - payload.length % 4) % 4);
        return JSON.parse(atob(padded));
    } catch {
        return null;
    }
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ icon: Icon, title, children }: {
    icon: any; title: string; children: React.ReactNode;
}) {
    return (
        <div className="bg-card rounded-[32px] p-8 shadow-sm border border-border">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2 mb-6">
                <Icon className="w-4 h-4" /> {title}
            </h2>
            <div className="space-y-5">{children}</div>
        </div>
    );
}

// ─── Toggle row ───────────────────────────────────────────────────────────────
function ToggleRow({ label, description, checked, onChange }: {
    label: string; description?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
    return (
        <div className="flex items-center justify-between gap-4">
            <div>
                <p className="text-sm font-medium">{label}</p>
                {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
            </div>
            <Switch checked={checked} onCheckedChange={onChange} />
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TerminalSettingsPage() {
    const router = useRouter();
    const [settings, setSettings] = useState<PosSettings>(DEFAULTS);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [terminalCtx, setTerminalCtx] = useState<any>(null);

    // Load saved settings
    const loadSettings = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await authFetch(`/user-preferences/${PREF_KEY}`);
            if (res.ok && res.data?.value) {
                setSettings({ ...DEFAULTS, ...res.data.value });
            }
        } catch {
            // No saved settings yet — use defaults
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        setTerminalCtx(getTerminalContext());
        loadSettings();
    }, [loadSettings]);

    const set = <K extends keyof PosSettings>(key: K, value: PosSettings[K]) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const res = await authFetch("/user-preferences", {
                method: "POST",
                body: { key: PREF_KEY, value: settings },
            });
            if (res.ok) {
                toast.success("Settings saved");
            } else {
                toast.error(res.data?.message || "Failed to save settings");
            }
        } catch {
            toast.error("Failed to save settings");
        } finally {
            setIsSaving(false);
        }
    };

    const handleReset = () => {
        setSettings(DEFAULTS);
        toast.info("Settings reset to defaults — save to apply");
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <p className="text-muted-foreground text-sm">Loading settings...</p>
            </div>
        );
    }

    return (
        <PermissionGuard permissions="pos.terminal.settings">
        <div className="min-h-screen font-inter">
            {/* HEADER */}
            <div className="max-w-3xl mx-auto pt-6 px-4 mb-6">
                <div className="bg-card text-card-foreground rounded-[32px] p-4 flex items-center justify-between shadow-sm border border-border">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => router.push("/pos/new-sale")}
                            className="text-muted-foreground hover:bg-accent rounded-full">
                            <ArrowLeft className="w-5 h-5" />
                        </Button>
                        <div>
                            <h1 className="text-xl font-bold tracking-tight">Terminal Settings</h1>
                            <p className="text-sm text-muted-foreground">Configure this POS terminal's behaviour</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={handleReset}
                            className="rounded-full text-muted-foreground gap-1.5">
                            <RotateCcw className="w-3.5 h-3.5" /> Reset
                        </Button>
                        <Button onClick={handleSave} disabled={isSaving}
                            className="rounded-full px-6 gap-1.5">
                            <Save className="w-4 h-4" />
                            {isSaving ? "Saving..." : "Save"}
                        </Button>
                    </div>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-4 space-y-5 pb-12">

                {/* ── RECEIPT SETTINGS ── */}
                <Section icon={Receipt} title="Receipt">
                    <div className="space-y-2">
                        <Label>Store Name on Receipt</Label>
                        <Input
                            value={settings.receiptStoreName}
                            onChange={e => set("receiptStoreName", e.target.value)}
                            placeholder={getCookie("companyName") || "Uses company name by default"}
                            className="rounded-xl bg-muted/30 border-transparent focus-visible:ring-primary"
                        />
                        <p className="text-xs text-muted-foreground">Leave blank to use the company name</p>
                    </div>

                    <div className="space-y-2">
                        <Label>Receipt Footer Message</Label>
                        <Input
                            value={settings.receiptFooter}
                            onChange={e => set("receiptFooter", e.target.value)}
                            placeholder="Thank you for your purchase!"
                            className="rounded-xl bg-muted/30 border-transparent focus-visible:ring-primary"
                        />
                    </div>

                    <Separator />

                    <ToggleRow
                        label="Show Tax Line"
                        description="Display tax breakdown on printed receipts"
                        checked={settings.receiptShowTax}
                        onChange={v => set("receiptShowTax", v)}
                    />
                    <ToggleRow
                        label="Show Cashier Name"
                        description="Print the cashier's name on the receipt"
                        checked={settings.receiptShowCashier}
                        onChange={v => set("receiptShowCashier", v)}
                    />
                    <ToggleRow
                        label="Auto-Print After Sale"
                        description="Automatically open print dialog when a sale completes"
                        checked={settings.receiptAutoPrint}
                        onChange={v => set("receiptAutoPrint", v)}
                    />
                </Section>

                {/* ── SALE DEFAULTS ── */}
                <Section icon={ShoppingCart} title="Sale Defaults">
                    <div className="space-y-2">
                        <Label>Default Payment Method</Label>
                        <Select value={settings.defaultPaymentMethod}
                            onValueChange={v => set("defaultPaymentMethod", v)}>
                            <SelectTrigger className="rounded-xl bg-muted/30 border-transparent focus:ring-primary">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="cash">Cash</SelectItem>
                                <SelectItem value="card">Card</SelectItem>
                                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                                <SelectItem value="credit_account">Credit Account</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Default Tax %</Label>
                        <Input
                            type="number"
                            min="0"
                            max="100"
                            value={settings.defaultTaxPercent}
                            onChange={e => set("defaultTaxPercent", e.target.value)}
                            className="rounded-xl bg-muted/30 border-transparent focus-visible:ring-primary"
                            placeholder="0"
                        />
                        <p className="text-xs text-muted-foreground">Applied to new items added to cart (0 = no tax)</p>
                    </div>

                    <Separator />

                    <ToggleRow
                        label="Require Customer on Sale"
                        description="Block checkout unless a customer is selected"
                        checked={settings.requireCustomer}
                        onChange={v => set("requireCustomer", v)}
                    />
                </Section>

                {/* ── DISPLAY ── */}
                <Section icon={Monitor} title="Display">
                    <div className="space-y-2">
                        <Label>Theme</Label>
                        <Select value={settings.theme} onValueChange={v => set("theme", v)}>
                            <SelectTrigger className="rounded-xl bg-muted/30 border-transparent focus:ring-primary">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="system">System Default</SelectItem>
                                <SelectItem value="light">Light</SelectItem>
                                <SelectItem value="dark">Dark</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </Section>

                {/* ── TERMINAL INFO ── */}
                <Section icon={Terminal} title="Terminal Info">
                    {!terminalCtx ? (
                        <p className="text-sm text-muted-foreground">No terminal session active.</p>
                    ) : (
                        <div className="space-y-3 text-sm">
                            {[
                                { label: "Terminal ID", value: terminalCtx.terminalId },
                                { label: "POS Code", value: terminalCtx.posId },
                                { label: "Location ID", value: terminalCtx.locationId },
                            ].map(({ label, value }) => (
                                <div key={label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                                    <span className="text-muted-foreground">{label}</span>
                                    <span className="font-mono text-xs bg-muted px-2 py-1 rounded-lg">
                                        {value || "—"}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="pt-2">
                        <Button variant="outline" size="sm" onClick={() => router.push("/pos/login")}
                            className="rounded-full text-muted-foreground text-xs">
                            <Info className="w-3.5 h-3.5 mr-1.5" />
                            Re-authenticate Terminal
                        </Button>
                    </div>
                </Section>

            </div>
        </div>
        </PermissionGuard>
    );
}
