"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
    Download, ChevronDown, Printer,
} from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";
import { authFetch } from "@/lib/auth";
import { useAuth } from "@/components/providers/auth-provider";
import type { Voucher, VoucherType, MerchantConfig } from "@/lib/actions/vouchers";
import { getLocations } from "@/lib/actions/location";
import type { Location } from "@/lib/actions/location";
import { LocationMultiSelect } from "@/app/master/pos-config/_components/location-multi-select";
import { PrintVoucherReceipt } from "@/components/pos/print-voucher-receipt";
import { getCustomers } from "@/lib/actions/customer";
import type { Customer } from "@/lib/actions/customer";

// ── Constants ────────────────────────────────────────────────────────────────

const VOUCHER_TYPES: { value: VoucherType; label: string; icon: React.ElementType; color: string }[] = [
    { value: "GIFT",        label: "Gift",        icon: Gift,      color: "text-emerald-600" },
    { value: "EXCHANGE",    label: "Exchange",    icon: RefreshCw, color: "text-blue-600"    },
    { value: "CREDIT",      label: "Credit",      icon: CreditCard,color: "text-violet-600"  },
    { value: "CORPORATE",   label: "Corporate",   icon: Building2, color: "text-amber-600"   },
    { value: "OUTLET_GIFT", label: "Outlet Gift", icon: MapPin,    color: "text-rose-600"    },
    { value: "REFUND",      label: "Refund",      icon: Ticket,    color: "text-red-600"     },
];

// Types available for manual issuance (EXCHANGE and REFUND are system-only)
const ISSUABLE_TYPES = VOUCHER_TYPES.filter(t => t.value !== "EXCHANGE" && t.value !== "REFUND");

function voucherStatus(v: Voucher) {
    if (v.voucherType === "REFUND") return { label: "Cash Refunded", cls: "bg-red-500/10 text-red-700 border-red-300" };
    if (v.isDeleted) return { label: "Voided", cls: "bg-muted text-muted-foreground border-border" };
    if (v.isRedeemed) return { label: "Redeemed", cls: "bg-blue-500/10 text-blue-700 border-blue-300" };
    if (!v.isActive)  return { label: "Voided",   cls: "bg-muted text-muted-foreground border-border" };
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
    const { hasPermission, user } = useAuth();
    const canCreate = hasPermission("pos.voucher.create");
    const canVoid   = hasPermission("pos.voucher.void");
    const currentLocationId = user?.locationId || user?.terminal?.location?.id;

    useEffect(() => {
        if (currentLocationId) {
            setSingleLocationIds(prev => prev.length === 0 ? [currentLocationId] : prev);
            setBulkLocationIds(prev => prev.length === 0 ? [currentLocationId] : prev);
        }
    }, [currentLocationId]);

    const [vouchers,   setVouchers]   = useState<Voucher[]>([]);
    const [isLoading,  setIsLoading]  = useState(true);
    const [activeTab,  setActiveTab]  = useState<string>("ALL");
    const [showVoided, setShowVoided] = useState(false);
    const [restoreId,  setRestoreId]  = useState<string | null>(null);

    // ── Locations ────────────────────────────────────────────────
    const [locations, setLocations] = useState<Location[]>([]);

    // ── Single issue modal ───────────────────────────────────────
    const [showSingle,   setShowSingle]   = useState(false);
    const [singleType,   setSingleType]   = useState<VoucherType>("GIFT");
    const [singleAmount, setSingleAmount] = useState<number | "">("");
    const [singleDiscount, setSingleDiscount] = useState<number | "">("");
    const [singleDesc,   setSingleDesc]   = useState("");
    const [singleCo,     setSingleCo]     = useState("");
    const [singleCoGl,   setSingleCoGl]   = useState("");
    const [singleExp,    setSingleExp]    = useState("");
    const [singleLocationIds, setSingleLocationIds] = useState<string[]>([]);
    const [issuingSingle, setIssuingSingle] = useState(false);
    const [issuedVoucher, setIssuedVoucher] = useState<Voucher | null>(null);

    // ── Bulk issue modal ─────────────────────────────────────────
    const [showBulk,    setShowBulk]    = useState(false);
    const [bulkType,    setBulkType]    = useState<VoucherType>("GIFT");
    const [bulkAmount,  setBulkAmount]  = useState<number | "">("");
    const [bulkQty,     setBulkQty]     = useState<number | "">(10);
    const [bulkDiscount, setBulkDiscount] = useState<number | "">("");
    const [bulkDesc,    setBulkDesc]    = useState("");
    const [bulkCo,      setBulkCo]      = useState("");
    const [bulkCoGl,    setBulkCoGl]    = useState("");
    const [bulkExp,     setBulkExp]     = useState("");
    const [bulkLocationIds, setBulkLocationIds] = useState<string[]>([]);
    const [issuingBulk, setIssuingBulk] = useState(false);
    const [bulkResult,  setBulkResult]  = useState<{ count: number; codes: string[] } | null>(null);
    const [customers,   setCustomers]   = useState<Customer[]>([]);

    // ── Payment Mode state variables ──────────────────────────────
    const [singlePaymentMode, setSinglePaymentMode] = useState<"CASH" | "CARD">("CASH");
    const [singleMerchantId, setSingleMerchantId] = useState<string>("");
    const [singleCardholder, setSingleCardholder] = useState<string>("");
    const [singleCardLast4, setSingleCardLast4] = useState<string>("");
    const [singleSlipNo, setSingleSlipNo] = useState<string>("");

    const [bulkPaymentMode, setBulkPaymentMode] = useState<"CASH" | "CARD">("CASH");
    const [bulkMerchantId, setBulkMerchantId] = useState<string>("");
    const [bulkCardholder, setBulkCardholder] = useState<string>("");
    const [bulkCardLast4, setBulkCardLast4] = useState<string>("");
    const [bulkSlipNo, setBulkSlipNo] = useState<string>("");

    const [merchants, setMerchants] = useState<MerchantConfig[]>([]);
    const [isLoadingMerchants, setIsLoadingMerchants] = useState(false);

    // ── Void confirm ─────────────────────────────────────────────
    const [voidId, setVoidId] = useState<string | null>(null);

    // ── Print voucher receipt ────────────────────────────────────
    const [vouchersToPrint, setVouchersToPrint] = useState<Voucher[] | null>(null);

    // ── Data ─────────────────────────────────────────────────────
    const fetchVouchers = useCallback(async () => {
        setIsLoading(true);
        try {
            const query = new URLSearchParams();
            if (showVoided) {
                query.append("includeVoided", "true");
            }
            const res = await authFetch(`/pos-config/vouchers?${query.toString()}`);
            if (res.ok && res.data?.status) setVouchers(res.data.data || []);
        } catch { toast.error("Failed to load vouchers"); }
        finally { setIsLoading(false); }
    }, [showVoided]);

    useEffect(() => {
        fetchVouchers();
    }, [fetchVouchers]);

    useEffect(() => {
        getLocations().then(res => {
            if (res.status && res.data) setLocations(res.data);
        });
        getCustomers().then(data => {
            setCustomers(data);
        });

        setIsLoadingMerchants(true);
        authFetch("/pos-config/merchants/for-location")
            .then(res => {
                if (res.ok && res.data?.status) setMerchants(res.data.data || []);
            })
            .catch(() => toast.error("Failed to load merchant terminals"))
            .finally(() => setIsLoadingMerchants(false));
    }, []);

    const filtered = activeTab === "ALL"
        ? vouchers
        : vouchers.filter(v => v.voucherType === activeTab);

    // ── Handlers ─────────────────────────────────────────────────
    const handleSingleIssue = async () => {
        if (!singleAmount || Number(singleAmount) <= 0) { toast.error("Enter a valid amount"); return; }
        if (singleDiscount && (Number(singleDiscount) < 0 || Number(singleDiscount) > 100)) {
            toast.error("Discount percentage must be between 0 and 100");
            return;
        }
        if (singleType === "GIFT" && singlePaymentMode === "CARD") {
            if (!singleMerchantId) {
                toast.error("Merchant terminal is required for card payments");
                return;
            }
            if (singleCardLast4 && !/^\d{4}$/.test(singleCardLast4)) {
                toast.error("Card last 4 digits must be exactly 4 digits");
                return;
            }
        }
        if (singleType === "CORPORATE" && !singleCoGl) {
            toast.error("Please select a company/customer");
            return;
        }
        setIssuingSingle(true);
        try {
            const res = await authFetch("/pos-config/vouchers", {
                method: "POST",
                body: {
                    voucherType: singleType,
                    faceValue: Number(singleAmount),
                    discount: singleDiscount ? Number((Number(singleAmount) * (Number(singleDiscount) / 100)).toFixed(2)) : 0,
                    description: singleDesc || undefined,
                    companyName: singleType === "CORPORATE" ? singleCo || undefined : undefined,
                    companyGlCode: singleType === "CORPORATE" ? singleCoGl || undefined : undefined,
                    expiresAt: singleExp || undefined,
                    locationIds: singleLocationIds,
                    paymentMode: singleType === "GIFT" ? singlePaymentMode : undefined,
                    merchantId: (singleType === "GIFT" && singlePaymentMode === "CARD") ? singleMerchantId : undefined,
                    cardholderName: (singleType === "GIFT" && singlePaymentMode === "CARD") ? singleCardholder || undefined : undefined,
                    cardLast4: (singleType === "GIFT" && singlePaymentMode === "CARD") ? singleCardLast4 || undefined : undefined,
                    slipNo: (singleType === "GIFT" && singlePaymentMode === "CARD") ? singleSlipNo || undefined : undefined,
                },
            });
            if (res.ok && res.data?.status) {
                setIssuedVoucher(res.data.data);
                setShowSingle(false);
                setSingleAmount(""); setSingleDiscount(""); setSingleDesc(""); setSingleCo(""); setSingleCoGl(""); setSingleExp(""); setSingleLocationIds(currentLocationId ? [currentLocationId] : []);
                setSinglePaymentMode("CASH"); setSingleMerchantId(""); setSingleCardholder(""); setSingleCardLast4(""); setSingleSlipNo("");
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
        if (bulkDiscount && (Number(bulkDiscount) < 0 || Number(bulkDiscount) > 100)) {
            toast.error("Discount percentage must be between 0 and 100");
            return;
        }
        if (bulkType === "GIFT" && bulkPaymentMode === "CARD") {
            if (!bulkMerchantId) {
                toast.error("Merchant terminal is required for card payments");
                return;
            }
            if (bulkCardLast4 && !/^\d{4}$/.test(bulkCardLast4)) {
                toast.error("Card last 4 digits must be exactly 4 digits");
                return;
            }
        }
        if (bulkType === "CORPORATE" && !bulkCoGl) {
            toast.error("Please select a company/customer");
            return;
        }
        setIssuingBulk(true);
        try {
            const res = await authFetch("/pos-config/vouchers/bulk", {
                method: "POST",
                body: {
                    voucherType: bulkType,
                    faceValue: Number(bulkAmount),
                    quantity: Number(bulkQty),
                    discount: bulkDiscount ? Number((Number(bulkAmount) * (Number(bulkDiscount) / 100)).toFixed(2)) : 0,
                    description: bulkDesc || undefined,
                    companyName: bulkType === "CORPORATE" ? bulkCo || undefined : undefined,
                    companyGlCode: bulkType === "CORPORATE" ? bulkCoGl || undefined : undefined,
                    expiresAt: bulkExp || undefined,
                    locationIds: bulkLocationIds,
                    paymentMode: bulkType === "GIFT" ? bulkPaymentMode : undefined,
                    merchantId: (bulkType === "GIFT" && bulkPaymentMode === "CARD") ? bulkMerchantId : undefined,
                    cardholderName: (bulkType === "GIFT" && bulkPaymentMode === "CARD") ? bulkCardholder || undefined : undefined,
                    cardLast4: (bulkType === "GIFT" && bulkPaymentMode === "CARD") ? bulkCardLast4 || undefined : undefined,
                    slipNo: (bulkType === "GIFT" && bulkPaymentMode === "CARD") ? bulkSlipNo || undefined : undefined,
                },
            });
            if (res.ok && res.data?.status) {
                setBulkResult(res.data.data);
                setShowBulk(false);
                fetchVouchers();
            } else {
                toast.error(res.data?.message || "Failed to issue vouchers");
            }
        } catch { toast.error("Failed to issue vouchers"); }
        finally { setIssuingBulk(false); }
    };

    const resetBulkForm = () => {
        setBulkAmount("");
        setBulkQty(10);
        setBulkDiscount("");
        setBulkDesc("");
        setBulkCo("");
        setBulkCoGl("");
        setBulkExp("");
        setBulkLocationIds(currentLocationId ? [currentLocationId] : []);
        setBulkPaymentMode("CASH");
        setBulkMerchantId("");
        setBulkCardholder("");
        setBulkCardLast4("");
        setBulkSlipNo("");
    };

    const handlePrintBulk = () => {
        if (!bulkResult) return;
        const selectedLocations = locations
            .filter(loc => bulkLocationIds.includes(loc.id))
            .map(loc => ({
                id: Math.random().toString(),
                location: { id: loc.id, name: loc.name, code: loc.code },
            }));
        const createdVouchers: Voucher[] = bulkResult.codes.map(code => ({
            id: Math.random().toString(),
            code,
            voucherType: bulkType,
            faceValue: Number(bulkAmount),
            discount: bulkDiscount ? Number((Number(bulkAmount) * (Number(bulkDiscount) / 100)).toFixed(2)) : 0,
            description: bulkDesc || undefined,
            companyName: bulkCo || undefined,
            companyGlCode: bulkCoGl || undefined,
            requireCustomerMatch: false,
            expiresAt: bulkExp || undefined,
            createdAt: new Date().toISOString(),
            isActive: true,
            isRedeemed: false,
            locations: selectedLocations,
        }));
        setVouchersToPrint(createdVouchers);
        setBulkResult(null);
        resetBulkForm();
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

    const handleRestore = async () => {
        if (!restoreId) return;
        try {
            const res = await authFetch(`/pos-config/vouchers/${restoreId}/restore`, { method: "PUT", body: {} });
            if (res.ok && res.data?.status) {
                toast.success("Voucher restored");
                setRestoreId(null);
                fetchVouchers();
            } else {
                toast.error(res.data?.message || "Failed to restore");
            }
        } catch { toast.error("Failed to restore voucher"); }
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

    const singleDiscountAmount = (singleAmount && singleDiscount)
        ? Number((Number(singleAmount) * (Number(singleDiscount) / 100)).toFixed(2))
        : 0;

    const bulkDiscountAmount = (bulkAmount && bulkDiscount)
        ? Number((Number(bulkAmount) * (Number(bulkDiscount) / 100)).toFixed(2))
        : 0;

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
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-3">
                    <TabsList className="w-full md:w-auto flex flex-wrap h-auto">
                        <TabsTrigger value="ALL">All ({vouchers.length})</TabsTrigger>
                        {VOUCHER_TYPES.map(({ value, label }) => (
                            <TabsTrigger key={value} value={value}>
                                {label} ({vouchers.filter(v => v.voucherType === value).length})
                            </TabsTrigger>
                        ))}
                    </TabsList>
                    
                    <div className="flex items-center gap-2 self-end md:self-auto px-1">
                        <Switch
                            id="show-voided"
                            checked={showVoided}
                            onCheckedChange={setShowVoided}
                        />
                        <Label htmlFor="show-voided" className="text-sm cursor-pointer select-none font-medium">
                            Show Voided Vouchers
                        </Label>
                    </div>
                </div>

                <TabsContent value={activeTab} className="mt-0">
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
                                                    {v.description ? v.description : v.companyName ? `${v.companyName}${v.companyGlCode ? ` (${v.companyGlCode})` : ""}` : "—"}
                                                </TableCell>
                                                 <TableCell className="text-right font-mono">
                                                     <div className="font-semibold">{formatCurrency(Number(v.faceValue))}</div>
                                                     {v.discount !== undefined && Number(v.discount) > 0 && (
                                                         <div className="text-[10px] text-muted-foreground">
                                                             Disc: {formatCurrency(Number(v.discount))}
                                                         </div>
                                                     )}
                                                 </TableCell>
                                                <TableCell className="text-sm text-muted-foreground">{fmtDate(v.expiresAt)}</TableCell>
                                                <TableCell className="text-sm text-muted-foreground">{fmtDate(v.createdAt)}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={cn("text-[10px] px-2 py-0 h-5", st.cls)}>
                                                        {st.label}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-1">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon"
                                                            className="h-7 w-7 rounded-full text-muted-foreground hover:text-primary"
                                                            onClick={() => setVouchersToPrint([v])}
                                                            title="Print voucher receipt"
                                                        >
                                                            <Printer className="w-3.5 h-3.5" />
                                                        </Button>
                                                        
                                                        {/* Void button - only for active, non-voided vouchers */}
                                                        {v.isActive && !v.isDeleted && !v.isRedeemed && canVoid && (
                                                            <Button variant="ghost" size="icon"
                                                                className="h-7 w-7 rounded-full text-muted-foreground hover:text-destructive"
                                                                onClick={() => setVoidId(v.id)}
                                                                title="Void voucher">
                                                                <XCircle className="w-3.5 h-3.5" />
                                                            </Button>
                                                        )}

                                                        {/* Restore button - for voided/deleted vouchers */}
                                                        {v.isDeleted && !v.isRedeemed && canVoid && (
                                                            <Button variant="ghost" size="icon"
                                                                className="h-7 w-7 rounded-full text-muted-foreground hover:text-emerald-600"
                                                                onClick={() => setRestoreId(v.id)}
                                                                title="Restore voucher">
                                                                <RefreshCw className="w-3.5 h-3.5" />
                                                            </Button>
                                                        )}
                                                    </div>
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
            <Dialog open={showSingle} onOpenChange={open => { setShowSingle(open); if (!open) setSingleLocationIds(currentLocationId ? [currentLocationId] : []); }}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Ticket className="w-5 h-5 text-primary" /> Issue Voucher
                        </DialogTitle>
                        <DialogDescription>A unique code will be generated automatically.</DialogDescription>
                    </DialogHeader>
                    <div className="flex gap-5 py-2">
                        {/* Left — form fields */}
                        <div className="flex-1 space-y-4">
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
                            {singleType === "GIFT" && (
                                <div className="space-y-4 rounded-lg border p-3 bg-muted/20 animate-in fade-in slide-in-from-top-1 duration-200 text-left">
                                    <div className="space-y-2">
                                        <Label>Payment Method <span className="text-destructive">*</span></Label>
                                        <Select value={singlePaymentMode} onValueChange={v => setSinglePaymentMode(v as any)}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="CASH">Cash</SelectItem>
                                                <SelectItem value="CARD">Credit Card</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {singlePaymentMode === "CARD" && (
                                        <div className="space-y-3 pt-2 border-t">
                                            <div className="space-y-2">
                                                <Label>Merchant / Bank Terminal <span className="text-destructive">*</span></Label>
                                                <Select value={singleMerchantId} onValueChange={setSingleMerchantId}>
                                                    <SelectTrigger>
                                                        {isLoadingMerchants ? "Loading terminals..." : <SelectValue placeholder="Select merchant terminal..." />}
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {merchants.length === 0 && (
                                                            <div className="p-2 text-center text-xs text-muted-foreground italic">
                                                                No merchant terminals configured
                                                            </div>
                                                        )}
                                                        {merchants.map(m => (
                                                            <SelectItem key={m.id} value={m.id}>
                                                                {m.bankName} - {m.description} (#{m.merchantCode})
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="space-y-2">
                                                    <Label>Cardholder Name</Label>
                                                    <Input value={singleCardholder} onChange={e => setSingleCardholder(e.target.value)} placeholder="Name on card" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Card # (last 4)</Label>
                                                    <Input value={singleCardLast4} maxLength={4} onChange={e => setSingleCardLast4(e.target.value.replace(/\D/g, ""))} placeholder="••••" />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label>AUTH ID / Approval Code</Label>
                                                <Input value={singleSlipNo} onChange={e => setSingleSlipNo(e.target.value)} placeholder="Slip or reference number" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {singleType === "GIFT" && (
                                <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <Label>Discount (%)</Label>
                                    <Input type="number" min="0" max="100" value={singleDiscount}
                                        onChange={e => setSingleDiscount(e.target.value ? Number(e.target.value) : "")}
                                        placeholder="e.g. 10" />
                                </div>
                            )}
                            {singleType === "CORPORATE" && (
                                <div className="space-y-2">
                                    <Label>Company / ERP Customer <span className="text-destructive">*</span></Label>
                                    <Select 
                                        value={singleCoGl} 
                                        onValueChange={val => {
                                            setSingleCoGl(val);
                                            const cust = customers.find(c => c.code === val);
                                            if (cust) {
                                                setSingleCo(cust.name);
                                            } else {
                                                setSingleCo("");
                                            }
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select ERP customer..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {customers.length === 0 && (
                                                <div className="p-2 text-center text-xs text-muted-foreground italic">
                                                    No ERP customers found
                                                </div>
                                            )}
                                            {customers.map(c => (
                                                <SelectItem key={c.id} value={c.code}>
                                                    {c.name} ({c.code})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
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

                        {/* Right — location selector */}
                        <div className="w-64 shrink-0 space-y-2">
                            <Label className="flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                                Redeemable At
                                <span className="text-muted-foreground font-normal">(optional)</span>
                            </Label>
                            <p className="text-[11px] text-muted-foreground leading-snug">
                                Leave empty to allow redemption at all locations.
                            </p>
                            <LocationMultiSelect
                                locations={locations}
                                selected={singleLocationIds}
                                onChange={setSingleLocationIds}
                                disabled={issuingSingle}
                                maxHeight="280px"
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
            <Dialog open={showBulk} onOpenChange={open => { setShowBulk(open); if (!open) setBulkLocationIds(currentLocationId ? [currentLocationId] : []); }}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Layers className="w-5 h-5 text-primary" /> Bulk Issue Vouchers
                        </DialogTitle>
                        <DialogDescription>
                            Generate multiple unique voucher codes at once — e.g. for pamphlets or campaigns.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex gap-5 py-2">
                        {/* Left — form fields */}
                        <div className="flex-1 space-y-4">
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
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Quantity <span className="text-destructive">*</span>
                                        <span className="text-muted-foreground font-normal ml-1">(max 500)</span>
                                    </Label>
                                    <Input type="number" min="1" max="500" value={bulkQty}
                                        onChange={e => setBulkQty(e.target.value ? Number(e.target.value) : "")}
                                        placeholder="e.g. 100" />
                                </div>
                                {bulkType === "GIFT" && (
                                    <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                        <Label>Discount per Voucher (%)</Label>
                                        <Input type="number" min="0" max="100" value={bulkDiscount}
                                            onChange={e => setBulkDiscount(e.target.value ? Number(e.target.value) : "")}
                                            placeholder="e.g. 10" />
                                    </div>
                                )}
                            </div>

                            {bulkType === "GIFT" && (
                                <div className="space-y-4 rounded-lg border p-3 bg-muted/20 animate-in fade-in slide-in-from-top-1 duration-200 text-left">
                                    <div className="space-y-2">
                                        <Label>Payment Method <span className="text-destructive">*</span></Label>
                                        <Select value={bulkPaymentMode} onValueChange={v => setBulkPaymentMode(v as any)}>
                                            <SelectTrigger><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="CASH">Cash</SelectItem>
                                                <SelectItem value="CARD">Credit Card</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {bulkPaymentMode === "CARD" && (
                                        <div className="space-y-3 pt-2 border-t">
                                            <div className="space-y-2">
                                                <Label>Merchant / Bank Terminal <span className="text-destructive">*</span></Label>
                                                <Select value={bulkMerchantId} onValueChange={setBulkMerchantId}>
                                                    <SelectTrigger>
                                                        {isLoadingMerchants ? "Loading terminals..." : <SelectValue placeholder="Select merchant terminal..." />}
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {merchants.length === 0 && (
                                                            <div className="p-2 text-center text-xs text-muted-foreground italic">
                                                                No merchant terminals configured
                                                            </div>
                                                        )}
                                                        {merchants.map(m => (
                                                            <SelectItem key={m.id} value={m.id}>
                                                                {m.bankName} - {m.description} (#{m.merchantCode})
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2">
                                                <div className="space-y-2">
                                                    <Label>Cardholder Name</Label>
                                                    <Input value={bulkCardholder} onChange={e => setBulkCardholder(e.target.value)} placeholder="Name on card" />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Card # (last 4)</Label>
                                                    <Input value={bulkCardLast4} maxLength={4} onChange={e => setBulkCardLast4(e.target.value.replace(/\D/g, ""))} placeholder="••••" />
                                                </div>
                                            </div>

                                            <div className="space-y-2">
                                                <Label>AUTH ID / Approval Code</Label>
                                                <Input value={bulkSlipNo} onChange={e => setBulkSlipNo(e.target.value)} placeholder="Slip or reference number" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            {bulkType === "CORPORATE" && (
                                <div className="space-y-2">
                                    <Label>Company / ERP Customer <span className="text-destructive">*</span></Label>
                                    <Select 
                                        value={bulkCoGl} 
                                        onValueChange={val => {
                                            setBulkCoGl(val);
                                            const cust = customers.find(c => c.code === val);
                                            if (cust) {
                                                setBulkCo(cust.name);
                                            } else {
                                                setBulkCo("");
                                            }
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select ERP customer..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {customers.length === 0 && (
                                                <div className="p-2 text-center text-xs text-muted-foreground italic">
                                                    No ERP customers found
                                                </div>
                                            )}
                                            {customers.map(c => (
                                                <SelectItem key={c.id} value={c.code}>
                                                    {c.name} ({c.code})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
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
                                    {bulkType === "GIFT" && bulkDiscount && Number(bulkDiscount) > 0 && (
                                        <>
                                            <div className="flex justify-between text-muted-foreground">
                                                <span>Discount each ({bulkDiscount}%)</span>
                                                <span className="font-semibold text-destructive">-{formatCurrency(bulkDiscountAmount)}</span>
                                            </div>
                                            <div className="flex justify-between text-muted-foreground">
                                                <span>Net price each</span>
                                                <span className="font-semibold text-emerald-600">{formatCurrency(Number(bulkAmount) - bulkDiscountAmount)}</span>
                                            </div>
                                        </>
                                    )}
                                    <Separator className="my-1" />
                                    <div className="flex justify-between font-semibold">
                                        <span>Total face value</span>
                                        <span>{formatCurrency(Number(bulkAmount) * Number(bulkQty))}</span>
                                    </div>
                                    {bulkType === "GIFT" && bulkDiscount && Number(bulkDiscount) > 0 && (
                                        <div className="flex justify-between font-semibold text-emerald-600">
                                            <span>Total amount payable</span>
                                            <span>{formatCurrency((Number(bulkAmount) - bulkDiscountAmount) * Number(bulkQty))}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Right — location selector */}
                        <div className="w-64 shrink-0 space-y-2">
                            <Label className="flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                                Redeemable At
                                <span className="text-muted-foreground font-normal">(optional)</span>
                            </Label>
                            <p className="text-[11px] text-muted-foreground leading-snug">
                                Leave empty to allow redemption at all locations.
                            </p>
                            <LocationMultiSelect
                                locations={locations}
                                selected={bulkLocationIds}
                                onChange={setBulkLocationIds}
                                disabled={issuingBulk}
                                maxHeight="280px"
                            />
                        </div>
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

            {/* ── Bulk Result Modal ───────────────────────────────────── */}
            {bulkResult && (
                <Dialog open onOpenChange={() => { setBulkResult(null); resetBulkForm(); }}>
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
                            <Button onClick={handlePrintBulk} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                                <Printer className="w-4 h-4" /> Print Receipts
                            </Button>
                            <Button onClick={() => { setBulkResult(null); resetBulkForm(); }}>Done</Button>
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

            {/* ── Restore Confirm ────────────────────────────────────────── */}
            <AlertDialog open={!!restoreId} onOpenChange={() => setRestoreId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Restore Voucher?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will reactivate the voucher. It will be usable again.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRestore} className="bg-emerald-600 hover:bg-emerald-600/90 text-white">
                            Restore
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* ── Issued Voucher Success Dialog ──────────────────────── */}
            {issuedVoucher && (
                <Dialog open onOpenChange={() => setIssuedVoucher(null)}>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                Voucher Issued Successfully
                            </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="text-center space-y-2 p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200">
                                <p className="text-sm text-muted-foreground">Voucher Code</p>
                                <div className="flex items-center justify-center gap-2">
                                    <p className="font-mono font-black text-2xl text-emerald-700">{issuedVoucher.code}</p>
                                    <button onClick={() => copyCode(issuedVoucher.code)}
                                        className="text-emerald-600 hover:text-emerald-700">
                                        <Copy className="w-4 h-4" />
                                    </button>
                                </div>
                                <p className="text-sm font-semibold">{formatCurrency(Number(issuedVoucher.faceValue))}</p>
                            </div>
                        </div>
                        <DialogFooter className="gap-2">
                            <Button variant="outline" onClick={() => setIssuedVoucher(null)}>Close</Button>
                            <Button onClick={() => {
                                setVouchersToPrint([issuedVoucher]);
                                setIssuedVoucher(null);
                            }} className="gap-2">
                                <Printer className="w-4 h-4" /> Print Receipt
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {/* ── Print Voucher Receipt ───────────────────────────────── */}
            {vouchersToPrint && (
                <PrintVoucherReceipt
                    vouchers={vouchersToPrint}
                    autoPrint={false}
                    onClose={() => setVouchersToPrint(null)}
                />
            )}
        </div>
    );
}
