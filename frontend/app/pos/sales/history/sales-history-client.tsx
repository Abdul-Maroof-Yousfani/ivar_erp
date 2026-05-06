
"use client";

import { useState, useEffect, useCallback, useMemo, useTransition, startTransition, addTransitionType } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ColumnDef, PaginationState } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Printer, Eye, ShoppingCart, BadgeDollarSign, Calendar as CalendarIcon,
    PauseCircle, RotateCcw, Clock, Pencil, Plus, Trash2, Loader2,
    Banknote, CreditCard, Building2, Ticket, BookOpen, AlertCircle, CheckCircle, XCircle,
} from "lucide-react";

import DataTable from "@/components/common/data-table";
import { DateRangePicker, DateRange } from "@/components/ui/date-range-picker";
import { PrintReceipt } from "@/components/pos/print-receipt";
import { PrintReturnReceipt } from "@/components/pos/print-return-receipt";
import { cn } from "@/lib/utils";
import { authFetch } from "@/lib/auth";
import { useAuth } from "@/components/providers/auth-provider";
import type { SalesOrder } from "@/lib/actions/pos-sales";
import { listSalesOrders } from "@/lib/actions/pos-sales";

function fmtCurrency(val: number) {
    return val.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function isSameDay(date: Date) {
    const now = new Date();
    return date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate();
}

const TENDER_OPTIONS = [
    { value: "cash", label: "Cash", icon: Banknote },
    { value: "card", label: "Card", icon: CreditCard },
    { value: "bank_transfer", label: "Bank Transfer", icon: Building2 },
    { value: "voucher", label: "Voucher", icon: Ticket },
    { value: "credit_account", label: "Credit Account", icon: BookOpen },
];

interface Tender { method: string; amount: number; cardLast4?: string; slipNo?: string; }

// ─── Update Tender Modal ──────────────────────────────────────────────────
function UpdateTenderModal({ order, open, onOpenChange, onSuccess }: {
    order: any; open: boolean; onOpenChange: (v: boolean) => void; onSuccess: () => void;
}) {
    const [tenders, setTenders] = useState<Tender[]>([]);
    const [method, setMethod] = useState("cash");
    const [amount, setAmount] = useState<number>(0);
    const [cardLast4, setCardLast4] = useState("");
    const [slipNo, setSlipNo] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (open && order) setTenders(order.tenders ?? []);
    }, [open, order]);

    const grandTotal = Number(order?.grandTotal ?? 0);
    const totalPaid = tenders.reduce((s, t) => s + t.amount, 0);
    const balanceDue = Math.max(0, grandTotal - totalPaid);
    const changeAmount = Math.max(0, totalPaid - grandTotal);

    const addTender = () => {
        if (!amount || amount <= 0) return;
        setTenders(prev => [...prev, { method, amount, cardLast4: cardLast4 || undefined, slipNo: slipNo || undefined }]);
        setAmount(0); setCardLast4(""); setSlipNo("");
    };

    const handleSave = async () => {
        if (tenders.length === 0) { toast.error("Add at least one tender"); return; }
        setIsSaving(true);
        try {
            const res = await authFetch(`/pos-sales/orders/${order.id}/update-tender`, {
                method: "POST", body: { tenders },
            });
            if (res.ok && res.data?.status) {
                toast.success("Tender updated successfully");
                onSuccess();
                onOpenChange(false);
            } else {
                toast.error(res.data?.message || "Failed to update tender");
            }
        } catch { toast.error("Failed to update tender"); }
        finally { setIsSaving(false); }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Pencil className="h-4 w-4" /> Update Tender
                        <Badge variant="outline" className="font-mono text-xs">{order?.orderNumber}</Badge>
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="flex justify-between text-sm bg-muted/40 rounded-lg px-3 py-2">
                        <span className="text-muted-foreground">Order Total</span>
                        <span className="font-bold">Rs. {fmtCurrency(grandTotal)}</span>
                    </div>

                    {tenders.length > 0 && (
                        <div className="space-y-1.5">
                            {tenders.map((t, i) => {
                                const Icon = TENDER_OPTIONS.find(o => o.value === t.method)?.icon ?? Banknote;
                                return (
                                    <div key={i} className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2 text-sm">
                                        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                        <span className="capitalize flex-1">{t.method.replace("_", " ")}
                                            {t.cardLast4 && <span className="font-mono text-xs text-muted-foreground ml-1">••{t.cardLast4}</span>}
                                            {t.slipNo && <span className="font-mono text-xs text-muted-foreground ml-1">#{t.slipNo}</span>}
                                        </span>
                                        <span className="font-mono font-semibold">Rs. {fmtCurrency(t.amount)}</span>
                                        <button onClick={() => setTenders(prev => prev.filter((_, j) => j !== i))}
                                            className="text-muted-foreground hover:text-destructive transition-colors ml-1">
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <div className="space-y-2 border rounded-lg p-3">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Add Payment</Label>
                        <div className="flex gap-2">
                            <Select value={method} onValueChange={setMethod}>
                                <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {TENDER_OPTIONS.map(({ value, label }) => (
                                        <SelectItem key={value} value={value}>{label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Input type="number" min={0} className="w-28 font-mono" placeholder="Amount"
                                value={amount || ""}
                                onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                                onKeyDown={e => e.key === "Enter" && addTender()} />
                        </div>
                        {(method === "card" || method === "bank_transfer" || method === "voucher") && (
                            <div className="grid grid-cols-2 gap-2">
                                {method !== "voucher" && (
                                    <Input className="h-8 text-xs font-mono" maxLength={4} placeholder="Card last 4"
                                        value={cardLast4} onChange={e => setCardLast4(e.target.value.replace(/\D/, ""))} />
                                )}
                                <Input className={`h-8 text-xs ${method === "voucher" ? "col-span-2" : ""}`}
                                    placeholder={method === "voucher" ? "Voucher number" : "Slip / Ref #"}
                                    value={slipNo} onChange={e => setSlipNo(e.target.value)} />
                            </div>
                        )}
                        <Button size="sm" className="w-full gap-1.5" onClick={addTender} disabled={!amount || amount <= 0}>
                            <Plus className="h-3.5 w-3.5" /> Add
                        </Button>
                    </div>

                    <div className={cn("flex justify-between rounded-lg px-3 py-2 text-sm font-semibold",
                        balanceDue <= 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive")}>
                        <span>{balanceDue <= 0 ? (changeAmount > 0 ? "Change" : "Fully Paid ✓") : "Balance Due"}</span>
                        <span className="font-mono">Rs. {fmtCurrency(balanceDue <= 0 && changeAmount > 0 ? changeAmount : balanceDue)}</span>
                    </div>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSaving}>Cancel</Button>
                    <Button onClick={handleSave} disabled={isSaving || tenders.length === 0}>
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Pencil className="h-4 w-4 mr-2" />}
                        Save Tender
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// --- Main Client Component ----------------------------------------------------

interface Props {
    initialOrders: SalesOrder[];
    initialTotal: number;
    initialTotalPages: number;
}

export function SalesHistoryClient({ initialOrders, initialTotal, initialTotalPages }: Props) {
    const router = useRouter();
    const [, startTransitionHook] = useTransition();
    const { hasPermission } = useAuth();
    const canPrint = hasPermission("pos.sales.history.print");
    const canUpdateTender = hasPermission("pos.sales.history.update-tender");
    const canResumeHold = hasPermission("pos.hold.resume");

    const [orders, setOrders] = useState<SalesOrder[]>(initialOrders);
    const [isLoading, setIsLoading] = useState(false);
    const [rowCount, setRowCount] = useState(initialTotal);
    const [pageCount, setPageCount] = useState(initialTotalPages);

    const [search, setSearch] = useState("");
    const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });
    const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 100 });

    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [returnDetails, setReturnDetails] = useState<any>(null);
    const [showDetails, setShowDetails] = useState(false);
    const [showPrint, setShowPrint] = useState(false);
    const [showGiftPrint, setShowGiftPrint] = useState(false);
    const [showReturnPrint, setShowReturnPrint] = useState(false);
    const [showUpdateTender, setShowUpdateTender] = useState(false);
    const [isLoadingReceipt, setIsLoadingReceipt] = useState(false);

    // Re-fetch when filters/pagination change (skip on first render � we have SSR data)
    const isFirstRender = useState(true);
    const fetchOrders = useCallback(async () => {
        setIsLoading(true);
        try {
            const result = await listSalesOrders({
                page: pagination.pageIndex + 1,
                limit: pagination.pageSize,
                search: search.trim() || undefined,
                startDate: dateRange.from?.toISOString(),
                endDate: dateRange.to?.toISOString(),
            });
            if (result.status) {
                setOrders(result.data);
                setRowCount(result.meta.total);
                setPageCount(result.meta.totalPages);
            } else {
                toast.error(result.message || "Failed to load sales history");
            }
        } catch {
            toast.error("Failed to load sales history");
        } finally {
            setIsLoading(false);
        }
    }, [pagination.pageIndex, pagination.pageSize, search, dateRange]);

    // Reset to page 0 when filters change
    useEffect(() => { setPagination(p => ({ ...p, pageIndex: 0 })); }, [search, dateRange]);

    // Fetch on pagination/filter change � but skip the very first render (SSR data is fresh)
    const [hasMounted, setHasMounted] = useState(false);
    useEffect(() => {
        if (!hasMounted) { setHasMounted(true); return; }
        fetchOrders();
    }, [fetchOrders]);

    // Debug: Log orders when they change
    useEffect(() => {
        console.log('📊 Orders updated:', {
            totalOrders: orders.length,
            ordersWithClaims: orders.filter(o => o.claims && o.claims.length > 0).length,
            firstOrder: orders[0] ? {
                orderNumber: orders[0].orderNumber,
                hasClaims: !!orders[0].claims,
                claimsCount: orders[0].claims?.length || 0,
                claims: orders[0].claims
            } : null
        });
    }, [orders]);

    // Open print dialog immediately with skeleton, fetch full order in background
    const openPrintDialog = useCallback(async (listOrder: any, mode: "sales" | "gift" | "return") => {
        setIsLoadingReceipt(true);
        if (mode === "sales") {
            setSelectedOrder({ ...listOrder, isGiftReceipt: false });
            setShowPrint(true);
        } else if (mode === "gift") {
            setSelectedOrder({ ...listOrder, isGiftReceipt: true });
            setShowGiftPrint(true);
        } else {
            setSelectedOrder(listOrder);
            setReturnDetails(null);
            setShowReturnPrint(true);
        }
        try {
            const res = await authFetch(`/pos-sales/orders/${listOrder.id}`);
            if (res.ok && res.data?.status) {
                const full = res.data.data;
                if (mode === "sales")  setSelectedOrder({ ...full, isGiftReceipt: false });
                if (mode === "gift")   setSelectedOrder({ ...full, isGiftReceipt: true });
                if (mode === "return") {
                    setSelectedOrder(full);
                    const retRes = await authFetch(`/pos-sales/orders/${listOrder.id}/return-details`);
                    if (retRes.ok && retRes.data?.status) setReturnDetails(retRes.data.data);
                }
            } else {
                toast.error("Failed to load order details");
            }
        } catch {
            toast.error("Failed to load order details");
        } finally {
            setIsLoadingReceipt(false);
        }
    }, []);

    const handleResumeHold = useCallback(async (order: any) => {
        try {
            const res = await authFetch(`/pos-sales/orders/${order.id}/resume`, { method: "POST" });
            if (res.ok && res.data?.status) {
                const resumed = res.data.data;
                const cartItems = resumed.items.map((oi: any) => ({
                    id: oi.itemId,
                    upc: oi.item?.barCode || oi.itemId || "-",
                    sku: oi.item?.sku || "-",
                    name: oi.item?.description || "Unknown Item",
                    brand: "-", size: "-", color: "-",
                    quantity: oi.quantity,
                    price: Number(oi.unitPrice),
                    discountPercent: Number(oi.discountPercent),
                    discountAmount: Number(oi.discountAmount),
                    taxPercent: Number(oi.taxPercent),
                    taxAmount: Number(oi.taxAmount),
                    total: Number(oi.lineTotal),
                    inStock: true, stockQty: 999,
                    isStockInTransit: oi.isStockInTransit || false,
                }));
                sessionStorage.setItem("pos_resume_cart", JSON.stringify(cartItems));
                toast.success(`Resuming ${resumed.orderNumber}`);
                startTransition(() => {
                    addTransitionType("nav-forward");
                    router.push("/pos/new-sale?resume=1");
                });
            } else {
                toast.error(res.data?.message || "Failed to resume hold");
            }
        } catch { toast.error("Failed to resume hold order"); }
    }, [router]);

    const STATUS_BADGE: Record<string, string> = {
        completed: "bg-emerald-500/10 text-emerald-700 border-emerald-300",
        hold: "bg-amber-500/10 text-amber-700 border-amber-300",
        hold_expired: "bg-muted text-muted-foreground border-border",
        voided: "bg-destructive/10 text-destructive border-destructive/30",
        partially_returned: "bg-blue-500/10 text-blue-700 border-blue-300",
        refunded: "bg-purple-500/10 text-purple-700 border-purple-300",
        exchanged: "bg-cyan-500/10 text-cyan-700 border-cyan-300",
    };

    const columns = useMemo<ColumnDef<any>[]>(() => [
        {
            accessorKey: "orderNumber",
            header: "Order #",
            cell: ({ row }) => (
                <span className="font-mono font-bold text-primary">{row.getValue("orderNumber")}</span>
            ),
        },
        {
            accessorKey: "createdAt",
            header: "Date & Time",
            cell: ({ row }) => {
                const date = new Date(row.getValue("createdAt"));
                return (
                    <div className="text-sm">
                        {date.toLocaleDateString()}
                        <div className="text-[10px] text-muted-foreground">
                            {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                    </div>
                );
            },
        },
        {
            id: "itemsCount",
            header: () => <div className="text-right">Items</div>,
            cell: ({ row }) => <div className="text-right">{row.original.items?.length || 0}</div>,
        },
        {
            accessorKey: "grandTotal",
            header: () => <div className="text-right">Total</div>,
            cell: ({ row }) => (
                <div className="text-right font-bold">Rs. {fmtCurrency(row.getValue("grandTotal"))}</div>
            ),
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => {
                const status = row.getValue("status") as string;
                const claims = row.original.claims || [];
                const hasClaims = claims.length > 0;
                
                // Debug log
                if (row.original.orderNumber === 'SO-20260506-0001') {
                    console.log('🔍 Order Debug:', {
                        orderNumber: row.original.orderNumber,
                        claims: row.original.claims,
                        hasClaims,
                        claimsLength: claims.length
                    });
                }
                
                // Determine claim status badge
                let claimBadge = null;
                if (hasClaims) {
                    const pendingClaims = claims.filter((c: any) => c.status === 'SUBMITTED' || c.status === 'UNDER_REVIEW');
                    const approvedClaims = claims.filter((c: any) => c.status === 'APPROVED' || c.status === 'PARTIALLY_APPROVED');
                    const rejectedClaims = claims.filter((c: any) => c.status === 'REJECTED');
                    
                    if (pendingClaims.length > 0) {
                        claimBadge = (
                            <Badge variant="outline" className="capitalize text-[10px] px-1.5 py-0 h-5 bg-amber-500/10 text-amber-700 border-amber-300 ml-1">
                                <AlertCircle className="h-2.5 w-2.5 mr-1" />
                                Claim Pending
                            </Badge>
                        );
                    } else if (approvedClaims.length > 0) {
                        claimBadge = (
                            <Badge variant="outline" className="capitalize text-[10px] px-1.5 py-0 h-5 bg-green-500/10 text-green-700 border-green-300 ml-1">
                                <CheckCircle className="h-2.5 w-2.5 mr-1" />
                                Claim Approved
                            </Badge>
                        );
                    } else if (rejectedClaims.length > 0) {
                        claimBadge = (
                            <Badge variant="outline" className="capitalize text-[10px] px-1.5 py-0 h-5 bg-red-500/10 text-red-700 border-red-300 ml-1">
                                <XCircle className="h-2.5 w-2.5 mr-1" />
                                Claim Rejected
                            </Badge>
                        );
                    }
                }
                
                return (
                    <div className="flex flex-col gap-1">
                        <Badge variant="outline" className={cn("capitalize text-[10px] px-1.5 py-0 h-5", STATUS_BADGE[status] ?? "")}>
                            {status === "hold" && <PauseCircle className="h-2.5 w-2.5 mr-1" />}
                            {status.replace(/_/g, " ")}
                        </Badge>
                        {claimBadge}
                    </div>
                );
            },
        },
        {
            id: "actions",
            header: () => <div className="text-right">Actions</div>,
            cell: ({ row }) => {
                const order = row.original;
                const isHold = order.status === "hold";
                const isToday = isSameDay(new Date(order.createdAt));
                const canEditTender = isToday && order.status !== "voided" && order.status !== "hold";
                return (
                    <div className="flex items-center justify-end gap-1">
                        {isHold && canResumeHold && (
                            <Button variant="ghost" size="icon"
                                className="h-8 w-8 rounded-full text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                title="Continue hold order"
                                onClick={() => handleResumeHold(order)}>
                                <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                        )}
                        {canEditTender && canUpdateTender && (
                            <Button variant="ghost" size="icon"
                                className="h-8 w-8 rounded-full text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/30"
                                title="Update tender / payment"
                                onClick={() => { setSelectedOrder(order); setShowUpdateTender(true); }}>
                                <Pencil className="h-3.5 w-3.5" />
                            </Button>
                        )}
                        <Button variant="ghost" size="icon"
                            className="h-8 w-8 rounded-full text-blue-600 hover:bg-blue-50"
                            title="View details"
                            onClick={() => {
                                startTransition(() => {
                                    addTransitionType("nav-forward");
                                    router.push(`/pos/sales/order-details/${order.id}`);
                                });
                            }}>
                            <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {!isHold && canPrint && (
                            <>
                                <Button variant="ghost" size="icon"
                                    className="h-8 w-8 rounded-full text-primary hover:bg-primary/5"
                                    title="Print receipt"
                                    onClick={() => openPrintDialog(order, "sales")}>
                                    <Printer className="h-3.5 w-3.5" />
                                </Button>
                                {order.isGiftReceipt && (
                                    <Button variant="ghost" size="icon"
                                        className="h-8 w-8 rounded-full text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-950/30"
                                        title="Print gift receipt"
                                        onClick={() => openPrintDialog(order, "gift")}>
                                        <Printer className="h-3.5 w-3.5" />
                                    </Button>
                                )}
                                {(order.status === "returned" || order.status === "partially_returned") && (
                                    <Button variant="ghost" size="icon"
                                        className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/5"
                                        title="Print return slip"
                                        onClick={() => openPrintDialog(order, "return")}>
                                        <RotateCcw className="h-3.5 w-3.5" />
                                    </Button>
                                )}
                                {order.claims && order.claims.length > 0 && (
                                    <Button variant="ghost" size="icon"
                                        className="h-8 w-8 rounded-full text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                                        title={`View claim (${order.claims[0].claimNumber})`}
                                        onClick={() => {
                                            startTransition(() => {
                                                addTransitionType("nav-forward");
                                                router.push(`/pos/sales/order-details/${order.id}#claims`);
                                            });
                                        }}>
                                        <AlertCircle className="h-3.5 w-3.5" />
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                );
            },
        },
    ], [handleResumeHold, canPrint, canUpdateTender, canResumeHold, openPrintDialog]);

