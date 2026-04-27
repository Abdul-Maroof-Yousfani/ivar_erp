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
    Banknote, CreditCard, Building2, Ticket, BookOpen,
} from "lucide-react";

import DataTable from "@/components/common/data-table";
import { DateRangePicker, DateRange } from "@/components/ui/date-range-picker";
import { PrintReceipt } from "@/components/pos/print-receipt";
import { PrintReturnReceipt } from "@/components/pos/print-return-receipt";
import { cn } from "@/lib/utils";
import { authFetch } from "@/lib/auth";
import { useAuth } from "@/components/providers/auth-provider";
import { PermissionGuard } from "@/components/auth/permission-guard";

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
                    {/* Grand total reference */}
                    <div className="flex justify-between text-sm bg-muted/40 rounded-lg px-3 py-2">
                        <span className="text-muted-foreground">Order Total</span>
                        <span className="font-bold">Rs. {fmtCurrency(grandTotal)}</span>
                    </div>

                    {/* Existing tenders */}
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

                    {/* Add tender row */}
                    <div className="space-y-2 border rounded-lg p-3">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Add Payment</Label>
                        <div className="flex gap-2">
                            <Select value={method} onValueChange={setMethod}>
                                <SelectTrigger className="flex-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {TENDER_OPTIONS.map(({ value, label }) => (
                                        <SelectItem key={value} value={value}>{label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Input
                                type="number" min={0} className="w-28 font-mono"
                                placeholder="Amount"
                                value={amount || ""}
                                onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                                onKeyDown={e => e.key === "Enter" && addTender()}
                            />
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

                    {/* Balance summary */}
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

export default function SalesHistoryPage() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const { hasPermission } = useAuth();
    const canPrint = hasPermission('pos.sales.history.print');
    const canUpdateTender = hasPermission('pos.sales.history.update-tender');
    const canResumeHold = hasPermission('pos.hold.resume');
    const [orders, setOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [rowCount, setRowCount] = useState(0);
    const [pageCount, setPageCount] = useState(0);

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

    const fetchOrders = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await authFetch("/pos-sales/orders", {
                params: {
                    page: pagination.pageIndex + 1,
                    limit: pagination.pageSize,
                    search: search.trim() || undefined,
                    startDate: dateRange.from?.toISOString(),
                    endDate: dateRange.to?.toISOString(),
                }
            });
            if (res.ok && res.data?.status) {
                // Filter out expired hold orders — they're noise in the history view
                const filtered = (res.data.data || []).filter((o: any) => o.status !== 'hold_expired');
                setOrders(filtered);
                setRowCount(res.data.meta?.total || 0);
                setPageCount(res.data.meta?.totalPages || 0);
            }
        } catch { toast.error("Failed to load sales history"); }
        finally { setIsLoading(false); }
    }, [pagination.pageIndex, pagination.pageSize, search, dateRange]);

    useEffect(() => { setPagination(p => ({ ...p, pageIndex: 0 })); }, [search, dateRange]);
    useEffect(() => { fetchOrders(); }, [fetchOrders]);

    // Resume a hold order into new-sale
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
                return (
                    <Badge variant="outline" className={cn("capitalize text-[10px] px-1.5 py-0 h-5", STATUS_BADGE[status] ?? "")}>
                        {status === "hold" && <PauseCircle className="h-2.5 w-2.5 mr-1" />}
                        {status.replace(/_/g, " ")}
                    </Badge>
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
                        {/* Resume hold */}
                        {isHold && canResumeHold && (
                            <Button variant="ghost" size="icon"
                                className="h-8 w-8 rounded-full text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                                title="Continue hold order"
                                onClick={() => handleResumeHold(order)}>
                                <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                        )}
                        {/* Update tender */}
                        {canEditTender && canUpdateTender && (
                            <Button variant="ghost" size="icon"
                                className="h-8 w-8 rounded-full text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-950/30"
                                title="Update tender / payment"
                                onClick={() => { setSelectedOrder(order); setShowUpdateTender(true); }}>
                                <Pencil className="h-3.5 w-3.5" />
                            </Button>
                        )}
                        {/* View details */}
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
                        {/* Print */}
                        {!isHold && canPrint && (<>
                            <Button variant="ghost" size="icon"
                                className="h-8 w-8 rounded-full text-primary hover:bg-primary/5"
                                title="Print receipt"
                                onClick={() => { setSelectedOrder(order); setShowPrint(true); }}>
                                <Printer className="h-3.5 w-3.5" />
                            </Button>
                            {/* Gift receipt button - only show if order was marked as gift receipt */}
                            {order.isGiftReceipt && (
                                <Button variant="ghost" size="icon"
                                    className="h-8 w-8 rounded-full text-pink-600 hover:bg-pink-50 dark:hover:bg-pink-950/30"
                                    title="Print gift receipt (no prices)"
                                    onClick={() => { setSelectedOrder(order); setShowGiftPrint(true); }}>
                                    <Printer className="h-3.5 w-3.5" />
                                </Button>
                            )}
                            {(order.status === 'returned' || order.status === 'partially_returned') && (
                                <Button variant="ghost" size="icon"
                                    className="h-8 w-8 rounded-full text-destructive hover:bg-destructive/5"
                                    title="Print return slip"
                                    onClick={async () => {
                                        setSelectedOrder(order);
                                        setReturnDetails(null);
                                        const res = await authFetch(`/pos-sales/orders/${order.id}/return-details`);
                                        if (res.ok && res.data?.status) setReturnDetails(res.data.data);
                                        setShowReturnPrint(true);
                                    }}>
                                    <RotateCcw className="h-3.5 w-3.5" />
                                </Button>
                            )}
                            </>
                        )}
                    </div>
                );
            },
        },
    ], [handleResumeHold]);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-6 px-10">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Sales History</h1>
                    <p className="text-slate-400 text-sm">Manage and view all POS transactions.</p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="w-75">
                        <DateRangePicker
                            onUpdate={(values) => setDateRange(values.range)}
                            initialDateFrom={dateRange.from}
                            initialDateTo={dateRange.to}
                            placeholder="Filter by date"
                        />
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => {
                            startTransition(() => {
                                addTransitionType("nav-forward");
                                router.push("/pos/new-sale?showHolds=1");
                            });
                        }}
                        className="gap-2 border-amber-300 text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                    >
                        <PauseCircle className="h-4 w-4" />
                        Hold Orders
                        {orders.filter(o => o.status === 'hold').length > 0 && (
                            <Badge className="bg-amber-500 text-white text-[10px] px-1.5 py-0 h-4 ml-0.5">
                                {orders.filter(o => o.status === 'hold').length}
                            </Badge>
                        )}
                    </Button>
                    <Button onClick={() => {
                        startTransition(() => {
                            addTransitionType("nav-forward");
                            router.push("/pos/new-sale");
                        });
                    }}>
                        <ShoppingCart className="h-4 w-4" /> New Sale
                    </Button>
                </div>
            </div>

            {/* Table */}
            <div className="flex-1 p-6 px-10 overflow-hidden">
                <div id="pos-sales-history-card">
                    <DataTable
                        columns={columns}
                        data={orders}
                        isLoading={isLoading}
                        manualPagination={true}
                        rowCount={rowCount}
                        pageCount={pageCount}
                        onPaginationChange={setPagination}
                        searchFields={[{ key: "orderNumber", label: "Order #" }]}
                        onSearchChange={setSearch}
                        tableId="pos-sales-history"
                    />
                </div>
            </div>

            {/* Order Details Modal */}
            <Dialog open={showDetails} onOpenChange={setShowDetails}>
                <DialogContent showCloseButton={false} className="max-w-[1400px] max-h-[90vh] flex flex-col p-0 w-[98vw]">
                    {(() => {
                        const totalPaid = selectedOrder?.tenders?.reduce((s: number, t: any) => s + Number(t.amount), 0) || 0;
                        const balanceDue = Math.max(0, (selectedOrder?.grandTotal || 0) - totalPaid);
                        const isHold = selectedOrder?.status === "hold";
                        const isToday = selectedOrder ? isSameDay(new Date(selectedOrder.createdAt)) : false;
                        const canEditTender = isToday && selectedOrder?.status !== "voided" && !isHold;

                        return (
                            <>
                                <DialogHeader className="p-6 pb-2 shrink-0">
                                    <div className="flex items-center justify-between">
                                        <DialogTitle className="flex items-center gap-2 text-xl font-black uppercase tracking-tight">
                                            Order Details
                                            <Badge variant="outline" className="font-mono text-[10px] font-normal border-primary/20 text-primary">
                                                {selectedOrder?.orderNumber}
                                            </Badge>
                                        </DialogTitle>
                                        <div className="flex items-center gap-2">
                                            {isHold && (
                                                <Badge variant="outline" className="uppercase text-[10px] px-2 h-5 border-amber-400 text-amber-600">
                                                    <PauseCircle className="h-2.5 w-2.5 mr-1" /> On Hold
                                                </Badge>
                                            )}
                                            {!isHold && (
                                                <Badge variant={balanceDue > 0 ? "outline" : "default"}
                                                    className={cn("uppercase text-[10px] px-2 h-5", balanceDue > 0 ? "border-orange-500 text-orange-500" : "bg-emerald-600")}>
                                                    {balanceDue > 0 ? "Partial" : "Fully Paid"}
                                                </Badge>
                                            )}
                                            <Badge variant={selectedOrder?.status === "completed" ? "default" : "secondary"}
                                                className={cn("uppercase text-[10px] px-2 h-5", STATUS_BADGE[selectedOrder?.status] ?? "")}>
                                                {selectedOrder?.status?.replace(/_/g, " ")}
                                            </Badge>
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-muted-foreground mt-1 font-medium">
                                        Placed on {selectedOrder && new Date(selectedOrder.createdAt).toLocaleString()}
                                    </p>
                                </DialogHeader>

                                <Separator className="opacity-50 shrink-0" />

                                <ScrollArea className="flex-1 max-h-[calc(90vh-200px)]">
                                    <div className="px-6 py-6 space-y-6">{/* Hold notice */}
                                    {isHold && (
                                        <div className="flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/20 px-4 py-3">
                                            <Clock className="h-5 w-5 text-amber-600 shrink-0" />
                                            <div className="flex-1 text-sm">
                                                <p className="font-semibold text-amber-700">Order is on hold</p>
                                                <p className="text-amber-600 text-xs">
                                                    Expires: {selectedOrder?.holdExpiresAt
                                                        ? new Date(selectedOrder.holdExpiresAt).toLocaleTimeString()
                                                        : "at midnight"}
                                                </p>
                                            </div>
                                            <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
                                                onClick={() => { setShowDetails(false); handleResumeHold(selectedOrder); }}
                                                disabled={!canResumeHold}>
                                                <RotateCcw className="h-3.5 w-3.5" /> Continue Order
                                            </Button>
                                        </div>
                                    )}

                                    {/* Summary Grid */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        <div className="bg-muted/50 px-4 py-3 rounded-xl border border-border/50">
                                            <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1.5">Subtotal</p>
                                            <p className="text-sm font-black tracking-tight">Rs. {fmtCurrency(selectedOrder?.subtotal || 0)}</p>
                                        </div>
                                        <div className="bg-primary/5 px-4 py-3 rounded-xl border border-primary/20">
                                            <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-1.5">Discount</p>
                                            <p className="text-sm font-black tracking-tight text-primary">Rs. {fmtCurrency(selectedOrder?.discountAmount || 0)}</p>
                                        </div>
                                        <div className="bg-primary px-4 py-3 rounded-xl shadow-lg shadow-primary/20">
                                            <p className="text-[9px] font-black text-primary-foreground/70 uppercase tracking-widest mb-1.5">Grand Total</p>
                                            <p className="text-sm font-black tracking-tight text-primary-foreground">Rs. {fmtCurrency(selectedOrder?.grandTotal || 0)}</p>
                                        </div>
                                        {!isHold && (
                                            <div className={cn("px-4 py-3 rounded-xl border shadow-lg",
                                                balanceDue > 0 ? "bg-orange-500/10 border-orange-500/30 text-orange-600" : "bg-emerald-500/10 border-emerald-500/30 text-emerald-600")}>
                                                <p className="text-[9px] font-black uppercase tracking-widest mb-1.5 opacity-80">{balanceDue > 0 ? "Balance Due" : "Settled"}</p>
                                                <p className="text-sm font-black tracking-tight">Rs. {fmtCurrency(balanceDue)}</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Discount badges */}
                                    {(selectedOrder?.promo || selectedOrder?.coupon || selectedOrder?.alliance || selectedOrder?.notes) && (
                                        <div className="bg-muted/30 rounded-2xl p-4 border border-border/40 space-y-3">
                                            <div className="flex flex-wrap gap-2">
                                                {selectedOrder?.promo && (
                                                    <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 gap-1.5 py-1 px-3 rounded-lg">
                                                        <ShoppingCart className="h-3 w-3" />
                                                        Promo: <span className="font-black">{selectedOrder.promo.name || selectedOrder.promo.code}</span>
                                                    </Badge>
                                                )}
                                                {selectedOrder?.coupon && (
                                                    <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-500/20 gap-1.5 py-1 px-3 rounded-lg">
                                                        <BadgeDollarSign className="h-3 w-3" />
                                                        Coupon: <span className="font-black">{selectedOrder.coupon.code}</span>
                                                    </Badge>
                                                )}
                                                {selectedOrder?.alliance && (
                                                    <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 gap-1.5 py-1 px-3 rounded-lg">
                                                        <CalendarIcon className="h-3 w-3" />
                                                        Alliance: <span className="font-black">{selectedOrder.alliance.partnerName}</span>
                                                    </Badge>
                                                )}
                                            </div>
                                            {selectedOrder?.notes && (
                                                <div className="text-[11px] text-muted-foreground bg-background/50 p-2.5 rounded-xl border border-border/30 italic">
                                                    "{selectedOrder.notes}"
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Items */}
                                    <div className="space-y-3">
                                        <h3 className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2 text-foreground/70">
                                            <ShoppingCart className="h-4 w-4 text-muted-foreground" /> Items Breakdown
                                        </h3>
                                        <div className="rounded-2xl border border-border/60 overflow-x-auto shadow-sm bg-background">
                                            <Table className="min-w-full">
                                                <TableHeader className="bg-muted/40 hover:bg-muted/40 border-b border-border/40">
                                                    <TableRow className="h-10 hover:bg-transparent">
                                                        <TableHead className="text-[10px] font-bold uppercase text-muted-foreground px-4 min-w-[250px]">Item</TableHead>
                                                        <TableHead className="text-center text-[10px] font-bold uppercase text-muted-foreground w-20">Qty</TableHead>
                                                        {(selectedOrder?.status === 'returned' || selectedOrder?.status === 'partially_returned') && (
                                                            <>
                                                                <TableHead className="text-center text-[10px] font-bold uppercase text-destructive w-20">Ret</TableHead>
                                                                <TableHead className="text-center text-[10px] font-bold uppercase text-emerald-600 w-20">Rem</TableHead>
                                                            </>
                                                        )}
                                                        <TableHead className="text-right text-[10px] font-bold uppercase text-muted-foreground w-32">Price</TableHead>
                                                        <TableHead className="text-right text-[10px] font-bold uppercase text-muted-foreground w-28">Disc</TableHead>
                                                        <TableHead className="text-right text-[10px] font-bold uppercase text-muted-foreground pr-4 w-32">Total</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {selectedOrder?.items?.map((item: any, i: number) => {
                                                        const orderedQty = Number(item.quantity);
                                                        const returnedQty = Number(item.returnedQty || 0);
                                                        const remainingQty = orderedQty - returnedQty;
                                                        const isFullyReturned = remainingQty === 0;
                                                        const isPartiallyReturned = returnedQty > 0 && remainingQty > 0;

                                                        return (
                                                            <TableRow key={i} className={cn(
                                                                "hover:bg-muted/10 border-border/30 group",
                                                                isFullyReturned && "bg-destructive/5"
                                                            )}>
                                                                <TableCell className="px-4 py-3">
                                                                    <div className="flex items-start gap-2">
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="font-black text-xs leading-tight group-hover:text-primary transition-colors">
                                                                                {item.item?.description}
                                                                            </p>
                                                                            <p className="text-[9px] text-muted-foreground font-mono mt-0.5">
                                                                                {item.item?.sku}
                                                                            </p>
                                                                        </div>
                                                                        {isPartiallyReturned && (
                                                                            <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 bg-amber-500/10 text-amber-600 border-amber-500/30 shrink-0">
                                                                                Partial
                                                                            </Badge>
                                                                        )}
                                                                        {isFullyReturned && (
                                                                            <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 bg-destructive/10 text-destructive border-destructive/30 shrink-0">
                                                                                Returned
                                                                            </Badge>
                                                                        )}
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-center">
                                                                    <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-muted/50">{orderedQty}</span>
                                                                </TableCell>
                                                                {(selectedOrder?.status === 'returned' || selectedOrder?.status === 'partially_returned') && (
                                                                    <>
                                                                        <TableCell className="text-center">
                                                                            {returnedQty > 0 ? (
                                                                                <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-destructive/10 text-destructive">{returnedQty}</span>
                                                                            ) : (
                                                                                <span className="text-muted-foreground text-xs">—</span>
                                                                            )}
                                                                        </TableCell>
                                                                        <TableCell className="text-center">
                                                                            {remainingQty > 0 ? (
                                                                                <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/10 text-emerald-600">{remainingQty}</span>
                                                                            ) : (
                                                                                <span className="text-muted-foreground text-xs">—</span>
                                                                            )}
                                                                        </TableCell>
                                                                    </>
                                                                )}
                                                                <TableCell className="text-right text-xs font-mono text-muted-foreground/80">
                                                                    {fmtCurrency(item.unitPrice)}
                                                                </TableCell>
                                                                <TableCell className="text-right text-xs font-mono text-destructive">
                                                                    {Number(item.discountAmount) > 0 ? `-${fmtCurrency(item.discountAmount)}` : "—"}
                                                                </TableCell>
                                                                <TableCell className="text-right font-bold text-xs font-mono pr-4">
                                                                    {fmtCurrency(item.lineTotal ?? (item.unitPrice - (item.discountAmount || 0)) * item.quantity)}
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>

                                    {/* Payment */}
                                    {!isHold && (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-[11px] font-black uppercase tracking-widest flex items-center gap-2 text-foreground/70">
                                                    <BadgeDollarSign className="h-4 w-4 text-muted-foreground" /> Payment Information
                                                </h3>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black uppercase text-muted-foreground px-3 py-1 bg-muted/50 rounded-lg">
                                                        Total Paid: <span className="text-foreground ml-1">Rs. {fmtCurrency(totalPaid)}</span>
                                                    </span>
                                                    {canEditTender && (
                                                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
                                                            onClick={() => { setShowDetails(false); setShowUpdateTender(true); }}>
                                                            <Pencil className="h-3 w-3" /> Edit
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                {selectedOrder?.tenders?.map((t: any, i: number) => (
                                                    <div key={i} className="flex items-center justify-between px-4 py-3 rounded-2xl border border-border/80 bg-secondary/5 shadow-sm">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="p-1.5 bg-background border border-border/40 rounded-lg shadow-sm">
                                                                <BadgeDollarSign className="h-3.5 w-3.5 text-primary" />
                                                            </div>
                                                            <div>
                                                                <p className="text-[9px] font-black text-muted-foreground uppercase leading-none mb-1">Method</p>
                                                                <p className="text-[11px] font-black capitalize leading-none">{t.method.replace("_", " ")}</p>
                                                            </div>
                                                            {t.cardLast4 && <span className="text-[9px] font-mono font-black text-primary ml-1 ring-1 ring-primary/20 px-1.5 py-0.5 rounded-md bg-primary/5">••••{t.cardLast4}</span>}
                                                            {t.slipNo && <span className="text-[9px] font-mono font-black text-muted-foreground ml-1 ring-1 ring-border px-1.5 py-0.5 rounded-md bg-muted/30">{t.method === "voucher" ? `#${t.slipNo}` : t.slipNo}</span>}
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="text-[9px] font-black text-muted-foreground uppercase leading-none mb-1">Paid</p>
                                                            <p className="text-[12px] font-black font-mono">Rs. {fmtCurrency(t.amount)}</p>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                </ScrollArea>

                                <Separator className="opacity-50 shrink-0" />

                                <DialogFooter className="p-4 bg-muted/20 shrink-0">
                                    <Button variant="ghost" onClick={() => setShowDetails(false)}
                                        className="rounded-xl font-black text-[10px] uppercase hover:bg-muted/80 tracking-widest px-6 h-11">
                                        Close
                                    </Button>
                                    {isHold ? (
                                        <Button className="rounded-xl font-black text-[10px] uppercase px-8 h-11 gap-2.5 tracking-widest bg-amber-600 hover:bg-amber-700"
                                            onClick={() => { setShowDetails(false); handleResumeHold(selectedOrder); }}>
                                            <RotateCcw className="h-4 w-4" /> Continue Order
                                        </Button>
                                    ) : (
                                        <>
                                        {/* Gift receipt button - only show if order was marked as gift receipt */}
                                        {selectedOrder?.isGiftReceipt && (
                                            <Button variant="outline" className="rounded-xl font-black text-[10px] uppercase px-8 h-11 gap-2.5 tracking-widest border-pink-300 text-pink-600 hover:bg-pink-50"
                                                onClick={() => { setShowDetails(false); setShowGiftPrint(true); }}>
                                                <Printer className="h-4 w-4" /> Gift Receipt
                                            </Button>
                                        )}
                                        <Button className="rounded-xl font-black text-[10px] uppercase px-8 h-11 shadow-lg shadow-primary/30 gap-2.5 tracking-widest"
                                            onClick={() => { setShowDetails(false); setShowPrint(true); }}>
                                            <Printer className="h-4 w-4" /> Print Receipt
                                        </Button>
                                        </>
                                    )}
                                </DialogFooter>
                            </>
                        );
                    })()}
                </DialogContent>
            </Dialog>

            {/* Print Receipt */}
            {showPrint && selectedOrder && (
                <PrintReceipt
                    order={{ ...selectedOrder, isGiftReceipt: false }}
                    tenders={selectedOrder.tenders || []}
                    onClose={() => setShowPrint(false)}
                />
            )}

            {/* Print Gift Receipt */}
            {showGiftPrint && selectedOrder && (
                <PrintReceipt
                    order={{ ...selectedOrder, isGiftReceipt: true }}
                    tenders={selectedOrder.tenders || []}
                    onClose={() => setShowGiftPrint(false)}
                />
            )}

            {/* Update Tender Modal */}
            {showUpdateTender && selectedOrder && (
                <UpdateTenderModal
                    order={selectedOrder}
                    open={showUpdateTender}
                    onOpenChange={setShowUpdateTender}
                    onSuccess={fetchOrders}
                />
            )}

            {/* Print Return Receipt */}
            {showReturnPrint && selectedOrder && returnDetails && (
                <PrintReturnReceipt
                    returnRef={selectedOrder.orderNumber}
                    originalOrders={[{ orderNumber: selectedOrder.orderNumber, grandTotal: Number(selectedOrder.grandTotal) }]}
                    returnedLines={returnDetails.items.map((item: any) => ({
                        name: item.item?.description || "Unknown Item",
                        sku: item.item?.sku || "-",
                        brand: item.item?.brand?.name,
                        returnQty: item.returnableQty || item.quantity,
                        paidPerUnit: Number(item.originalPaidPerUnit || item.unitPrice),
                        refundAmount: Number(item.refundAmount || 0),
                        orderNumber: selectedOrder.orderNumber,
                        unitPrice: Number(item.unitPrice || 0),
                        discountAmount: Number(item.discountAmount || 0),
                        discountPercent: Number(item.discountPercent || 0),
                        taxAmount: Number(item.taxAmount || 0),
                        taxPercent: Number(item.taxPercent || 0),
                        refundPerUnit: Number(item.refundPerUnit || item.unitPrice),
                        priceAdjusted: item.priceAdjusted || false,
                        originalPaidPerUnit: Number(item.originalPaidPerUnit || item.unitPrice),
                        couponDeduction: Number(item.couponDeduction || 0),
                    }))}
                    refundTotal={returnDetails.items.reduce((sum: number, item: any) => sum + Number(item.refundAmount || 0), 0)}
                    notes={returnDetails.reason}
                    discountNotes={returnDetails.discountNotes}
                    returnedAt={returnDetails.returnedAt}
                    paymentMethod={selectedOrder.paymentMethod}
                    onClose={() => setShowReturnPrint(false)}
                />
            )}
        </div>
    );
}
