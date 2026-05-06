"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
    Search, UserPlus, RefreshCcw, Users, Phone, MapPin,
    ChevronRight, X, Check, Loader2, Pencil, Hash,
    ShoppingBag, Store, CreditCard, TrendingUp, Receipt,
    Package, Calendar, ArrowUpRight, Wallet, AlertCircle,
    Banknote, Building2, Ticket, BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { authFetch } from "@/lib/auth";
import { toast } from "sonner";
import { useDebounce } from "@/hooks/use-debounce";
import { useAuth } from "@/components/providers/auth-provider";

interface Customer {
    id: string;
    code: string;
    name: string;
    contactNo?: string;
    address?: string;
    email?: string;
    balance?: number;
    createdAt: string;
}

interface PosSale {
    id: string;
    orderNumber: string;
    grandTotal: number;
    paymentMethod?: string;
    paymentStatus: string;
    tenderType?: string;
    status: string;
    locationId?: string;
    locationName?: string;
    createdAt: string;
    items: Array<{
        id: string;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
        item: { description: string; sku: string } | null;
    }>;
}

interface CustomerDetail extends Customer {
    posSales: PosSale[];
    salesInvoices: Array<{
        id: string;
        invoiceNo: string;
        invoiceDate: string;
        grandTotal: number;
        paidAmount: number;
        status: string;
    }>;
}

const EMPTY_FORM = { code: "", name: "", contactNo: "", address: "" };

export default function PosCustomersPage() {
    const { hasPermission } = useAuth();
    const canCreate = hasPermission('pos.customer.create');
    const canUpdate = hasPermission('pos.customer.update');
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");
    const debouncedSearch = useDebounce(search, 300);

    // Sheet — view/edit
    const [selected, setSelected] = useState<Customer | null>(null);
    const [isSheetOpen, setIsSheetOpen] = useState(false);

    // Dialog — create / edit form
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState(EMPTY_FORM);
    const [isSaving, setIsSaving] = useState(false);

    // Ledger detail
    const [customerDetail, setCustomerDetail] = useState<CustomerDetail | null>(null);
    const [isLoadingDetail, setIsLoadingDetail] = useState(false);

    // Credit payment
    const [isPaymentOpen, setIsPaymentOpen] = useState(false);
    const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
    const [paymentMethod, setPaymentMethod] = useState("cash");
    const [paymentNotes, setPaymentNotes] = useState("");
    const [cardLast4, setCardLast4] = useState("");
    const [slipRef, setSlipRef] = useState("");
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);

    const fetchCustomers = useCallback(async (q = debouncedSearch) => {
        setIsLoading(true);
        try {
            const res = await authFetch("/pos-sales/customers", { params: { search: q || undefined } });
            if (res.ok && res.data?.status) setCustomers(res.data.data || []);
            else setCustomers([]);
        } catch { setCustomers([]); }
        finally { setIsLoading(false); }
    }, [debouncedSearch]);

    const loadCustomerDetail = async (customerId: string) => {
        setIsLoadingDetail(true);
        setCustomerDetail(null);
        try {
            const res = await authFetch(`/sales/customers/ledger/${customerId}/transactions`);
            if (res.ok && res.data?.status) setCustomerDetail(res.data.data);
        } catch { /* silent */ }
        finally { setIsLoadingDetail(false); }
    };

    const handlePayCredit = async () => {
        if (!selected || selectedOrderIds.size === 0) return;
        setIsProcessingPayment(true);
        try {
            const res = await authFetch(`/pos-sales/customers/${selected.id}/pay-credit`, {
                method: "POST",
                body: {
                    orderIds: Array.from(selectedOrderIds),
                    paymentMethod,
                    notes: paymentNotes || undefined,
                    cardLast4: cardLast4 || undefined,
                    slipRef: slipRef || undefined,
                },
            });
            if (res.ok && res.data?.status) {
                toast.success(res.data.message || "Payment recorded successfully");
                setIsPaymentOpen(false);
                setSelectedOrderIds(new Set());
                setPaymentNotes("");
                setCardLast4("");
                setSlipRef("");
                // Refresh detail
                loadCustomerDetail(selected.id);
                // Refresh list to update balance
                fetchCustomers(debouncedSearch);
            } else {
                toast.error(res.data?.message || "Failed to record payment");
            }
        } catch {
            toast.error("Something went wrong. Please try again.");
        } finally {
            setIsProcessingPayment(false);
        }
    };

    useEffect(() => { fetchCustomers(); }, [debouncedSearch]);

    const openCreate = () => {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setIsFormOpen(true);
    };

    const openEdit = (c: Customer) => {
        setEditingId(c.id);
        setForm({ code: c.code, name: c.name, contactNo: c.contactNo || "", address: c.address || "" });
        setIsSheetOpen(false);
        setIsFormOpen(true);
    };

    const handleSave = async () => {
        if (!form.code.trim() || !form.name.trim()) {
            toast.error("Code and Name are required.");
            return;
        }
        setIsSaving(true);
        try {
            const res = editingId
                ? await authFetch(`/pos-sales/customers/${editingId}`, { method: "PATCH", body: JSON.stringify(form) })
                : await authFetch("/pos-sales/customers", { method: "POST", body: JSON.stringify(form) });

            if (res.ok && res.data?.status) {
                toast.success(editingId ? "Customer updated." : "Customer created.");
                setIsFormOpen(false);
                fetchCustomers(debouncedSearch);
            } else {
                toast.error(res.data?.message || "Failed to save customer.");
            }
        } catch { toast.error("Something went wrong."); }
        finally { setIsSaving(false); }
    };

    const handleRowClick = (c: Customer) => {
        setSelected(c);
        setIsSheetOpen(true);
        loadCustomerDetail(c.id);
    };

    return (
        <div className="flex flex-col h-full -m-4 sm:-m-6 lg:-m-8">
            {/* Header */}
            <div
                className="flex-none p-4 md:p-6 pb-4 border-b bg-muted/20 backdrop-blur-xl sticky z-10"
                style={{ top: "calc(var(--banner-height) + 3rem)" }}
            >
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                            <Users className="h-6 w-6 text-primary" /> Customers
                        </h1>
                        <p className="text-sm text-muted-foreground font-medium mt-0.5">
                            {customers.length > 0 ? `${customers.length} customers` : "Search or add customers"}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" onClick={() => fetchCustomers()} disabled={isLoading}>
                            <RefreshCcw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                        </Button>
                        <Button className="gap-2 font-semibold" onClick={openCreate} disabled={!canCreate}>
                            <UserPlus className="h-4 w-4" /> Add Customer
                        </Button>
                    </div>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 pointer-events-none" />
                    <Input
                        placeholder="Search by name, code, or phone…"
                        className="pl-9 h-11 bg-muted/30 border-border/50"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        autoFocus
                    />
                    {search && (
                        <button className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={() => setSearch("")}>
                            <X className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Table header */}
            {!isLoading && customers.length > 0 && (
                <div className="flex-none px-4 md:px-6 py-2 border-b bg-muted/10">
                    <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 items-center">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground w-20">Code</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Name</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hidden sm:block">Phone</span>
                        <span className="w-5" />
                    </div>
                </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-auto divide-y divide-border/50">
                {isLoading ? (
                    <div className="p-4 space-y-2">
                        {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
                    </div>
                ) : customers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[50vh] text-center p-8">
                        <div className="h-20 w-20 rounded-full bg-muted/40 flex items-center justify-center mb-4">
                            <Users className="h-10 w-10 text-muted-foreground/30" />
                        </div>
                        <p className="font-semibold text-muted-foreground">
                            {search ? `No customers matching "${search}"` : "No customers yet"}
                        </p>
                        <p className="text-sm text-muted-foreground/60 mt-1">Add your first customer to get started</p>
                        <Button className="mt-4 gap-2" onClick={openCreate} disabled={!canCreate}>
                            <UserPlus className="h-4 w-4" /> Add Customer
                        </Button>
                    </div>
                ) : (
                    customers.map((c) => (
                        <button
                            key={c.id}
                            className="w-full grid grid-cols-[auto_1fr_auto_auto] gap-4 items-center px-4 md:px-6 py-3.5 hover:bg-muted/30 transition-colors text-left group"
                            onClick={() => handleRowClick(c)}
                        >
                            <span className="font-mono text-xs font-bold text-muted-foreground bg-muted/60 px-2 py-1 rounded w-20 truncate text-center">
                                {c.code}
                            </span>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{c.name}</p>
                                {c.address && (
                                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                                        <MapPin className="h-3 w-3 flex-none" />{c.address}
                                    </p>
                                )}
                            </div>
                            <span className="text-xs text-muted-foreground hidden sm:flex items-center gap-1">
                                {c.contactNo ? <><Phone className="h-3 w-3" />{c.contactNo}</> : "—"}
                            </span>
                            <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                        </button>
                    ))
                )}
            </div>

            {/* Detail Sheet */}
            <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
                <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col gap-0">
                    <SheetHeader className="p-5 border-b bg-muted/20 flex-none">
                        <SheetTitle className="flex items-center gap-2">
                            <Users className="h-5 w-5 text-primary" /> Customer Profile
                        </SheetTitle>
                    </SheetHeader>

                    {selected && (
                        <ScrollArea className="flex-1">
                            <div className="p-5 space-y-5">

                                {/* ── Identity card ── */}
                                <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
                                    <div className="flex items-start justify-between gap-2 mb-3">
                                        <div>
                                            <p className="text-lg font-bold leading-tight">{selected.name}</p>
                                            <Badge variant="outline" className="font-mono text-xs mt-1">{selected.code}</Badge>
                                        </div>
                                        <Button variant="outline" size="sm" className="gap-1.5 flex-none" disabled={!canUpdate} onClick={() => openEdit(selected)}>
                                            <Pencil className="h-3.5 w-3.5" /> Edit
                                        </Button>
                                    </div>
                                    <Separator className="mb-3" />
                                    <div className="space-y-1.5">
                                        {selected.contactNo && (
                                            <div className="flex items-center gap-2 text-sm">
                                                <Phone className="h-3.5 w-3.5 text-muted-foreground flex-none" />
                                                <span>{selected.contactNo}</span>
                                            </div>
                                        )}
                                        {selected.address && (
                                            <div className="flex items-center gap-2 text-sm">
                                                <MapPin className="h-3.5 w-3.5 text-muted-foreground flex-none" />
                                                <span>{selected.address}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                            <Hash className="h-3.5 w-3.5 flex-none" />
                                            <span>Added {new Date(selected.createdAt).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* ── Ledger / Purchases ── */}
                                {isLoadingDetail ? (
                                    <div className="space-y-2">
                                        <Skeleton className="h-20 w-full rounded-xl" />
                                        <Skeleton className="h-32 w-full rounded-xl" />
                                        <Skeleton className="h-32 w-full rounded-xl" />
                                    </div>
                                ) : customerDetail ? (
                                    <Tabs defaultValue="purchases">
                                        <TabsList className="w-full">
                                            <TabsTrigger value="purchases" className="flex-1 gap-1.5">
                                                <ShoppingBag className="h-3.5 w-3.5" />
                                                Purchases
                                                {customerDetail.posSales?.length > 0 && (
                                                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5 ml-1">{customerDetail.posSales.length}</Badge>
                                                )}
                                            </TabsTrigger>
                                            <TabsTrigger value="ledger" className="flex-1 gap-1.5">
                                                <Wallet className="h-3.5 w-3.5" />
                                                Ledger
                                            </TabsTrigger>
                                        </TabsList>

                                        {/* ── Purchases tab ── */}
                                        <TabsContent value="purchases" className="mt-3 space-y-3">
                                            {/* Summary stats */}
                                            {(() => {
                                                const sales = customerDetail.posSales || [];
                                                const totalSpent = sales.reduce((s, o) => s + Number(o.grandTotal), 0);
                                                const storeMap = new Map<string, { name: string; count: number; total: number }>();
                                                sales.forEach(o => {
                                                    const key = o.locationId || "__unknown__";
                                                    const name = o.locationName || "Unknown Store";
                                                    const existing = storeMap.get(key);
                                                    if (existing) { existing.count++; existing.total += Number(o.grandTotal); }
                                                    else storeMap.set(key, { name, count: 1, total: Number(o.grandTotal) });
                                                });
                                                const stores = Array.from(storeMap.values());
                                                return (
                                                    <>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div className="rounded-lg border bg-card p-3">
                                                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Total Purchases</p>
                                                                <p className="text-xl font-bold">PKR {totalSpent.toLocaleString()}</p>
                                                                <p className="text-xs text-muted-foreground mt-0.5">{sales.length} orders</p>
                                                            </div>
                                                            <div className="rounded-lg border bg-card p-3">
                                                                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Stores Visited</p>
                                                                <p className="text-xl font-bold">{stores.length}</p>
                                                                <p className="text-xs text-muted-foreground mt-0.5">locations</p>
                                                            </div>
                                                        </div>

                                                        {/* Per-store breakdown */}
                                                        {stores.length > 0 && (
                                                            <div className="rounded-xl border border-border/60 overflow-hidden">
                                                                <div className="px-3 py-2 bg-muted/30 border-b">
                                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Store Breakdown</p>
                                                                </div>
                                                                <div className="divide-y divide-border/50">
                                                                    {stores.map(store => (
                                                                        <div key={store.name} className="flex items-center justify-between px-3 py-2.5">
                                                                            <div className="flex items-center gap-2">
                                                                                <Store className="h-3.5 w-3.5 text-primary/60 flex-none" />
                                                                                <span className="text-sm font-medium">{store.name}</span>
                                                                            </div>
                                                                            <div className="text-right">
                                                                                <p className="text-sm font-bold">PKR {store.total.toLocaleString()}</p>
                                                                                <p className="text-[10px] text-muted-foreground">{store.count} order{store.count !== 1 ? "s" : ""}</p>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </>
                                                );
                                            })()}

                                            {/* Order list */}
                                            {customerDetail.posSales?.length === 0 ? (
                                                <div className="text-center py-10 text-muted-foreground">
                                                    <ShoppingBag className="h-10 w-10 mx-auto mb-2 opacity-20" />
                                                    <p className="text-sm">No purchases yet</p>
                                                </div>
                                            ) : (
                                                <div className="space-y-2">
                                                    {customerDetail.posSales.map(order => (
                                                        <div key={order.id} className="rounded-xl border border-border/60 bg-card overflow-hidden">
                                                            {/* Order header */}
                                                            <div className="flex items-center justify-between px-3 py-2.5 bg-muted/20 border-b border-border/40">
                                                                <div className="flex items-center gap-2">
                                                                    <Receipt className="h-3.5 w-3.5 text-primary/60" />
                                                                    <span className="font-mono text-xs font-bold">{order.orderNumber}</span>
                                                                    {order.locationName && (
                                                                        <Badge variant="outline" className="text-[9px] h-4 px-1.5 gap-0.5">
                                                                            <Store className="h-2.5 w-2.5" />{order.locationName}
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    <Badge
                                                                        variant={order.paymentStatus === "paid" ? "default" : order.paymentStatus === "unpaid" ? "destructive" : "secondary"}
                                                                        className="text-[9px] h-4 px-1.5"
                                                                    >
                                                                        {order.paymentStatus}
                                                                    </Badge>
                                                                    <Badge
                                                                        variant={order.status === "completed" ? "default" : order.status === "returned" ? "destructive" : "secondary"}
                                                                        className="text-[9px] h-4 px-1.5"
                                                                    >
                                                                        {order.status}
                                                                    </Badge>
                                                                </div>
                                                            </div>
                                                            {/* Items */}
                                                            <div className="divide-y divide-border/30">
                                                                {order.items.map(item => (
                                                                    <div key={item.id} className="flex items-center justify-between px-3 py-2">
                                                                        <div className="flex items-center gap-2 min-w-0">
                                                                            <Package className="h-3 w-3 text-muted-foreground/50 flex-none" />
                                                                            <div className="min-w-0">
                                                                                <p className="text-xs font-medium truncate">{item.item?.description || "—"}</p>
                                                                                <p className="text-[10px] text-muted-foreground font-mono">{item.item?.sku}</p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="text-right flex-none ml-2">
                                                                            <p className="text-xs font-bold">PKR {Number(item.lineTotal || item.unitPrice * item.quantity).toLocaleString()}</p>
                                                                            <p className="text-[10px] text-muted-foreground">×{item.quantity}</p>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                            {/* Footer */}
                                                            <div className="flex items-center justify-between px-3 py-2 bg-muted/10 border-t border-border/40">
                                                                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                                                    <Calendar className="h-3 w-3" />
                                                                    {new Date(order.createdAt).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                    {order.paymentMethod && (
                                                                        <span className="text-[10px] text-muted-foreground capitalize flex items-center gap-0.5">
                                                                            <CreditCard className="h-3 w-3" />{order.tenderType === "split" ? "split" : order.paymentMethod}
                                                                        </span>
                                                                    )}
                                                                    <span className="font-bold text-sm">PKR {Number(order.grandTotal).toLocaleString()}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </TabsContent>

                                        {/* ── Ledger tab ── */}
                                        <TabsContent value="ledger" className="mt-3 space-y-3">
                                            {(() => {
                                                const sales = customerDetail.posSales || [];
                                                const creditSales = sales.filter(s => s.paymentStatus === "unpaid");
                                                const paidSales = sales.filter(s => s.paymentStatus === "paid");
                                                const totalCredit = creditSales.reduce((s, o) => s + Number(o.grandTotal), 0);
                                                const totalPaid = paidSales.reduce((s, o) => s + Number(o.grandTotal), 0);
                                                const balance = Number(customerDetail.balance ?? 0);
                                                const selectedTotal = creditSales
                                                    .filter(o => selectedOrderIds.has(o.id))
                                                    .reduce((s, o) => s + Number(o.grandTotal), 0);
                                                return (
                                                    <>
                                                        {/* Balance summary */}
                                                        <div className={`rounded-xl border p-4 ${totalCredit > 0 ? "border-destructive/30 bg-destructive/5" : "border-green-500/30 bg-green-500/5"}`}>
                                                            <div className="flex items-center justify-between">
                                                                <div>
                                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Outstanding Balance</p>
                                                                    <p className={`text-2xl font-bold mt-1 ${totalCredit > 0 ? "text-destructive" : "text-green-600"}`}>
                                                                        PKR {totalCredit.toLocaleString()}
                                                                    </p>
                                                                </div>
                                                                {totalCredit > 0
                                                                    ? <AlertCircle className="h-8 w-8 text-destructive/40" />
                                                                    : <Check className="h-8 w-8 text-green-500/40" />
                                                                }
                                                            </div>
                                                            {balance !== 0 && (
                                                                <p className="text-xs text-muted-foreground mt-2">
                                                                    Ledger balance: <span className="font-mono font-semibold">PKR {balance.toLocaleString()}</span>
                                                                </p>
                                                            )}
                                                        </div>

                                                        {/* Stats row */}
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div className="rounded-lg border bg-card p-3">
                                                                <div className="flex items-center gap-1.5 mb-1">
                                                                    <TrendingUp className="h-3.5 w-3.5 text-green-500" />
                                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Paid Sales</p>
                                                                </div>
                                                                <p className="text-lg font-bold text-green-600">PKR {totalPaid.toLocaleString()}</p>
                                                                <p className="text-xs text-muted-foreground">{paidSales.length} orders</p>
                                                            </div>
                                                            <div className="rounded-lg border bg-card p-3">
                                                                <div className="flex items-center gap-1.5 mb-1">
                                                                    <ArrowUpRight className="h-3.5 w-3.5 text-destructive" />
                                                                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Credit Sales</p>
                                                                </div>
                                                                <p className="text-lg font-bold text-destructive">PKR {totalCredit.toLocaleString()}</p>
                                                                <p className="text-xs text-muted-foreground">{creditSales.length} orders</p>
                                                            </div>
                                                        </div>

                                                        {/* Credit orders — selectable */}
                                                        {creditSales.length > 0 ? (
                                                            <>
                                                                <div className="rounded-xl border border-destructive/20 overflow-hidden">
                                                                    <div className="px-3 py-2 bg-destructive/5 border-b border-destructive/20 flex items-center justify-between">
                                                                        <p className="text-[10px] font-bold uppercase tracking-widest text-destructive">Unpaid / Credit Orders</p>
                                                                        <button
                                                                            className="text-[10px] text-primary font-semibold hover:underline"
                                                                            onClick={() => {
                                                                                if (selectedOrderIds.size === creditSales.length) {
                                                                                    setSelectedOrderIds(new Set());
                                                                                } else {
                                                                                    setSelectedOrderIds(new Set(creditSales.map(o => o.id)));
                                                                                }
                                                                            }}
                                                                        >
                                                                            {selectedOrderIds.size === creditSales.length ? "Deselect all" : "Select all"}
                                                                        </button>
                                                                    </div>
                                                                    <div className="divide-y divide-border/50">
                                                                        {creditSales.map(order => {
                                                                            const isSelected = selectedOrderIds.has(order.id);
                                                                            return (
                                                                                <button
                                                                                    key={order.id}
                                                                                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${isSelected ? "bg-primary/5" : "hover:bg-muted/30"}`}
                                                                                    onClick={() => {
                                                                                        setSelectedOrderIds(prev => {
                                                                                            const next = new Set(prev);
                                                                                            if (next.has(order.id)) next.delete(order.id);
                                                                                            else next.add(order.id);
                                                                                            return next;
                                                                                        });
                                                                                    }}
                                                                                >
                                                                                    {/* Checkbox */}
                                                                                    <div className={`h-4 w-4 rounded border flex-none flex items-center justify-center transition-colors ${isSelected ? "bg-primary border-primary" : "border-border"}`}>
                                                                                        {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                                                                                    </div>
                                                                                    <div className="flex-1 min-w-0">
                                                                                        <p className="font-mono text-xs font-bold">{order.orderNumber}</p>
                                                                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                                                                                            {order.locationName && <><Store className="h-2.5 w-2.5" />{order.locationName} · </>}
                                                                                            <Calendar className="h-2.5 w-2.5" />
                                                                                            {new Date(order.createdAt).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}
                                                                                        </div>
                                                                                    </div>
                                                                                    <span className="font-bold text-sm text-destructive flex-none">PKR {Number(order.grandTotal).toLocaleString()}</span>
                                                                                </button>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>

                                                                {/* Pay button — shows when orders selected */}
                                                                {selectedOrderIds.size > 0 && (
                                                                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-center justify-between gap-3">
                                                                        <div>
                                                                            <p className="text-xs font-bold">{selectedOrderIds.size} order{selectedOrderIds.size !== 1 ? "s" : ""} selected</p>
                                                                            <p className="text-lg font-bold text-primary">PKR {selectedTotal.toLocaleString()}</p>
                                                                        </div>
                                                                        <Button
                                                                            size="sm"
                                                                            className="gap-1.5 font-semibold"
                                                                            onClick={() => setIsPaymentOpen(true)}
                                                                        >
                                                                            <Wallet className="h-3.5 w-3.5" />
                                                                            Record Payment
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <div className="text-center py-8 text-muted-foreground">
                                                                <Check className="h-10 w-10 mx-auto mb-2 text-green-500/40" />
                                                                <p className="text-sm font-medium">No outstanding credit</p>
                                                                <p className="text-xs text-muted-foreground/60 mt-0.5">All purchases have been paid</p>
                                                            </div>
                                                        )}
                                                    </>
                                                );
                                            })()}
                                        </TabsContent>
                                    </Tabs>
                                ) : null}
                            </div>
                        </ScrollArea>
                    )}

                    <SheetFooter className="p-4 border-t flex-none">
                        <Button variant="outline" className="w-full" onClick={() => setIsSheetOpen(false)}>Close</Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            {/* Credit Payment Dialog */}
            <Dialog open={isPaymentOpen} onOpenChange={(open) => {
                if (!open) { setCardLast4(""); setSlipRef(""); setPaymentNotes(""); setPaymentMethod("cash"); }
                setIsPaymentOpen(open);
            }}>
                <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Wallet className="h-5 w-5 text-primary" />
                            Record Credit Payment
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        {/* Amount summary */}
                        <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 text-center">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Amount to Collect</p>
                            <p className="text-3xl font-bold text-primary">
                                PKR {customerDetail?.posSales
                                    .filter(o => selectedOrderIds.has(o.id))
                                    .reduce((s, o) => s + Number(o.grandTotal), 0)
                                    .toLocaleString()}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {selectedOrderIds.size} order{selectedOrderIds.size !== 1 ? "s" : ""} · {selected?.name}
                            </p>
                        </div>

                        {/* Tender type */}
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Tender Type</Label>
                            <Select value={paymentMethod} onValueChange={(v) => { setPaymentMethod(v); setCardLast4(""); setSlipRef(""); }}>
                                <SelectTrigger className="mt-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {[
                                        { value: "cash", label: "Cash", icon: Banknote },
                                        { value: "card", label: "Card", icon: CreditCard },
                                        { value: "bank_transfer", label: "Bank Transfer", icon: Building2 },
                                        { value: "voucher", label: "Voucher", icon: Ticket },
                                    ].map(({ value, label, icon: Icon }) => (
                                        <SelectItem key={value} value={value}>
                                            <div className="flex items-center gap-2">
                                                <Icon className="h-3.5 w-3.5" /> {label}
                                            </div>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Card / bank transfer extra fields */}
                        {(paymentMethod === "card" || paymentMethod === "bank_transfer") && (
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">Card # (last 4)</Label>
                                    <Input
                                        className="h-8 text-xs font-mono"
                                        maxLength={4}
                                        placeholder="••••"
                                        value={cardLast4}
                                        onChange={e => setCardLast4(e.target.value.replace(/\D/g, ""))}
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">Slip / Ref #</Label>
                                    <Input
                                        className="h-8 text-xs"
                                        placeholder="Ref"
                                        value={slipRef}
                                        onChange={e => setSlipRef(e.target.value)}
                                    />
                                </div>
                            </div>
                        )}

                      

                        {/* Notes */}
                        <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Notes (optional)</Label>
                            <Textarea
                                placeholder="e.g. Received via bank transfer ref #12345"
                                value={paymentNotes}
                                onChange={e => setPaymentNotes(e.target.value)}
                                className="resize-none h-16 text-sm"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsPaymentOpen(false)} disabled={isProcessingPayment}>
                            Cancel
                        </Button>
                        <Button onClick={handlePayCredit} disabled={isProcessingPayment} className="gap-2 min-w-[130px]">
                            {isProcessingPayment
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <Check className="h-4 w-4" />
                            }
                            Confirm Payment
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create / Edit Dialog */}
            <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <UserPlus className="h-5 w-5 text-primary" />
                            {editingId ? "Edit Customer" : "New Customer"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                    Code <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    placeholder="e.g. CUST-001"
                                    value={form.code}
                                    onChange={(e) => setForm(f => ({ ...f, code: e.target.value }))}
                                    className="bg-muted/30"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                    Name <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    placeholder="Full name"
                                    value={form.name}
                                    onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                                    className="bg-muted/30"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Phone</Label>
                            <Input
                                placeholder="03xx-xxxxxxx"
                                value={form.contactNo}
                                onChange={(e) => setForm(f => ({ ...f, contactNo: e.target.value }))}
                                className="bg-muted/30"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Address</Label>
                            <Input
                                placeholder="Street, City"
                                value={form.address}
                                onChange={(e) => setForm(f => ({ ...f, address: e.target.value }))}
                                className="bg-muted/30"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsFormOpen(false)} disabled={isSaving}>Cancel</Button>
                        <Button onClick={handleSave} disabled={isSaving} className="gap-2 min-w-[100px]">
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            {editingId ? "Update" : "Create"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
