"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Eye, CreditCard, RefreshCcw, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getSalesInvoices } from "@/lib/actions/receipt-voucher";
import { PermissionGuard } from "@/components/auth/permission-guard";
import { formatCurrency } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
    PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
    POSTED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    PARTIAL: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
    PAID: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    CANCELLED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export default function SalesInvoicesPage() {
    const router = useRouter();
    const [invoices, setInvoices] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");

    const load = useCallback(async () => {
        setLoading(true);
        const result = await getSalesInvoices(search || undefined, statusFilter !== "all" ? statusFilter : undefined);
        setInvoices(result.status ? result.data : []);
        setLoading(false);
    }, [search, statusFilter]);

    useEffect(() => { load(); }, [load]);

    const totals = loading ? { total: 0, paid: 0, outstanding: 0 } : (invoices || []).reduce(
        (acc, inv) => ({
            total: acc.total + Number(inv.grandTotal || 0),
            paid: acc.paid + Number(inv.paidAmount || 0),
            outstanding: acc.outstanding + Number(inv.balanceAmount || 0),
        }),
        { total: 0, paid: 0, outstanding: 0 }
    );

    return (
        <PermissionGuard permissions="erp.sales.invoice.read">
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Sales Invoices</h1>
                        <p className="text-muted-foreground">Manage customer invoices and collections</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <PermissionGuard permissions="erp.sales.invoice.create" fallback={null}>
                            <Button onClick={() => router.push('/erp/sales/invoices/create')}>
                                <Plus className="h-4 w-4 mr-2" />
                                Create Invoice
                            </Button>
                        </PermissionGuard>
                        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                            <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                            Refresh
                        </Button>
                    </div>
                </div>

                {/* Summary cards */}
                <div className="grid gap-4 md:grid-cols-4">
                    {[
                        { label: "Total Invoices", value: invoices.length, className: "" },
                        { label: "Total Billed", value: formatCurrency(totals.total), className: "" },
                        { label: "Outstanding", value: formatCurrency(totals.outstanding), className: "text-red-600" },
                        { label: "Collected", value: formatCurrency(totals.paid), className: "text-green-600" },
                    ].map(card => (
                        <div key={card.label} className="rounded-lg border p-4">
                            <div className="text-sm font-medium text-muted-foreground">{card.label}</div>
                            <div className={`text-2xl font-bold mt-1 ${card.className}`}>{card.value}</div>
                        </div>
                    ))}
                </div>

                {/* Filters */}
                <div className="flex items-center gap-4">
                    <div className="relative flex-1 max-w-sm">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
                        <Input
                            placeholder="Search by invoice no or customer..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-40">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="posted">Posted</SelectItem>
                            <SelectItem value="partial">Partial</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* Table */}
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Invoice No</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Due Date</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                                <TableHead className="text-right">Paid</TableHead>
                                <TableHead className="text-right">Balance</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center py-12">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                                    </TableCell>
                                </TableRow>
                            ) : invoices.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                                        No invoices found
                                    </TableCell>
                                </TableRow>
                            ) : invoices.map(inv => (
                                <TableRow key={inv.id}>
                                    <TableCell className="font-medium">{inv.invoiceNo}</TableCell>
                                    <TableCell>{inv.customer?.name ?? "—"}</TableCell>
                                    <TableCell>{new Date(inv.invoiceDate).toLocaleDateString()}</TableCell>
                                    <TableCell>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}</TableCell>
                                    <TableCell>
                                        <Badge className={STATUS_COLORS[inv.status] ?? STATUS_COLORS.CANCELLED}>
                                            {inv.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {formatCurrency(Number(inv.grandTotal))}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums text-muted-foreground">
                                        {formatCurrency(Number(inv.paidAmount))}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        <span className={Number(inv.balanceAmount) > 0 ? "text-red-600 font-medium" : "text-green-600"}>
                                            {formatCurrency(Number(inv.balanceAmount))}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button variant="ghost" size="icon" title="View" onClick={() => router.push(`/erp/sales/invoices/${inv.id}`)}>
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                            {Number(inv.balanceAmount) > 0 && inv.status !== "CANCELLED" && (
                                                <PermissionGuard permissions="erp.finance.receipt-voucher.create" fallback={null}>
                                                    <Button
                                                        variant="ghost" size="icon" title="Record Receipt"
                                                        onClick={() => router.push(`/erp/finance/receipt-voucher/create?customerId=${inv.customerId}&invoiceId=${inv.id}`)}
                                                    >
                                                        <CreditCard className="h-4 w-4 text-primary" />
                                                    </Button>
                                                </PermissionGuard>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </PermissionGuard>
    );
}
