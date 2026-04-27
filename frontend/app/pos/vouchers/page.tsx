"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
    DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel,
    AlertDialogContent, AlertDialogDescription,
    AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
    Gift, RefreshCw, CreditCard, Building2, MapPin,
    Plus, Copy, XCircle, CheckCircle2, Ticket, Layers,
    Download, ChevronDown,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";
import { authFetch } from "@/lib/auth";
import { useAuth } from "@/components/providers/auth-provider";
import type { Voucher, VoucherType } from "@/lib/actions/vouchers";

// ── Constants ────────────────────────────────────────────────────────────────

const VOUCHER_TYPES: { value: VoucherType; label: string; icon: React.ElementType; color: string }[] = [
    { value: "GIFT",        label: "Gift",        icon: Gift,      color: "text-emerald-600" },
    { value: "EXCHANGE",    label: "Exchange",    icon: RefreshCw, color: "text-blue-600"    },
    { value: "CREDIT",      label: "Credit",      icon: CreditCard,color: "text-violet-600"  },
    { value: "CORPORATE",   label: "Corporate",   icon: Building2, color: "text-amber-600"   },
    { value: "OUTLET_GIFT", label: "Outlet Gift", icon: MapPin,    color: "text-rose-600"    },
];

// Types available for manual issuance (EXCHANGE is system-only)
const ISSUABLE_TYPES = VOUCHER_TYPES.filter(t => t.value !== "EXCHANGE");

function voucherStatus(v: Voucher) {
    if (!v.isActive)  return { label: "Voided",   cls: "bg-muted text-muted-foreground border-border" };
    if (v.isRedeemed) return { label: "Redeemed", cls: "bg-blue-500/10 text-blue-700 border-blue-300" };
    if (v.expiresAt && new Date(v.expiresAt) < new Date())
        return { label: "Expired", cls: "bg-amber-500/10 text-amber-700 border-amber-300" };
    return { label: "Active", cls: "bg-emerald-500/10 text-emerald-700 border-emerald-300" };
}

function fmtDate(d?: string) {
    if (!d) return "No expiry";
    return new Date(d).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Component ────────────────────────────────────────────────────────────────

export default function PosVouchersPage() {
    const { hasPermission } = useAuth();
    const canCreate = hasPermission("pos.voucher.create");
    const canVoid   = hasPermission("pos.voucher.void");

    const [vouchers,   setVouchers]   = useState<Voucher[]>([]);
    const [isLoading,  setIsLoading]  = useState(true);
    const [activeTab,  setActiveTab]  = useState<string>("ALL");

    // ── Single issue modal ───────────────────────────────────────
    const [showSingle,   setShowSingle]   = useState(false);
    const [singleType,   setSingleType]   = useState<VoucherType>("GIFT");
    const [singleAmount, setSingleAmount] = useState<number | "">("");
    const [singleDesc,   setSingleDesc]   = useState("");
    const [singleCo,     setSingleCo]     = useState("");
    const [singleExp,    setSingleExp]    = useState("");
    const [issuingSingle, setIssuingSingle] = useState(false);
    const [issuedVoucher, setIssuedVoucher] = useState<Voucher | null>(null);

    // ── Bulk issue modal ─────────────────────────────────────────
    const [showBulk,    setShowBulk]    = useState(false);
    const [bulkType,    setBulkType]    = useState<VoucherType>("GIFT");
    const [bulkAmount,  setBulkAmount]  = useState<number | "">("");
    const [bulkQty,     setBulkQty]     = useState<number | "">(10);
    const [bulkDesc,    setBulkDesc]    = useState("");
    const [bulkCo,      setBulkCo]      = useState("");
    const [bulkExp,     setBulkExp]     = useState("");
    const [issuingBulk, setIssuingBulk] = useState(false);
    const [bulkResult,  setBulkResult]  = useState<{ count: number; codes: string[] } | null>(null);

    // ── Void confirm ─────────────────────────────────────────────
    const [voidId, setVoidId] = useState<string | null>(null);

    // ── Data ─────────────────────────────────────────────────────
    const fetchVouchers = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await authFetch("/pos-config/vouchers");
            if (res.ok && res.data?.status) setVouchers(res.data.data || []);
        } catch { toast.error("Failed to load vouchers"); }
        finally { setIsLoading(false); }
    }, []);

    useEffect(() => { fetchVouchers(); }, [fetchVouchers]);

    const filtered = activeTab === "ALL"
        ? vouchers
        : vouchers.filter(v => v.voucherType === activeTab);

    // ── Handlers ─────────────────────────────────────────────────
    const handleSingleIssue = async () => {
        if (!singleAmount || Number(singleAmount) <= 0) { toast.error("Enter a valid amount"); return; }
        setIssuingSingle(true);
        try {
            const res = await authFetch("/pos-config/vouchers", {
                method: "POST",
                body: {
                    voucherType: singleType,
                    faceValue: Number(singleAmount),
                    description: singleDesc || undefined,
                    companyName: singleCo || undefined,
                    expiresAt: singleExp || undefined,
                },
            });
            if (res.ok && res.data?.status) {
                setIssuedVoucher(res.data.data);
                setShowSingle(false);
                setSingleAmount(""); setSingleDesc(""); setSingleCo(""); setSingleExp("");
                fetchVouchers();
            } else {
                toast.error(res.data?.message || "Failed to issue voucher");
            }
        } catch { toast.error("Failed to issue voucher"); }
        finally { setIssuingSingle(false); }
    };

    const handleBulkIssue = async () => {
        if (!bulkAmount || Number(bulkAmount) <= 0) { toast.error("Enter a valid amount"); return; }
        if (!bulkQty   || Number(bulkQty)   <= 0)  { toast.error("Enter a valid quantity"); return; }
        if (Number(bulkQty) > 500) { toast.error("Maximum 500 vouchers per batch"); return; }
        setIssuingBulk(true);
        try {
            const res = await authFetch("/pos-config/vouchers/bulk", {
                method: "POST",
                body: {
                    voucherType: bulkType,
                    faceValue: Number(bulkAmount),
                    quantity: Number(bulkQty),
                    description: bulkDesc || undefined,
                    companyName: bulkCo || undefined,
                    expiresAt: bulkExp || undefined,
                },
            });
            if (res.ok && res.data?.status) {
                setBulkResult(res.data.data);
                setShowBulk(false);
                setBulkAmount(""); setBulkQty(10); setBulkDesc(""); setBulkCo(""); setBulkExp("");
                fetchVouchers();
            } else {
                toast.error(res.data?.message || "Failed to issue vouchers");
            }
        } catch { toast.error("Failed to issue vouchers"); }
        finally { setIssuingBulk(false); }
    };

    const handleVoid = async () => {
        if (!voidId) return;
        try {
            const res = await authFetch(`/pos-config/vouchers/${voidId}/void`, { method: "PUT", body: {} });
            if (res.ok && res.data?.status) {
                toast.success("Voucher voided");
                setVoidId(null);
                fetchVouchers();
            } else {
                toast.error(res.data?.message || "Failed to void");
            }
        } catch { toast.error("Failed to void voucher"); }
    };

    const copyCode = (code: string) => {
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(code).then(() => toast.success(`Copied: ${code}`));
        } else {
            const el = document.createElement("textarea");
            el.value = code;
            el.style.position = "fixed";
            el.style.opacity = "0";
            document.body.appendChild(el);
            el.select();
            document.execCommand("copy");
            document.body.removeChild(el);
            toast.success(`Copied: ${code}`);
        }
    };

    const downloadCodes = (codes: string[]) => {
        const content = codes.join("\n");
        const blob = new Blob([content], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `vouchers-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // ── Render ────────────────────────────────────────────────────
    return (
        <div className="p-6 space-y-5">
            {/* Page header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold">Vouchers</h1>
                    <p className="text-sm text-muted-foreground">Issue and manage vouchers</p>
                </div>
                {canCreate && (
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={fetchVouchers} className="rounded-full">
                            <RefreshCw className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" onClick={() => setShowBulk(true)} className="gap-2">
                            <Layers className="w-4 h-4" /> Bulk Issue
                        </Button>
                        <Button onClick={() => setShowSingle(true)} className="gap-2">
                            <Plus className="w-4 h-4" /> Issue Voucher
                        </Button>
                    </div>
                )}
            </div>

            {/* Tabs + table */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="ALL">All ({vouchers.length})</TabsTrigger>
                    {VOUCHER_TYPES.map(({ value, label }) => (
                        <TabsTrigger key={value} value={value}>
                            {label} ({vouchers.filter(v => v.voucherType === value).length})
                        </TabsTrigger>
                    ))}
                </TabsList>

                <TabsContent value={activeTab} className="mt-3">
                    <div className="bg-card rounded-xl border overflow-hidden">
                        {isLoading ? (
                            <p className="text-center text-muted-foreground py-12 text-sm">Loading...</p>
                        ) : filtered.length === 0 ? (
                            <div className="text-center py-16">
                                <Ticket className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                                <p className="text-muted-foreground text-sm">No vouchers found</p>
                            </div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow className="bg-muted/30">
                                        <TableHead>Code</TableHead>
                                        <TableHead>Type</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead className="text-right">Value</TableHead>
                                        <TableHead>Expires</TableHead>
                                        <TableHead>Issued</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.map((v) => {
                                        const st       = voucherStatus(v);
                                        const typeInfo = VOUCHER_TYPES.find(t => t.value === v.voucherType);
                                        const Icon     = typeInfo?.icon ?? Ticket;
                                        return (
                                            <TableRow key={v.id}>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono font-bold text-primary">{v.code}</span>
                                                        <button onClick={() => copyCode(v.code)}
                                                            className="text-muted-foreground hover:text-foreground transition-colors">
                                                            <Copy className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className={cn("flex items-center gap-1.5 text-xs font-medium", typeInfo?.color)}>
                                                        <Icon className="w-3.5 h-3.5" />
                                                        {typeInfo?.label}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground max-w-40 truncate">
                                                    {v.description || (v as any).companyName || "—"}
                                                </TableCell>
                                                <TableCell className="text-right font-semibold font-mono">
                                                    {formatCurrency(Number(v.faceValue))}
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">{fmtDate(v.expiresAt)}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground">{fmtDate(v.createdAt)}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={cn("text-[10px] px-2 py-0 h-5", st.cls)}>
                                                        {st.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {v.isActive && !v.isRedeemed && canVoid && (
                                                        <Button variant="ghost" size="icon"
                                                            className="h-7 w-7 rounded-full text-muted-foreground hover:text-destructive"
                                                            onClick={() => setVoidId(v.id)}>
                                                            <XCircle className="w-3.5 h-3.5" />
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        )}
                    </div>
                </TabsContent>
            </Tabs>

            {/* ── Single Issue Modal ──────────────────────────────────── */}
            <Dialog open={showSingle} onOpenChange={setShowSingle}>
                <DialogContent className="sm:max-w-110">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Ticket className="w-5 h-5 text-primary" /> Issue Voucher
                        </DialogTitle>
                        <DialogDescription>A unique code will be generated automatically.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Type</Label>
                                <Select value={singleType} onValueChange={v => setSingleType(v as VoucherType)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {ISSUABLE_TYPES.map(({ value, label, icon: Icon }) => (
                                            <SelectItem key={value} value={value}>
                                                <div className="flex items-center gap-2"><Icon className="w-3.5 h-3.5" />{label}</div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Amount (Rs.) <span className="text-destructive">*</span></Label>
                                <Input type="number" min="1" value={singleAmount}
                                    onChange={e => setSingleAmount(e.target.value ? Number(e.target.value) : "")}
                                    placeholder="e.g. 1000" autoFocus />
                            </div>
                        </div>
                        {singleType === "CORPORATE" && (
                            <div className="space-y-2">
                                <Label>Company Name</Label>
                                <Input value={singleCo} onChange={e => setSingleCo(e.target.value)} placeholder="e.g. Acme Corp" />
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label>Description (Optional)</Label>
                            <Input value={singleDesc} onChange={e => setSingleDesc(e.target.value)} placeholder="e.g. Birthday gift" />
                        </div>
                        <div className="space-y-2">
                            <Label>Expiry Date (Optional)</Label>
                            <DatePicker
                                value={singleExp}
                                onChange={val => setSingleExp(val)}
                                placeholder="Pick expiry date"
                                fromYear={new Date().getFullYear()}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowSingle(false)}>Cancel</Button>
                        <Button onClick={handleSingleIssue} disabled={issuingSingle} className="gap-2">
                            <Ticket className="w-4 h-4" />
                            {issuingSingle ? "Issuing..." : "Issue Voucher"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Bulk Issue Modal ────────────────────────────────────── */}
            <Dialog open={showBulk} onOpenChange={setShowBulk}>
                <DialogContent className="sm:max-w-110">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Layers className="w-5 h-5 text-primary" /> Bulk Issue Vouchers
                        </DialogTitle>
                        <DialogDescription>
                            Generate multiple unique voucher codes at once — e.g. for pamphlets or campaigns.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Type</Label>
                                <Select value={bulkType} onValueChange={v => setBulkType(v as VoucherType)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {ISSUABLE_TYPES.map(({ value, label, icon: Icon }) => (
                                            <SelectItem key={value} value={value}>
                                                <div className="flex items-center gap-2"><Icon className="w-3.5 h-3.5" />{label}</div>
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Amount per Voucher (Rs.) <span className="text-destructive">*</span></Label>
                                <Input type="number" min="1" value={bulkAmount}
                                    onChange={e => setBulkAmount(e.target.value ? Number(e.target.value) : "")}
                                    placeholder="e.g. 500" autoFocus />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Quantity <span className="text-destructive">*</span>
                                <span className="text-muted-foreground font-normal ml-1">(max 500)</span>
                            </Label>
                            <Input type="number" min="1" max="500" value={bulkQty}
                                onChange={e => setBulkQty(e.target.value ? Number(e.target.value) : "")}
                                placeholder="e.g. 100" />
                        </div>
                        {bulkType === "CORPORATE" && (
                            <div className="space-y-2">
                                <Label>Company Name</Label>
                                <Input value={bulkCo} onChange={e => setBulkCo(e.target.value)} placeholder="e.g. Acme Corp" />
                            </div>
                        )}
                        <div className="space-y-2">
                            <Label>Description (Optional)</Label>
                            <Input value={bulkDesc} onChange={e => setBulkDesc(e.target.value)}
                                placeholder="e.g. Summer campaign 2026" />
                        </div>
                        <div className="space-y-2">
                            <Label>Expiry Date (Optional)</Label>
                            <Input type="date" value={bulkExp} onChange={e => setBulkExp(e.target.value)}
                                min={new Date().toISOString().split("T")[0]} />
                        </div>

                        {/* Summary preview */}
                        {bulkAmount && bulkQty && Number(bulkAmount) > 0 && Number(bulkQty) > 0 && (
                            <div className="rounded-lg bg-muted/40 border px-4 py-3 text-sm space-y-1">
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Vouchers to generate</span>
                                    <span className="font-semibold text-foreground">{bulkQty}</span>
                                </div>
                                <div className="flex justify-between text-muted-foreground">
                                    <span>Value each</span>
                                    <span className="font-semibold text-foreground">{formatCurrency(Number(bulkAmount))}</span>
                                </div>
                                <Separator className="my-1" />
                                <div className="flex justify-between font-semibold">
                                    <span>Total value</span>
                                    <span>{formatCurrency(Number(bulkAmount) * Number(bulkQty))}</span>
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowBulk(false)}>Cancel</Button>
                        <Button onClick={handleBulkIssue} disabled={issuingBulk} className="gap-2">
                            <Layers className="w-4 h-4" />
                            {issuingBulk ? `Generating...` : `Generate ${bulkQty || ""} Vouchers`}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ── Single Issued Confirmation ──────────────────────────── */}
            {issuedVoucher && (
                <Dialog open onOpenChange={() => setIssuedVoucher(null)}>
                    <DialogContent className="sm:max-w-90" showCloseButton={false}>
                        <div className="pt-4 pb-2 text-center">
                            <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
                            <h2 className="text-xl font-bold mb-1">Voucher Issued</h2>
                            <p className="text-muted-foreground text-sm mb-5">Share this code with the customer</p>
                            <div className="bg-muted/50 rounded-xl p-5 border mb-5">
                                <p className="text-2xl font-black font-mono tracking-widest text-primary">
                                    {issuedVoucher.code}
                                </p>
                                <p className="text-sm text-muted-foreground mt-2">
                                    {formatCurrency(Number(issuedVoucher.faceValue))} · {issuedVoucher.voucherType}
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => copyCode(issuedVoucher.code)} className="flex-1 gap-2">
                                    <Copy className="w-4 h-4" /> Copy
                                </Button>
                                <Button onClick={() => setIssuedVoucher(null)} className="flex-1">Done</Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* ── Bulk Result Modal ───────────────────────────────────── */}
            {bulkResult && (
                <Dialog open onOpenChange={() => setBulkResult(null)}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                {bulkResult.count} Vouchers Generated
                            </DialogTitle>
                            <DialogDescription>
                                All codes are now active and ready to distribute.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="max-h-52 overflow-y-auto rounded-lg border bg-muted/30 p-3 my-3">
                            <div className="grid grid-cols-2 gap-1.5">
                                {bulkResult.codes.map(code => (
                                    <div key={code}
                                        className="flex items-center justify-between rounded px-2 py-1 bg-background border text-xs font-mono">
                                        <span className="font-bold text-primary">{code}</span>
                                        <button onClick={() => copyCode(code)}
                                            className="text-muted-foreground hover:text-foreground ml-1">
                                            <Copy className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <DialogFooter className="gap-2">
                            <Button variant="outline" onClick={() => downloadCodes(bulkResult.codes)} className="gap-2">
                                <Download className="w-4 h-4" /> Download .txt
                            </Button>
                            <Button onClick={() => setBulkResult(null)}>Done</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {/* ── Void Confirm ────────────────────────────────────────── */}
            <AlertDialog open={!!voidId} onOpenChange={() => setVoidId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Void Voucher?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will permanently deactivate the voucher. It cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleVoid} className="bg-destructive hover:bg-destructive/90">
                            Void
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
