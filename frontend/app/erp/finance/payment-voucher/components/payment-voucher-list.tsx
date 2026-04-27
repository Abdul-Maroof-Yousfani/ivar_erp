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
import { PaymentVoucher } from "@/lib/actions/payment-voucher";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import DataTable from "@/components/common/data-table";
import { ColumnDef } from "@tanstack/react-table";

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
    const [fromDate, setFromDate] = useState<Date | undefined>(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const [toDate, setToDate] = useState<Date | undefined>(new Date());
    const [selectedAccount, setSelectedAccount] = useState<string>("");
    const [status, setStatus] = useState<string>("all");
    const [vouchers, setVouchers] = useState<PaymentVoucher[]>(initialData);
    const [showFilterInfo, setShowFilterInfo] = useState(false);

    // Use initial data directly as it comes from the server
    useEffect(() => {
        setVouchers(initialData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    }, [initialData]);

    const columns = useMemo<ColumnDef<PaymentVoucher>[]>(() => [
        {
            accessorKey: "pvNo",
            header: "P.V. No.",
            cell: ({ row }) => <span className="font-mono font-medium">{row.original.pvNo}</span>
        },
        {
            accessorKey: "pvDate",
            header: "P.V. Date",
            cell: ({ row }) => format(new Date(row.original.pvDate), "dd-MM-yyyy")
        },
        {
            id: "details",
            header: "Debit/Credit",
            cell: ({ row }) => (
                <div className="space-y-1 min-w-[200px]">
                    {row.original.details.map((d, di) => (
                        <div key={di} className="flex justify-between text-xs">
                            <span className="text-blue-600 font-medium">{d.accountName}</span>
                            <span className="font-bold">{d.debit.toLocaleString()}</span>
                        </div>
                    ))}
                    <div className="flex justify-between text-xs border-t pt-1 mt-1 opacity-70 italic">
                        <span>(Cr: {row.original.creditAccountName})</span>
                        <span>{row.original.creditAmount.toLocaleString()}</span>
                    </div>
                </div>
            )
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
        }
    ], []);

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
                                    <Link href="/erp/finance/payment-voucher/create">
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
                                <Button variant="outline" size="sm">
                                    <Download className="mr-2 h-4 w-4" />
                                    Export (xlsx)
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
        </div>
    );
}
