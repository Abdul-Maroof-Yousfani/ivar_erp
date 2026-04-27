"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray, Controller, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { receiptVoucherSchema, type ReceiptVoucherFormValues } from "@/lib/validations/receipt-voucher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Autocomplete } from "@/components/ui/autocomplete";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Loader2, CreditCard, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createReceiptVoucher, getAllCustomers, getPendingInvoicesByCustomer } from "@/lib/actions/receipt-voucher";
import { ChartOfAccount } from "@/lib/actions/chart-of-account";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type InvoiceReceiptEntry = {
    salesInvoiceId: string;
    invoiceNo: string;
    grandTotal: number;
    paidAmount: number;
    balanceAmount: number;
    receivingNow: number;
};

export function ReceiptVoucherForm({ accounts }: { accounts: ChartOfAccount[] }) {
    const router = useRouter();
    const [isPending, setIsPending] = useState(false);
    const [customers, setCustomers] = useState<any[]>([]);
    const [pendingInvoices, setPendingInvoices] = useState<any[]>([]);
    const [selectedInvoices, setSelectedInvoices] = useState<InvoiceReceiptEntry[]>([]);
    const [loadingCustomers, setLoadingCustomers] = useState(true);

    const form = useForm<ReceiptVoucherFormValues>({
        resolver: zodResolver(receiptVoucherSchema) as any,
        defaultValues: {
            type: "bank",
            rvNo: "",
            rvDate: new Date(),
            refBillNo: "",
            billDate: undefined,
            chequeNo: "",
            chequeDate: undefined,
            description: "",
            customerId: "",
            invoices: [],
            details: [
                { accountId: "", debit: 0, credit: 0 },
                { accountId: "", debit: 0, credit: 0 },
            ],
        },
    });

    const { fields, append, remove } = useFieldArray({ control: form.control, name: "details" });
    const voucherType = form.watch("type");

    useEffect(() => {
        const prefix = voucherType === "bank" ? "BRV" : "CRV";
        const datePart = `${new Date().getFullYear().toString().slice(-2)}${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
        form.setValue("rvNo", `${prefix}${datePart}${Math.floor(1000 + Math.random() * 9000)}`);
    }, [voucherType, form]);

    useEffect(() => {
        getAllCustomers().then(r => {
            setCustomers(r.status ? r.data : []);
            setLoadingCustomers(false);
        });
    }, []);

    const selectedCustomerId = form.watch("customerId");
    useEffect(() => {
        if (selectedCustomerId) {
            getPendingInvoicesByCustomer(selectedCustomerId).then(r => {
                const invoicesWithBalance = (r.status ? r.data : []).filter((inv: any) => Number(inv.balanceAmount) > 0);
                setPendingInvoices(invoicesWithBalance);
            });
        } else {
            setPendingInvoices([]);
            setSelectedInvoices([]);
        }
    }, [selectedCustomerId]);

    const toggleInvoice = (invoice: any) => {
        setSelectedInvoices(prev => {
            const exists = prev.find(i => i.salesInvoiceId === invoice.id);
            if (exists) return prev.filter(i => i.salesInvoiceId !== invoice.id);
            return [...prev, {
                salesInvoiceId: invoice.id,
                invoiceNo: invoice.invoiceNo,
                grandTotal: Number(invoice.grandTotal),
                paidAmount: Number(invoice.paidAmount),
                balanceAmount: Number(invoice.balanceAmount),
                receivingNow: Number(invoice.balanceAmount),
            }];
        });
    };

    const updateReceivingNow = (id: string, value: number) => {
        setSelectedInvoices(prev => prev.map(i => i.salesInvoiceId === id ? { ...i, receivingNow: value } : i));
    };

    const totalInvoiceReceipts = selectedInvoices.reduce((s, i) => s + (i.receivingNow || 0), 0);

    const watchDetails = form.watch("details") || [];
    const totalDebit = watchDetails.reduce((sum, detail) => sum + (Number(detail.debit) || 0), 0);
    const totalCredit = watchDetails.reduce((sum, detail) => sum + (Number(detail.credit) || 0), 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

    const onSubmit: SubmitHandler<ReceiptVoucherFormValues> = async (values) => {
        try {
            setIsPending(true);
            
            console.log('Form submission started');
            console.log('Form values:', values);

            if (selectedInvoices.length > 0 && totalInvoiceReceipts > totalDebit + 0.01) {
                toast.error(`Invoice receipts (${totalInvoiceReceipts.toLocaleString()}) exceed voucher debit (${totalDebit.toLocaleString()})`);
                return;
            }

            // Find debit account and amount from details
            const debitEntry = watchDetails.find(detail => Number(detail.debit) > 0);
            if (!debitEntry || !debitEntry.accountId) {
                toast.error('Please select a debit account (Bank/Cash account) and enter amount');
                return;
            }

            const finalData = {
                ...values,
                debitAccountId: debitEntry.accountId,
                debitAmount: totalDebit,
                details: watchDetails
                    .filter(detail => Number(detail.credit) > 0)
                    .map(detail => ({
                        accountId: detail.accountId,
                        credit: Number(detail.credit)
                    })),
                invoices: selectedInvoices.length > 0
                    ? selectedInvoices.map(i => ({ salesInvoiceId: i.salesInvoiceId, receivedAmount: i.receivingNow }))
                    : undefined,
            };

            console.log('Final data being sent:', finalData);

            const result = await createReceiptVoucher(finalData);
            
            console.log('API result:', result);

            if (result.status) {
                toast.success(result.message);
                router.push("/erp/finance/receipt-voucher/list");
            } else {
                toast.error(result.message);
            }
        } catch (error) {
            console.error('Form submission error:', error);
            toast.error("An unexpected error occurred");
        } finally {
            setIsPending(false);
        }
    };

    return (
        <Card className="w-full">
            <CardHeader className="border-b flex flex-row items-center justify-between">
                <CardTitle>Create {voucherType === "bank" ? "Bank" : "Cash"} Receipt Voucher</CardTitle>
                <Tabs value={voucherType} onValueChange={(val) => form.setValue("type", val as "bank" | "cash")} className="w-[300px]">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="bank"><CreditCard className="h-4 w-4 mr-2" />Bank</TabsTrigger>
                        <TabsTrigger value="cash"><Wallet className="h-4 w-4 mr-2" />Cash</TabsTrigger>
                    </TabsList>
                </Tabs>
            </CardHeader>
            <CardContent className="pt-6">
                <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-8">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground uppercase font-semibold">RV No</Label>
                            <Input {...form.register("rvNo")} disabled className="bg-muted font-medium" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground uppercase font-semibold">RV Date</Label>
                            <Controller control={form.control} name="rvDate" render={({ field }) => (
                                <DatePicker value={field.value ? field.value.toISOString().split('T')[0] : ""} onChange={(d) => field.onChange(new Date(d))} />
                            )} />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground uppercase font-semibold">Ref / Bill No.</Label>
                            <Input {...form.register("refBillNo")} placeholder="-" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground uppercase font-semibold">Bill Date</Label>
                            <Controller control={form.control} name="billDate" render={({ field }) => (
                                <DatePicker value={field.value ? field.value.toISOString().split('T')[0] : ""} onChange={(d) => field.onChange(new Date(d))} />
                            )} />
                        </div>
                    </div>


                    {voucherType === "bank" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-lg border border-dashed border-primary/20">
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground uppercase font-semibold">Cheque No</Label>
                                <Input {...form.register("chequeNo")} placeholder="Enter Cheque No" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground uppercase font-semibold">Cheque Date</Label>
                                <Controller control={form.control} name="chequeDate" render={({ field }) => (
                                    <DatePicker value={field.value ? field.value.toISOString().split('T')[0] : ""} onChange={(d) => field.onChange(new Date(d))} />
                                )} />
                            </div>
                        </div>
                    )}

                    <div className="space-y-4 p-4 rounded-lg border border-dashed border-primary/20">
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground uppercase font-semibold">Customer <span className="font-normal normal-case">(optional)</span></Label>
                            <Controller control={form.control} name="customerId" render={({ field }) => (
                                <Autocomplete
                                    options={customers.map(c => ({ value: c.id, label: `${c.code} - ${c.name}` }))}
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    placeholder={loadingCustomers ? "Loading customers..." : "Select Customer (Optional)"}
                                    disabled={loadingCustomers}
                                />
                            )} />
                        </div>

                        {selectedCustomerId && (
                            <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground uppercase font-semibold">
                                    Sales Invoices
                                    <span className="ml-2 font-normal normal-case text-muted-foreground">(check to receive payment — leave blank for advance receipt)</span>
                                </Label>

                                {pendingInvoices.length === 0 ? (
                                    <p className="text-xs text-amber-500 py-2">No pending invoices — receipt will be recorded as advance against this customer.</p>
                                ) : (
                                    <div className="rounded-lg border border-border overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-muted text-muted-foreground">
                                                <tr>
                                                    <th className="px-3 py-2 text-left w-8"></th>
                                                    <th className="px-3 py-2 text-left">Invoice No</th>
                                                    <th className="px-3 py-2 text-right">Total</th>
                                                    <th className="px-3 py-2 text-right">Paid</th>
                                                    <th className="px-3 py-2 text-right">Balance</th>
                                                    <th className="px-3 py-2 text-right w-36">Receiving Now</th>
                                                    <th className="px-3 py-2 text-center w-20">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-border">
                                                {pendingInvoices.map((inv: any) => {
                                                    const entry = selectedInvoices.find(i => i.salesInvoiceId === inv.id);
                                                    const isChecked = !!entry;
                                                    const receivingNow = entry?.receivingNow ?? 0;
                                                    const willBeFullyPaid = isChecked && Math.abs(receivingNow - Number(inv.balanceAmount)) < 0.01;
                                                    return (
                                                        <tr key={inv.id} className={isChecked ? "bg-primary/5" : "hover:bg-muted/30"}>
                                                            <td className="px-3 py-2">
                                                                <Checkbox checked={isChecked} onCheckedChange={() => toggleInvoice(inv)} />
                                                            </td>
                                                            <td className="px-3 py-2 font-medium">{inv.invoiceNo}</td>
                                                            <td className="px-3 py-2 text-right tabular-nums">{Number(inv.grandTotal).toLocaleString()}</td>
                                                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{Number(inv.paidAmount).toLocaleString()}</td>
                                                            <td className="px-3 py-2 text-right tabular-nums font-semibold text-red-500">{Number(inv.balanceAmount).toLocaleString()}</td>
                                                            <td className="px-3 py-2">
                                                                <Input
                                                                    type="number" step="0.01" min={0} max={Number(inv.balanceAmount)}
                                                                    value={isChecked ? receivingNow : ""}
                                                                    disabled={!isChecked || Number(inv.balanceAmount) <= 0}
                                                                    onChange={e => updateReceivingNow(inv.id, Number(e.target.value))}
                                                                    className="h-8 text-right font-mono text-sm"
                                                                />
                                                            </td>
                                                            <td className="px-3 py-2 text-center">
                                                                {isChecked && (
                                                                    <Badge variant={willBeFullyPaid ? "default" : "secondary"} className="text-[10px]">
                                                                        {willBeFullyPaid ? "Full" : "Partial"}
                                                                    </Badge>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            {selectedInvoices.length > 0 && (
                                                <tfoot className="border-t border-border bg-muted/50 font-semibold text-sm">
                                                    <tr>
                                                        <td colSpan={5} className="px-3 py-2 text-right text-muted-foreground">Total invoice receipts:</td>
                                                        <td className={`px-3 py-2 text-right tabular-nums font-mono ${totalInvoiceReceipts > totalDebit + 0.01 ? "text-red-500" : "text-green-600"}`}>
                                                            {totalInvoiceReceipts.toLocaleString()}
                                                        </td>
                                                        <td />
                                                    </tr>
                                                </tfoot>
                                            )}
                                        </table>
                                    </div>
                                )}

                                {totalInvoiceReceipts > totalDebit + 0.01 && (
                                    <p className="text-xs text-red-500 font-medium">
                                        ⚠ Invoice receipts ({totalInvoiceReceipts.toLocaleString()}) exceed voucher debit ({totalDebit.toLocaleString()}).
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="space-y-4 pt-4">
                        <div className="flex items-center justify-between border-b pb-2">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800 dark:text-foreground">{voucherType === "bank" ? "Bank" : "Cash"} Receipt Voucher Detail</h2>
                                <p className="text-xs text-muted-foreground mt-0.5">Debit: <span className="font-mono font-semibold">Bank / Cash account</span> &nbsp;|&nbsp; Credit: <span className="font-mono font-semibold">A/R PARTIES</span></p>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => append({ accountId: "", debit: 0, credit: 0 })}
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add More RV Rows
                                </Button>
                            </div>
                        </div>

                        <div className="border rounded-lg overflow-hidden border-gray-200 dark:border-border">
                            <table className="w-full text-sm">
                                <thead className="dark:bg-muted text-foreground border-b font-bold">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Account Head</th>
                                        <th className="px-4 py-3 text-left w-[180px]">Debit</th>
                                        <th className="px-4 py-3 text-left w-[180px]">Credit</th>
                                        <th className="px-4 py-3 text-center w-[80px]">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {fields.map((field, index) => (
                                        <tr key={field.id} className="hover:bg-gray-50/50 dark:hover:bg-muted/50">
                                            <td className="px-4 py-3">
                                                <Controller
                                                    control={form.control}
                                                    name={`details.${index}.accountId`}
                                                    render={({ field }) => (
                                                        <Autocomplete
                                                            options={accounts.map((acc) => ({
                                                                value: acc.id,
                                                                label: `${acc.code} - ${acc.name}`,
                                                            }))}
                                                            value={field.value}
                                                            onValueChange={field.onChange}
                                                            placeholder="Select Account"
                                                            disabled={isPending}
                                                            className="h-10 border-gray-300 dark:border-input"
                                                        />
                                                    )}
                                                />
                                                {form.formState.errors.details?.[index]?.accountId && (
                                                    <p className="text-[10px] text-destructive mt-1">
                                                        {form.formState.errors.details[index].accountId?.message}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="0"
                                                    {...form.register(`details.${index}.debit`, {
                                                        valueAsNumber: true,
                                                        onChange: (e) => {
                                                            if (Number(e.target.value) > 0) {
                                                                form.setValue(`details.${index}.credit`, 0, { shouldValidate: true });
                                                            }
                                                        }
                                                    })}
                                                    disabled={isPending}
                                                    className="h-10 border-gray-300 dark:border-input font-medium"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                <Input
                                                    type="number"
                                                    step="0.01"
                                                    placeholder="0"
                                                    {...form.register(`details.${index}.credit`, {
                                                        valueAsNumber: true,
                                                        onChange: (e) => {
                                                            if (Number(e.target.value) > 0) {
                                                                form.setValue(`details.${index}.debit`, 0, { shouldValidate: true });
                                                            }
                                                        }
                                                    })}
                                                    disabled={isPending}
                                                    className="h-10 border-gray-300 dark:border-input font-medium"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                {fields.length > 2 ? (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => remove(index)}
                                                        disabled={isPending}
                                                        className="rounded-full"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                ) : (
                                                    <span className="text-gray-300">---</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="font-bold border-t border-gray-200 dark:border-border">
                                    <tr>
                                        <td className="px-4 py-4 text-right pr-8 text-gray-600 dark:text-muted-foreground">Totals:</td>
                                        <td className="px-4 py-4 text-right text-lg">
                                            {totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-4 text-right text-lg">
                                            {totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            {!isBalanced && totalDebit > 0 && (
                                                <div className="mx-auto w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" title="Out of Balance" />
                                            )}
                                            {isBalanced && totalDebit > 0 && (
                                                <div className="mx-auto w-2.5 h-2.5 rounded-full bg-green-500" title="Balanced" />
                                            )}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        {form.formState.errors.details?.root && (
                            <p className="text-sm text-destructive font-medium">{form.formState.errors.details.root.message}</p>
                        )}
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground uppercase font-semibold">Description</Label>
                        <Textarea {...form.register("description")} placeholder="Enter description for this receipt voucher" />
                        {form.formState.errors.description && (
                            <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>
                        )}
                    </div>

                    <div className="flex justify-center pt-6 border-t">
                        <Button type="submit" disabled={isPending || !isBalanced}>
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Receipt Voucher
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}