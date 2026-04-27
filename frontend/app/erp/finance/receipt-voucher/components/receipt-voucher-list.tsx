"use client";

import { useState, useEffect, useMemo } from "react";
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
import { Printer, Download, Plus, CreditCard, Wallet } from "lucide-react";
import { ChartOfAccount } from "@/lib/actions/chart-of-account";
import { ReceiptVoucher } from "@/lib/actions/receipt-voucher";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import DataTable from "@/components/common/data-table";
import { ColumnDef } from "@tanstack/react-table";

export function ReceiptVoucherList({
    initialData,
    accounts,
    permissions,
}: {
    initialData: ReceiptVoucher[];
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
    const [fromDate, setFromDate] = useState<Date | undefined>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const [toDate, setToDate] = useState<Date | undefined>(new Date());
    const [selectedAccount, setSelectedAccount] = useState<string>("all");
    const [status, setStatus] = useState<string>("all");
    const [vouchers, setVouchers] = useState<ReceiptVoucher[]>(initialData);
    const [showFilterInfo, setShowFilterInfo] = useState(false);

    // Use initial data directly as it comes from the server
    useEffect(() => {
        setVouchers(initialData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }, [initialData]);

    const columns = useMemo<ColumnDef<ReceiptVoucher>[]>(() => [
        {
            accessorKey: "rvNo",
            header: "R.V. No.",
            cell: ({ row }) => <span className="font-mono font-bold text-slate-800 dark:text-foreground">{row.original.rvNo}</span>
        },
        {
            accessorKey: "rvDate",
            header: "R.V. Date",
            cell: ({ row }) => format(new Date(row.original.rvDate), "dd-MM-yyyy")
        },
        {
            accessorKey: "refBillNo",
            header: "Ref / Bill No.",
            cell: ({ row }) => row.original.refBillNo || "-"
        },
        {
            accessorKey: "description",
            header: "Description",
            cell: ({ row }) => <div className="truncate max-w-[150px]">{row.original.description}</div>
        },
        {
            id: "details",
            header: "Debit/Credit",
            cell: ({ row }) => (
                <div className="space-y-1 min-w-[200px]">
                    <div className="flex justify-between text-[11px] font-bold border-b border-slate-200 pb-1 mb-1">
                        <span className="text-slate-500">DR:</span>
                        <span className="text-slate-800 ml-1">{row.original.debitAccountName}</span>
                        <span className="text-slate-800 ml-auto">{row.original.debitAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                    {row.original.details.map((d, di) => (
                        <div key={di} className="flex justify-between text-[11px]">
                            <span className="text-green-600">CR:</span>
                            <span className="text-slate-700 ml-1">{d.accountName}</span>
                            <span className="font-bold text-slate-700 ml-auto">{d.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                    ))}
                </div>
            )
        },
        {
            accessorKey: "status",
            header: "Status",
            cell: ({ row }) => (
                <span className={cn(
                    "px-3 py-1 rounded-md text-[10px] uppercase font-bold",
                    row.original.status === "approved" ? "bg-[#22C55E] text-white" :
                        row.original.status === "pending" ? "bg-[#EAB308] text-white" : "bg-[#EF4444] text-white"
                )}>
                    {row.original.status}
                </span>
            )
        }
    ], []);

    const filteredData = useMemo(() => {
        return vouchers.filter(v => {
            const date = new Date(v.rvDate);
            const matchesDate = (!fromDate || date >= fromDate) && (!toDate || date <= toDate);
            const matchesType = v.type === type;
            const matchesStatus = status === "all" || v.status === status;
            const matchesAccount = selectedAccount === "all" || v.debitAccountId === selectedAccount || v.details.some(d => d.accountId === selectedAccount);
            return matchesDate && matchesType && matchesStatus && matchesAccount;
        });
    }, [vouchers, type, fromDate, toDate, selectedAccount, status]);

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Receipt Vouchers</h2>
                    <p className="text-muted-foreground">Manage your bank and cash receipts</p>
                </div>
                <div className="flex items-center gap-2">
                    {permissions?.canCreate && (
                        <Link href="/erp/finance/receipt-voucher/create">
                            <Button>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Receipt Voucher
                            </Button>
                        </Link>
                    )}
                    <Button variant="outline">
                        <Printer className="mr-2 h-4 w-4" />
                        Print
                    </Button>
                    <Button variant="outline">
                        <Download className="mr-2 h-4 w-4" />
                        Export (xlsx)
                    </Button>
                </div>
            </div>

            <Tabs value={type} onValueChange={(val) => setType(val as "bank" | "cash")} className="w-full">
                <TabsList variant="card" className="grid w-full max-w-md grid-cols-2">
                    <TabsTrigger value="bank" className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Bank Receipt Vouchers
                    </TabsTrigger>
                    <TabsTrigger value="cash" className="flex items-center gap-2">
                        <Wallet className="h-4 w-4" />
                        Cash Receipt Vouchers
                    </TabsTrigger>
                </TabsList>

                <Card className="mt-6 border-none shadow-none bg-transparent">
                    <CardHeader className="px-0">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-xl font-bold">View {type === "bank" ? "Bank" : "Cash"} Receipt Voucher List</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="px-0 space-y-6">

                        {/* Filters */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end p-6 rounded-lg border border-slate-200 dark:border-border">
                            <div className="space-y-1.5 md:col-span-1">
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
                                    className="h-10"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Account head</Label>
                                <Autocomplete
                                    className="h-10"
                                    options={accounts.map(acc => ({ value: acc.id, label: acc.name }))}
                                    value={selectedAccount}
                                    onValueChange={setSelectedAccount}
                                    placeholder="Select Account"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Voucher Status</Label>
                                <Select value={status} onValueChange={setStatus}>
                                    <SelectTrigger className="h-10">
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
                                    View Data List
                                </Button>
                            </div>
                        </div>

                        {showFilterInfo && fromDate && toDate && (
                            <div className="text-sm font-bold italic text-slate-800 dark:text-slate-200 py-2 border-b dark:border-border">
                                {type === "bank" ? "Bank" : "Cash"} Receipt Voucher List From :
                                <span className="text-red-600 ml-1 font-mono">{format(fromDate, "dd-MM-yyyy")}</span>
                                <span className="mx-1">Between To</span>
                                <span className="text-red-600 font-mono">{format(toDate, "dd-MM-yyyy")}</span>
                            </div>
                        )}

                        <DataTable
                            columns={columns}
                            data={filteredData}
                            searchFields={[{ key: "rvNo", label: "RV Number" }, { key: "description", label: "Description" }]}
                            tableId="receipt-voucher-list"
                            onRowEdit={(item) => console.log("Edit", item)}
                            onRowDelete={(item) => console.log("Delete", item)}
                        />
                    </CardContent>
                </Card>
            </Tabs>
        </div>
    );
}
