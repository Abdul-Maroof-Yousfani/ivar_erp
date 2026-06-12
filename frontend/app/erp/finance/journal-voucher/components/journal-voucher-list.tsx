"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Autocomplete } from "@/components/ui/autocomplete";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Printer, Download, Plus, Eye, CheckCircle2 } from "lucide-react";
import { ChartOfAccount } from "@/lib/actions/chart-of-account";
import { JournalVoucher, updateJournalVoucher } from "@/lib/actions/journal-voucher";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { toast } from "sonner";

import DataTable from "@/components/common/data-table";
import { ColumnDef } from "@tanstack/react-table";
import { DateRangePicker } from "@/components/ui/date-range-picker";

interface LocalDraft {
    voucherNo: string;
    updatedAt: string;
    formValues: {
        description?: string;
        type?: string;
        jvDate?: string | Date;
        details?: { accountId?: string; debit?: number; credit?: number }[];
    };
}

export function JournalVoucherList({
    initialData,
    accounts,
    permissions
}: {
    initialData: JournalVoucher[],
    accounts: ChartOfAccount[],
    permissions?: {
        canCreate: boolean;
        canRead: boolean;
        canUpdate: boolean;
        canDelete: boolean;
        canApprove: boolean;
    }
}) {
    const [fromDate, setFromDate] = useState<Date | undefined>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const [toDate, setToDate] = useState<Date | undefined>(new Date());
    const [selectedAccount, setSelectedAccount] = useState<string>("");
    const [status, setStatus] = useState<string>("all");
    const [vouchers, setVouchers] = useState<JournalVoucher[]>(initialData);
    const [showFilterInfo, setShowFilterInfo] = useState(false);
    const [localDrafts, setLocalDrafts] = useState<LocalDraft[]>([]);

    useEffect(() => {
        const draftsJson = localStorage.getItem("journal-voucher-drafts");
        if (draftsJson) {
            try {
                const parsed = JSON.parse(draftsJson);
                setTimeout(() => {
                    setLocalDrafts(Object.values(parsed));
                }, 0);
            } catch {}
        }
    }, []);

    const handleDiscardDraft = (draftId: string) => {
        const draftsJson = localStorage.getItem("journal-voucher-drafts");
        if (draftsJson) {
            try {
                const parsed = JSON.parse(draftsJson);
                delete parsed[draftId];
                localStorage.setItem("journal-voucher-drafts", JSON.stringify(parsed));
                setLocalDrafts(Object.values(parsed));
                toast.success("Draft discarded");
            } catch {}
        }
    };

    // Use initial data directly as it comes from the server
    useEffect(() => {
        setTimeout(() => {
            setVouchers(initialData.sort((a, b) => new Date(b.jvDate).getTime() - new Date(a.jvDate).getTime()));
        }, 0);
    }, [initialData]);

    const handleApprove = async (id: string) => {
        try {
            const res = await updateJournalVoucher(id, { status: "approved" });
            if (res.status) {
                toast.success("Journal Voucher approved successfully");
                setVouchers(prev => prev.map(v => v.id === id ? { ...v, status: "approved" as const } : v));
            } else {
                toast.error(res.message || "Failed to approve voucher");
            }
        } catch {
            toast.error("An unexpected error occurred");
        }
    };

    const columns = useMemo<ColumnDef<JournalVoucher>[]>(() => [
        {
            accessorKey: "jvNo",
            header: "J.V. No.",
            cell: ({ row }) => (
                <Link
                    href={`/erp/finance/journal-voucher/${row.original.id}`}
                    className="font-mono font-semibold text-primary hover:underline"
                    transitionTypes={["nav-forward"]}
                >
                    {row.original.jvNo}
                </Link>
            )
        },
        {
            accessorKey: "jvDate",
            header: "J.V. Date",
            cell: ({ row }) => format(new Date(row.original.jvDate), "dd-MMM-yyyy")
        },
        {
            id: "details",
            header: "Debit/Credit Details",
            cell: ({ row }) => (
                <div className="space-y-1 min-w-[320px]">
                    {row.original.details.map((detail, idx) => (
                        <div key={idx} className="flex justify-between gap-4 items-start text-xs border-b border-dashed border-gray-100 dark:border-muted/30 pb-0.5 last:border-0">
                            <span className="flex-1">
                                <span className={cn(
                                    "font-bold mr-1.5",
                                    detail.debit > 0 ? "text-blue-600" : "text-green-600"
                                )}>
                                    {detail.debit > 0 ? "Dr" : "Cr"}
                                </span>
                                <span className="uppercase text-gray-700 dark:text-gray-300 font-medium">
                                    {detail.accountCode ? `${detail.accountCode} - ` : ""}{detail.accountName || "Account"}
                                </span>
                                {detail.tagAccountCode && (
                                    <span className="text-[10px] text-muted-foreground ml-1.5 italic bg-muted px-1 py-0.2 rounded">
                                        Tag: {detail.tagAccountCode}
                                    </span>
                                )}
                                {detail.narration && (
                                    <span className="block text-[10px] text-muted-foreground italic mt-0.5 ml-5">
                                        {detail.narration}
                                    </span>
                                )}
                            </span>
                            <span className="font-mono font-bold text-gray-800 dark:text-foreground shrink-0 pl-2">
                                {(detail.debit || detail.credit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    ))}
                </div>
            )
        },
        {
            accessorKey: "status",
            header: "Voucher Status",
            cell: ({ row }) => (
                <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] uppercase font-bold text-white",
                    row.original.status === 'approved' ? "bg-green-500" :
                    row.original.status === 'pending' ? "bg-yellow-500" : "bg-red-500"
                )}>
                    {row.original.status}
                </span>
            )
        },
        {
            id: "actions",
            header: "Actions",
            cell: ({ row }) => (
                <div className="flex items-center gap-1.5">
                    <Link
                        href={`/erp/finance/journal-voucher/${row.original.id}`}
                        transitionTypes={["nav-forward"]}
                    >
                        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" title="View Details">
                            <Eye className="h-4 w-4 text-primary" />
                        </Button>
                    </Link>
                    {row.original.status === 'pending' && permissions?.canApprove && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleApprove(row.original.id)}
                            className="h-8 w-8 hover:bg-green-50 dark:hover:bg-green-950/20 text-green-600"
                            title="Approve Voucher"
                        >
                            <CheckCircle2 className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            )
        }
    ], [permissions]);

    // Filter logic for DataTable data
    const filteredVouchers = useMemo(() => {
        return vouchers.filter(jv => {
            const date = new Date(jv.jvDate);
            const matchesDate = (!fromDate || date >= fromDate) && (!toDate || date <= toDate);
            const matchesAccount = !selectedAccount || jv.details.some(d => d.accountId === selectedAccount);
            const matchesStatus = status === "all" || jv.status === status;
            return matchesDate && matchesAccount && matchesStatus;
        });
    }, [vouchers, fromDate, toDate, selectedAccount, status]);

    return (
        <div className="space-y-6">
            {localDrafts.length > 0 && (
                <div className="bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900/50 rounded-xl p-5 backdrop-blur-md shadow-sm space-y-4">
                    <div className="flex items-center justify-between border-b border-amber-200/50 dark:border-amber-900/30 pb-2">
                        <div className="flex items-center gap-2">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                            </span>
                            <h3 className="font-bold text-amber-800 dark:text-amber-400 text-sm uppercase tracking-wider">
                                Unsaved Drafts ({localDrafts.length})
                            </h3>
                        </div>
                        <p className="text-xs text-amber-600/80 dark:text-amber-500/80">
                            Saved locally in your browser to prevent data loss
                        </p>
                    </div>
                    <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
                        {localDrafts.map((draft) => (
                            <div
                                key={draft.voucherNo}
                                className="flex items-center justify-between p-3.5 rounded-lg border border-amber-200/40 bg-white/70 dark:bg-muted/30 dark:border-amber-900/20 shadow-sm transition-all duration-200 hover:shadow"
                            >
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200 text-sm">
                                            {draft.voucherNo}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground font-mono">
                                            {format(new Date(draft.updatedAt), "dd MMM yyyy, hh:mm a")}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate max-w-[280px]">
                                        {draft.formValues?.description || "No description provided"}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Link href={`/erp/finance/journal-voucher/create?draftId=${draft.voucherNo}`}>
                                        <Button size="sm" variant="secondary" className="bg-amber-100 hover:bg-amber-200 text-amber-800 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 dark:text-amber-300 font-semibold h-8">
                                            Resume
                                        </Button>
                                    </Link>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleDiscardDraft(draft.voucherNo)}
                                        className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                                    >
                                        Discard
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            <Card>
                <CardHeader className="border-b flex flex-row items-center justify-between">
                    <CardTitle>Journal Vouchers</CardTitle>
                    <div className="flex items-center gap-2">
                        {permissions?.canCreate && (
                            <Link href="/erp/finance/journal-voucher/create" transitionTypes={["nav-forward"]}>
                                <Button size="sm">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add Voucher
                                </Button>
                            </Link>
                        )}
                        <Button variant="outline" size="sm">
                            <Printer className="mr-2 h-4 w-4" />
                            Print
                        </Button>
                        <Button variant="outline" size="sm">
                            <Download className="mr-2 h-4 w-4" />
                            Export (xlsx)
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    {/* Filters Section */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end p-4 rounded-lg border dark:border-border">
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Select Date Range</Label>
                            <DateRangePicker
                                initialDateFrom={fromDate}
                                initialDateTo={toDate}
                                onUpdate={(values) => {
                                    setFromDate(values.range.from);
                                    setToDate(values.range.to);
                                }}
                                align="start"
                                locale="en-GB"
                                showCompare={false}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Account Head</Label>
                            <Autocomplete
                                options={accounts.map(acc => ({ value: acc.id, label: acc.name }))}
                                value={selectedAccount}
                                onValueChange={setSelectedAccount}
                                placeholder="Select Account"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">Voucher Status</Label>
                            <Select value={status} onValueChange={setStatus}>
                                <SelectTrigger>
                                    <SelectValue placeholder="All" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All</SelectItem>
                                    <SelectItem value="approved">Approved</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="rejected">Rejected</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Button
                                variant="secondary"
                                onClick={() => setShowFilterInfo(true)}
                            >
                                View Range Wise Data Filter
                            </Button>
                        </div>
                    </div>

                    {showFilterInfo && fromDate && toDate && (
                        <div className="text-sm font-bold italic text-slate-800 dark:text-slate-200 py-2 border-b dark:border-border">
                            Journal Voucher List From :
                            <span className="text-red-600 ml-1 font-mono">{format(fromDate, "dd-MM-yyyy")}</span>
                            <span className="mx-1">Between To</span>
                            <span className="text-red-600 font-mono">{format(toDate, "dd-MM-yyyy")}</span>
                        </div>
                    )}

                    <DataTable
                        columns={columns}
                        data={filteredVouchers}
                        searchFields={[{ key: "jvNo", label: "JV Number" }]}
                        tableId="journal-voucher-list"
                    />
                </CardContent>
            </Card>
        </div>
    );
}
