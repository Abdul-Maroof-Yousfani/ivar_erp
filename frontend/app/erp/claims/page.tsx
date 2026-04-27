"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
    Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ColumnDef } from "@tanstack/react-table";
import DataTable from "@/components/common/data-table";
import {
    Eye, CheckCircle2, XCircle, Clock, FileText, Loader2, ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { authFetch } from "@/lib/auth";
import { PermissionGuard } from "@/components/auth/permission-guard";

function fmt(val: number) {
    return val.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
    DRAFT:               { label: "Draft",              cls: "bg-muted text-muted-foreground border-border" },
    SUBMITTED:           { label: "Submitted",          cls: "bg-blue-50 text-blue-700 border-blue-300" },
    UNDER_REVIEW:        { label: "Under Review",       cls: "bg-amber-50 text-amber-700 border-amber-300" },
    APPROVED:            { label: "Approved",           cls: "bg-emerald-50 text-emerald-700 border-emerald-300" },
    PARTIALLY_APPROVED:  { label: "Partial",            cls: "bg-cyan-50 text-cyan-700 border-cyan-300" },
    REJECTED:            { label: "Rejected",           cls: "bg-destructive/10 text-destructive border-destructive/30" },
    CANCELLED:           { label: "Cancelled",          cls: "bg-muted text-muted-foreground border-border" },
};

const ITEM_STATUS_META: Record<string, { label: string; cls: string }> = {
    PENDING:            { label: "Pending",   cls: "bg-muted text-muted-foreground" },
    APPROVED:           { label: "Approved",  cls: "bg-emerald-100 text-emerald-700" },
    PARTIALLY_APPROVED: { label: "Partial",   cls: "bg-cyan-100 text-cyan-700" },
    REJECTED:           { label: "Rejected",  cls: "bg-red-100 text-red-700" },
};

export default function ClaimsPage() {
    const [claims, setClaims] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState("ALL");
    const [selectedClaim, setSelectedClaim] = useState<any>(null);
    const [showDetail, setShowDetail] = useState(false);
    const [isStartingReview, setIsStartingReview] = useState(false);
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);
    const [reviewNotes, setReviewNotes] = useState("");
    // Per-item approved qty state
    const [itemApprovals, setItemApprovals] = useState<Record<string, { approvedQty: number; notes: string }>>({});

    const fetchClaims = useCallback(async () => {
        setIsLoading(true);
        try {
            const params: any = { limit: 100 };
            if (statusFilter !== "ALL") params.status = statusFilter;
            const res = await authFetch("/pos-claims", { params });
            if (res.ok && res.data?.status) setClaims(res.data.data || []);
        } catch { toast.error("Failed to load claims"); }
        finally { setIsLoading(false); }
    }, [statusFilter]);

    useEffect(() => { fetchClaims(); }, [fetchClaims]);

    const openDetail = useCallback(async (claim: any) => {
        // Fetch full detail
        const res = await authFetch(`/pos-claims/${claim.id}`);
        if (res.ok && res.data?.status) {
            const full = res.data.data;
            setSelectedClaim(full);
            // Init approvals from existing data
            const init: Record<string, { approvedQty: number; notes: string }> = {};
            (full.items || []).forEach((i: any) => {
                init[i.id] = { approvedQty: i.approvedQty ?? i.claimedQty, notes: i.reviewNotes ?? "" };
            });
            setItemApprovals(init);
            setReviewNotes(full.reviewNotes ?? "");
            setShowDetail(true);
        }
    }, []);

    const handleStartReview = async () => {
        if (!selectedClaim) return;
        setIsStartingReview(true);
        try {
            const res = await authFetch(`/pos-claims/${selectedClaim.id}/start-review`, { method: "POST" });
            if (res.ok && res.data?.status) {
                setSelectedClaim((prev: any) => ({ ...prev, status: "UNDER_REVIEW" }));
                toast.success("Claim is now under review");
                fetchClaims();
            } else { toast.error(res.data?.message || "Failed"); }
        } catch { toast.error("Failed to start review"); }
        finally { setIsStartingReview(false); }
    };

    const handleSubmitReview = async () => {
        if (!selectedClaim) return;
        setIsSubmittingReview(true);
        try {
            const items = (selectedClaim.items || []).map((i: any) => ({
                claimItemId: i.id,
                approvedQty: itemApprovals[i.id]?.approvedQty ?? 0,
                reviewNotes: itemApprovals[i.id]?.notes || undefined,
            }));
            const res = await authFetch(`/pos-claims/${selectedClaim.id}/review`, {
                method: "POST",
                body: { items, reviewNotes: reviewNotes || undefined },
            });
            if (res.ok && res.data?.status) {
                toast.success(res.data.message);
                setShowDetail(false);
                fetchClaims();
            } else { toast.error(res.data?.message || "Review failed"); }
        } catch { toast.error("Review submission failed"); }
        finally { setIsSubmittingReview(false); }
    };

    const totalApprovedInReview = useMemo(() => {
        if (!selectedClaim) return 0;
        return (selectedClaim.items || []).reduce((s: number, i: any) => {
            const qty = itemApprovals[i.id]?.approvedQty ?? 0;
            return s + Number(i.unitPaidPrice) * qty;
        }, 0);
    }, [selectedClaim, itemApprovals]);

    const canReview = selectedClaim && ["SUBMITTED", "UNDER_REVIEW"].includes(selectedClaim.status);

    const columns = useMemo<ColumnDef<any>[]>(() => [
        {
            accessorKey: "claimNumber",
            header: "Claim #",
            cell: ({ row }) => <span className="font-mono font-bold text-primary text-sm">{row.getValue("claimNumber")}</span>,
        },
        {
            id: "orderNumber",
            header: "Order",
            cell: ({ row }) => <span className="font-mono text-sm">{row.original.salesOrder?.orderNumber}</span>,
        },
        {
            accessorKey: "claimType",
            header: "Type",
            cell: ({ row }) => <Badge variant="outline" className="text-xs capitalize">{row.getValue("claimType")}</Badge>,
        },
        {
            accessorKey: "reasonCode",
            header: "Reason",
            cell: ({ row }) => <span className="text-sm capitalize">{String(row.getValue("reasonCode")).replace(/_/g, " ").toLowerCase()}</span>,
        },
        {
            accessorKey: "claimedAmount",
            header: () => <div className="text-right">Claimed</div>,
            cell: ({ row }) => <div className="text-right font-mono font-semibold text-sm">Rs. {fmt(row.getValue("claimedAmount"))}</div>,
        },
        {
            accessorKey: "approvedAmount",
            header: () => <div className="text-right">Approved</div>,
            cell: ({ row }) => {
                const amt = Number(row.getValue("approvedAmount"));
                return <div className={cn("text-right font-mono font-semibold text-sm", amt > 0 ? "text-emerald-600" : "text-muted-foreground")}>{amt > 0 ? `Rs. ${fmt(amt)}` : "—"}</div>;
            },
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => {
                const s = row.getValue("status") as string;
                const meta = STATUS_META[s] ?? { label: s, cls: "" };
                return <Badge variant="outline" className={cn("text-[10px] px-1.5 h-5", meta.cls)}>{meta.label}</Badge>;
            },
        },
        {
            accessorKey: "submittedAt",
            header: "Submitted",
            cell: ({ row }) => {
                const d = row.getValue("submittedAt") as string;
                return d ? <span className="text-xs text-muted-foreground">{new Date(d).toLocaleDateString()}</span> : <span className="text-muted-foreground">—</span>;
            },
        },
        {
            id: "actions",
            header: () => <div className="text-right">Actions</div>,
            cell: ({ row }) => (
                <div className="flex justify-end">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-blue-600 hover:bg-blue-50"
                        onClick={() => openDetail(row.original)}>
                        <Eye className="h-3.5 w-3.5" />
                    </Button>
                </div>
            ),
        },
    ], [openDetail]);

    return (
        <PermissionGuard permissions="erp.claims.read">
            <div className="flex flex-col gap-6 p-6 px-10">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Return Claims</h1>
                        <p className="text-muted-foreground text-sm">Review and approve POS store return claims</p>
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Statuses</SelectItem>
                            {Object.entries(STATUS_META).map(([v, m]) => <SelectItem key={v} value={v}>{m.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>

                <DataTable columns={columns} data={claims} isLoading={isLoading} tableId="erp-claims"
                    searchFields={[{ key: "claimNumber", label: "Claim #" }]} />

                {/* Detail / Review Sheet */}
                <Sheet open={showDetail} onOpenChange={setShowDetail}>
                    <SheetContent side="bottom" className="flex flex-col h-[90vh] p-0 gap-0 rounded-t-2xl">
                        {selectedClaim && (
                            <>
                                <SheetHeader className="shrink-0 px-6 pt-6 pb-4 border-b">
                                    <SheetTitle className="flex items-center gap-2">
                                        <FileText className="h-5 w-5" />
                                        Claim {selectedClaim.claimNumber}
                                        <Badge variant="outline" className={cn("text-[10px] px-2 h-5 ml-2", STATUS_META[selectedClaim.status]?.cls)}>
                                            {STATUS_META[selectedClaim.status]?.label}
                                        </Badge>
                                    </SheetTitle>
                                </SheetHeader>

                                <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">

                                {/* Header info */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                                    <div className="bg-muted/40 rounded-lg px-3 py-2">
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Order</p>
                                        <p className="font-mono font-bold">{selectedClaim.salesOrder?.orderNumber}</p>
                                    </div>
                                    <div className="bg-muted/40 rounded-lg px-3 py-2">
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Reason</p>
                                        <p className="capitalize">{selectedClaim.reasonCode?.replace(/_/g, " ").toLowerCase()}</p>
                                    </div>
                                    <div className="bg-destructive/5 rounded-lg px-3 py-2">
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Claimed</p>
                                        <p className="font-bold font-mono">Rs. {fmt(selectedClaim.claimedAmount)}</p>
                                    </div>
                                    <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-lg px-3 py-2">
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Approved</p>
                                        <p className="font-bold font-mono text-emerald-700">Rs. {fmt(selectedClaim.approvedAmount)}</p>
                                    </div>
                                </div>

                                {selectedClaim.reasonNotes && (
                                    <div className="text-sm bg-muted/30 rounded-lg px-3 py-2 italic text-muted-foreground">
                                        "{selectedClaim.reasonNotes}"
                                    </div>
                                )}

                                <Separator />

                                {/* Items */}
                                <div className="space-y-2">
                                    <h3 className="text-sm font-semibold">Claimed Items</h3>
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="hover:bg-transparent bg-muted/20">
                                                <TableHead className="text-xs uppercase">Item</TableHead>
                                                <TableHead className="text-right text-xs uppercase">Claimed Qty</TableHead>
                                                <TableHead className="text-right text-xs uppercase">Paid/Unit</TableHead>
                                                <TableHead className="text-right text-xs uppercase">Claimed Amt</TableHead>
                                                {canReview && <TableHead className="text-center text-xs uppercase text-emerald-700">Approve Qty</TableHead>}
                                                {canReview && <TableHead className="text-right text-xs uppercase text-emerald-700">Approved Amt</TableHead>}
                                                {!canReview && <TableHead className="text-center text-xs uppercase">Status</TableHead>}
                                                {!canReview && <TableHead className="text-right text-xs uppercase">Approved</TableHead>}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {selectedClaim.items?.map((item: any) => {
                                                const approval = itemApprovals[item.id] ?? { approvedQty: item.approvedQty, notes: "" };
                                                const approvedAmt = Number(item.unitPaidPrice) * approval.approvedQty;
                                                const isMeta = ITEM_STATUS_META[item.itemStatus] ?? { label: item.itemStatus, cls: "" };
                                                return (
                                                    <TableRow key={item.id}>
                                                        <TableCell>
                                                            <p className="font-medium text-sm">{item.item?.description}</p>
                                                            <p className="text-xs text-muted-foreground font-mono">{item.item?.sku}</p>
                                                        </TableCell>
                                                        <TableCell className="text-right text-sm">{item.claimedQty}</TableCell>
                                                        <TableCell className="text-right font-mono text-sm">Rs. {fmt(item.unitPaidPrice)}</TableCell>
                                                        <TableCell className="text-right font-mono text-sm text-destructive">Rs. {fmt(item.claimedAmount)}</TableCell>
                                                        {canReview ? (
                                                            <>
                                                                <TableCell>
                                                                    <div className="flex items-center justify-center gap-1">
                                                                        <Button variant="outline" size="icon" className="h-6 w-6"
                                                                            onClick={() => setItemApprovals(p => ({ ...p, [item.id]: { ...p[item.id], approvedQty: Math.max(0, (p[item.id]?.approvedQty ?? item.claimedQty) - 1) } }))}>
                                                                            <ChevronDown className="h-3 w-3" />
                                                                        </Button>
                                                                        <Input type="number" min={0} max={item.claimedQty} className="w-14 h-7 text-center text-xs"
                                                                            value={approval.approvedQty}
                                                                            onChange={e => setItemApprovals(p => ({ ...p, [item.id]: { ...p[item.id], approvedQty: Math.min(item.claimedQty, Math.max(0, parseInt(e.target.value) || 0)) } }))} />
                                                                        <Button variant="outline" size="icon" className="h-6 w-6"
                                                                            onClick={() => setItemApprovals(p => ({ ...p, [item.id]: { ...p[item.id], approvedQty: Math.min(item.claimedQty, (p[item.id]?.approvedQty ?? 0) + 1) } }))}>
                                                                            <ChevronUp className="h-3 w-3" />
                                                                        </Button>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="text-right font-mono text-sm text-emerald-700 font-bold">
                                                                    Rs. {fmt(approvedAmt)}
                                                                </TableCell>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <TableCell className="text-center">
                                                                    <Badge className={cn("text-[10px] px-1.5", isMeta.cls)}>{isMeta.label}</Badge>
                                                                </TableCell>
                                                                <TableCell className="text-right font-mono text-sm text-emerald-700 font-bold">
                                                                    {Number(item.approvedAmount) > 0 ? `Rs. ${fmt(item.approvedAmount)}` : "—"}
                                                                </TableCell>
                                                            </>
                                                        )}
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>

                                {/* Review totals */}
                                {canReview && (
                                    <div className="flex justify-between items-center rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 px-4 py-2 text-sm font-semibold">
                                        <span className="text-emerald-700">Total to Approve</span>
                                        <span className="font-mono text-emerald-700 text-base">Rs. {fmt(totalApprovedInReview)}</span>
                                    </div>
                                )}

                                {/* Review notes */}
                                {canReview && (
                                    <div className="space-y-1.5">
                                        <Label className="text-xs text-muted-foreground">Review Notes</Label>
                                        <Textarea placeholder="Notes for the store..." value={reviewNotes} onChange={e => setReviewNotes(e.target.value)} rows={2} className="resize-none text-sm" />
                                    </div>
                                )}

                                {selectedClaim.reviewNotes && !canReview && (
                                    <div className="text-sm bg-muted/30 rounded-lg px-3 py-2">
                                        <p className="text-xs text-muted-foreground font-bold mb-1">ERP Review Notes</p>
                                        <p className="italic">{selectedClaim.reviewNotes}</p>
                                    </div>
                                )}

                                </div>{/* end scrollable */}

                                <SheetFooter className="shrink-0 border-t px-6 py-4 gap-2 flex-row justify-end">
                                    <Button variant="ghost" onClick={() => setShowDetail(false)}>Close</Button>
                                    {selectedClaim.status === "SUBMITTED" && (
                                        <PermissionGuard permissions="erp.claims.approve" fallback={null}>
                                            <Button variant="outline" onClick={handleStartReview} disabled={isStartingReview} className="gap-2">
                                                {isStartingReview ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
                                                Start Review
                                            </Button>
                                        </PermissionGuard>
                                    )}
                                    {canReview && (
                                        <PermissionGuard permissions="erp.claims.approve" fallback={null}>
                                            <Button onClick={handleSubmitReview} disabled={isSubmittingReview} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
                                                {isSubmittingReview ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                                Submit Decision
                                            </Button>
                                        </PermissionGuard>
                                    )}
                                </SheetFooter>
                            </>
                        )}
                    </SheetContent>
                </Sheet>
            </div>
        </PermissionGuard>
    );
}
