"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Autocomplete } from "@/components/ui/autocomplete";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Printer, Download, Plus, CreditCard, Wallet, Eye, Loader2 } from "lucide-react";
import { ChartOfAccount } from "@/lib/actions/chart-of-account";
import { PaymentVoucher } from "@/lib/actions/payment-voucher";
import { queuePaymentVouchersExport } from "@/lib/actions/payment-voucher";
import { PaymentVoucherPrint } from "./payment-voucher-print";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { toast } from "sonner";
import DataTable from "@/components/common/data-table";
import { ColumnDef } from "@tanstack/react-table";

interface LocalDraft {
    voucherNo: string;
    updatedAt: string;
    formValues: {
        description?: string;
        type?: string;
        pvDate?: string | Date;
        details?: { accountId?: string; debit?: number; credit?: number }[];
    };
}

export function PaymentVoucherList({
    initialData,
    accounts,
    permissions,
}: {
    initialData: PaymentVoucher[];
    accounts: ChartOfAccount[];
    permissions?: {
        canCreate: boolean;
        canRead: boolean;
        canUpdate: boolean;
        canDelete: boolean;
        canApprove: boolean;
    };
}) {
    const [type, setType] = useState<"bank" | "cash">("bank");
    const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
    const [toDate, setToDate] = useState<Date | undefined>(undefined);
    const [selectedAccount, setSelectedAccount] = useState<string>("");
    const [status, setStatus] = useState<string>("all");
    const [vouchers, setVouchers] = useState<PaymentVoucher[]>(initialData);
    const [showFilterInfo, setShowFilterInfo] = useState(false);
    const [localDrafts, setLocalDrafts] = useState<LocalDraft[]>([]);
    const [printingVoucher, setPrintingVoucher] = useState<PaymentVoucher | null>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const result = await queuePaymentVouchersExport({
                type:     type,
                status:   status !== "all" ? status : undefined,
                dateFrom: fromDate ? fromDate.toISOString().split("T")[0] : undefined,
                dateTo:   toDate   ? toDate.toISOString().split("T")[0]   : undefined,
            });
            if (result.status) {
                toast.success("Export queued! You'll receive a notification when your file is ready.");
            } else {
                toast.error(result.message || "Failed to queue export.");
            }
        } catch {
            toast.error("An unexpected error occurred while queuing export.");
        } finally {
            setIsExporting(false);
        }
    };

    useEffect(() => {
        const handleAfterPrint = () => {
            setPrintingVoucher(null);
        };
        window.addEventListener("afterprint", handleAfterPrint);
        return () => window.removeEventListener("afterprint", handleAfterPrint);
    }, []);

    const handlePrint = (voucher: PaymentVoucher) => {
        setPrintingVoucher(voucher);
        setTimeout(() => {
            window.print();
        }, 100);
    };

    useEffect(() => {
        const draftsJson = localStorage.getItem("payment-voucher-drafts");
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
        const draftsJson = localStorage.getItem("payment-voucher-drafts");
        if (draftsJson) {
            try {
                const parsed = JSON.parse(draftsJson);
                delete parsed[draftId];
                localStorage.setItem("payment-voucher-drafts", JSON.stringify(parsed));
                setLocalDrafts(Object.values(parsed));
                toast.success("Draft discarded");
            } catch {}
        }
    };

    // Use initial data directly as it comes from the server
    useEffect(() => {
        setTimeout(() => {
            setVouchers(initialData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        }, 0);
    }, [initialData]);

    const columns = useMemo<ColumnDef<PaymentVoucher>[]>(() => [
        {
            accessorKey: "pvNo",
            header: "P.V. No.",
            cell: ({ row }) => (
                <Link
                    href={`/erp/finance/payment-voucher/${row.original.id}`}
                    className="font-mono font-medium text-primary hover:underline"
                    transitionTypes={["nav-forward"]}
                >
                    {row.original.pvNo}
                </Link>
            )
        },
        {
            accessorKey: "pvDate",
            header: "P.V. Date",
            cell: ({ row }) => format(new Date(row.original.pvDate), "dd-MM-yyyy")
        },
        {
            id: "details",
            header: "Debit / Credit",
            cell: ({ row }) => {
                const debitLines  = row.original.details.filter(d => Number(d.debit)  > 0);
                const creditLines = row.original.details.filter(d => Number(d.credit) > 0);
                return (
                    <div className="flex flex-col">
                        <div className="space-y-0.5 min-w-[280px] max-h-36 overflow-y-auto pr-1.5 border border-muted/20 rounded-md p-1.5 bg-muted/10">
                            {/* Debit lines */}
                            {debitLines.map((d, di) => (
                                <div key={`dr-${di}`} className="space-y-0.5">
                                    <div className="flex justify-between text-xs gap-3">
                                        <span className="text-blue-600 font-medium truncate max-w-[200px]">
                                            {d.accountCode ? `${d.accountCode} ` : ""}{d.accountName}
                                        </span>
                                        <span className="font-bold tabular-nums shrink-0">
                                            {Number(d.debit).toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                    {(d.tagAccountCode || d.tagAccountName) && (
                                        <span className="block text-[9px] text-muted-foreground uppercase pl-2">
                                            ↳ {d.tagAccountCode ? `${d.tagAccountCode} ` : ""}{d.tagAccountName}
                                        </span>
                                    )}
                                    {d.narration && (
                                        <span className="block text-[10px] text-muted-foreground italic pl-2">
                                            {d.narration}
                                        </span>
                                    )}
                                </div>
                            ))}
                            {/* Divider */}
                            <div className="border-t border-dashed border-border my-0.5" />
                            {/* Credit lines — from details if present, else fallback to header */}
                            {creditLines.length > 0
                                ? creditLines.map((d, ci) => (
                                    <div key={`cr-${ci}`} className="space-y-0.5 opacity-70 italic">
                                        <div className="flex justify-between text-xs gap-3">
                                            <span className="text-green-600 truncate max-w-[200px]">
                                                (Cr: {d.accountCode ? `${d.accountCode} ` : ""}{d.accountName})
                                            </span>
                                            <span className="tabular-nums shrink-0">
                                                {Number(d.credit).toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        {(d.tagAccountCode || d.tagAccountName) && (
                                            <span className="block text-[9px] text-muted-foreground uppercase pl-4">
                                                ↳ {d.tagAccountCode ? `${d.tagAccountCode} ` : ""}{d.tagAccountName}
                                            </span>
                                        )}
                                        {d.narration && (
                                            <span className="block text-[10px] text-muted-foreground pl-2">
                                                {d.narration}
                                            </span>
                                        )}
                                    </div>
                                ))
                                : (
                                    <div className="flex justify-between text-xs opacity-70 italic">
                                        <span className="text-green-600 truncate max-w-[200px]">
                                            (Cr: {row.original.creditAccountName})
                                        </span>
                                        <span className="tabular-nums shrink-0">
                                            {Number(row.original.creditAmount).toLocaleString("en-PK", { minimumFractionDigits: 2 })}
                                        </span>
                                    </div>
                                )
                            }
                        </div>
                        {row.original.details.length > 5 && (
                            <div className="text-[10px] text-muted-foreground font-semibold mt-1 text-center">
                                Total {row.original.details.length} lines (scroll to see all)
                            </div>
                        )}
                    </div>
                );
            }
        },
        {
            accessorKey: "refBillNo",
            header: "Ref / Bill No.",
            cell: ({ row }) => row.original.refBillNo || "-"
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => (
                <span className={cn(
                    "px-3 py-1 rounded-md text-[10px] uppercase font-bold text-white",
                    row.original.status === "approved" ? "bg-green-500" :
                        row.original.status === "pending" ? "bg-yellow-500" : "bg-red-500"
                )}>
                    {row.original.status}
                </span>
            )
        },
        {
            id: "actions",
            header: "",
            cell: ({ row }) => (
                <div className="flex items-center gap-1.5">
                    <Link
                        href={`/erp/finance/payment-voucher/${row.original.id}`}
                        transitionTypes={["nav-forward"]}
                    >
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="View Details">
                            <Eye className="h-3.5 w-3.5" />
                        </Button>
                    </Link>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handlePrint(row.original)}
                        className="h-7 w-7 hover:bg-muted text-primary"
                        title="Print Voucher"
                    >
                        <Printer className="h-3.5 w-3.5" />
                    </Button>
                </div>
            )
        }
    ], [handlePrint]);

    const filteredData = useMemo(() => {
        return vouchers.filter(v => {
            const date = new Date(v.pvDate);
            const matchesDate = (!fromDate || date >= fromDate) && (!toDate || date <= toDate);
            const matchesType = v.type === type;
            const matchesStatus = status === "all" || v.status === status;
            const matchesAccount = selectedAccount === "" || v.creditAccountId === selectedAccount || v.details.some(d => d.accountId === selectedAccount);
            return matchesDate && matchesType && matchesStatus && matchesAccount;
        });
    }, [vouchers, type, fromDate, toDate, selectedAccount, status]);

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
                                        <span className="text-[9px] uppercase font-semibold px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200">
                                            {draft.formValues?.type || "bank"}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground truncate max-w-[280px]">
                                        {draft.formValues?.description || "No description provided"}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Link href={`/erp/finance/payment-voucher/create?draftId=${draft.voucherNo}`}>
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
            <Tabs value={type} onValueChange={(val) => setType(val as "bank" | "cash")} className="w-full">
                <Card>
                    <CardHeader className="border-b dark:border-border space-y-4">
                        <div className="flex items-center justify-between w-full">
                            <div className="space-y-1">
                                <CardTitle>Payment Vouchers</CardTitle>
                                <p className="text-sm text-muted-foreground">Manage your bank and cash payments</p>
                            </div>
                            <div className="flex items-center gap-2">
                                {permissions?.canCreate && (
                                    <Link href="/erp/finance/payment-voucher/create" transitionTypes={["nav-forward"]}>
                                        <Button size="sm">
                                            <Plus className="h-4 w-4 mr-2" />
                                            Add Payment Voucher
                                        </Button>
                                    </Link>
                                )}
                                <Button variant="outline" size="sm">
                                    <Printer className="mr-2 h-4 w-4" />
                                    Print
                                </Button>
                                <Button variant="outline" size="sm" onClick={handleExport} disabled={isExporting}>
                                    {isExporting
                                        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        : <Download className="mr-2 h-4 w-4" />}
                                    {isExporting ? "Queuing..." : "Export (xlsx)"}
                                </Button>
                            </div>
                        </div>
                        <TabsList variant="card" className="grid w-full max-w-md grid-cols-2">
                            <TabsTrigger value="bank" className="flex items-center gap-2">
                                <CreditCard className="h-4 w-4" />
                                Bank Payment Vouchers
                            </TabsTrigger>
                            <TabsTrigger value="cash" className="flex items-center gap-2">
                                <Wallet className="h-4 w-4" />
                                Cash Payment Vouchers
                            </TabsTrigger>
                        </TabsList>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">

                        {/* Filters */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end p-4 rounded-lg border dark:border-border">
                            <div className="space-y-1.5 overflow-hidden">
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
                            <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Account head</Label>
                                <Autocomplete
                                    options={accounts.map(acc => ({ value: acc.id, label: acc.name }))}
                                    value={selectedAccount}
                                    onValueChange={setSelectedAccount}
                                    placeholder="Select Account"
                                />
                            </div>
                            <div className="space-y-1.5">
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
                                {type === "bank" ? "Bank" : "Cash"} Payment Voucher List From :
                                <span className="text-red-600 ml-1 font-mono">{format(fromDate, "dd-MM-yyyy")}</span>
                                <span className="mx-1">Between To</span>
                                <span className="text-red-600 font-mono">{format(toDate, "dd-MM-yyyy")}</span>
                            </div>
                        )}

                        <DataTable
                            columns={columns}
                            data={filteredData}
                            searchFields={[{ key: "pvNo", label: "PV Number" }]}
                            tableId="payment-voucher-list"
                        />
                    </CardContent>
                </Card>
            </Tabs>

            {/* Hidden Print Section */}
            {mounted && typeof window !== "undefined" && printingVoucher && createPortal(
                <>
                    <style dangerouslySetInnerHTML={{ __html: `
                        @media print {
                          html, body {
                            height: auto !important;
                            overflow: visible !important;
                            background: white !important;
                            color: black !important;
                          }
                          body > *:not(#pv-print-section) {
                            display: none !important;
                          }
                          #pv-print-section, #pv-print-section * {
                            visibility: visible !important;
                          }
                          #pv-print-section {
                            display: block !important;
                            position: relative !important;
                            left: 0 !important;
                            top: 0 !important;
                            width: 100% !important;
                            margin: 0 !important;
                            padding: 0 !important;
                            background: white !important;
                            color: black !important;
                            z-index: 99999 !important;
                          }
                          tr {
                            page-break-inside: avoid;
                            break-inside: avoid;
                          }
                          thead {
                            display: table-header-group;
                          }
                          tfoot {
                            display: table-footer-group;
                          }
                          @page {
                            margin: 10mm;
                            size: A4 portrait;
                          }
                        }
                    `}} />
                    <div 
                        id="pv-print-section" 
                        style={{
                            position: "fixed",
                            left: "-9999px",
                            top: 0,
                            pointerEvents: "none",
                        }}
                        aria-hidden="true"
                    >
                        <PaymentVoucherPrint voucher={printingVoucher} />
                    </div>
                </>,
                document.body
            )}
        </div>
    );
}
