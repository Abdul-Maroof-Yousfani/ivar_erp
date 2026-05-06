"use client";

import { useState, useEffect } from "react";
import { useForm, useFieldArray, Controller, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { paymentVoucherSchema, type PaymentVoucherFormValues } from "@/lib/validations/payment-voucher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Autocomplete } from "@/components/ui/autocomplete";
import { Plus, Trash2, Loader2, CreditCard, Wallet } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createPaymentVoucher, getPendingInvoicesBySupplier, getAllSuppliers, getVendorWithAccounts, getAdvancesBySupplier, getSupplierSummary } from "@/lib/actions/payment-voucher";
import { ChartOfAccount } from "@/lib/actions/chart-of-account";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";

// Per-invoice payment entry managed outside the form
type InvoicePaymentEntry = {
    purchaseInvoiceId: string;
    invoiceNumber: string;
    totalAmount: number;
    paidAmount: number;       // already paid before this voucher
    remainingAmount: number;  // outstanding before this voucher
    payingNow: number;        // what the user wants to pay in this voucher
};

type AdvanceEntry = {
    pvId: string;
    pvNo: string;
    pvDate: string;
    totalAmount: number;
    availableAmount: number;
    applyingNow: number;
};

export function PaymentVoucherForm({ accounts }: { 
    accounts: ChartOfAccount[]; 
}) {
    const router = useRouter();
    const [isPending, setIsPending] = useState(false);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [pendingInvoices, setPendingInvoices] = useState<any[]>([]);
    const [selectedInvoices, setSelectedInvoices] = useState<InvoicePaymentEntry[]>([]);
    const [availableAdvances, setAvailableAdvances] = useState<any[]>([]);
    const [selectedAdvances, setSelectedAdvances] = useState<AdvanceEntry[]>([]);
    const [supplierSummary, setSupplierSummary] = useState<{ apBalance: number; advanceBalance: number } | null>(null);
    const [loadingSuppliers, setLoadingSuppliers] = useState(true);
    const [suppliersError, setSuppliersError] = useState<string>("");

    const form = useForm<PaymentVoucherFormValues>({
        resolver: zodResolver(paymentVoucherSchema) as any,
        defaultValues: {
            type: "bank",
            isAdvance: false,
            pvNo: "",
            pvDate: new Date(),
            refBillNo: "",
            billDate: undefined,
            chequeNo: "",
            chequeDate: undefined,
            creditAccountId: "",
            creditAmount: 0,
            supplierId: "",
            invoices: [],
            isTaxApplicable: false,
            description: "",
            details: [
                { accountId: "", debit: 0, credit: 0 },
                { accountId: "", debit: 0, credit: 0 },
            ],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "details",
    });

    const voucherType = form.watch("type");

    // Load ALL suppliers on mount (advance payments don't require a pending invoice)
    useEffect(() => {
        const loadSuppliers = async () => {
            setLoadingSuppliers(true);
            setSuppliersError("");
            const result = await getAllSuppliers();
            if (result.status) {
                setSuppliers(result.data);
            } else {
                setSuppliers([]);
                setSuppliersError(result.error || "Failed to load suppliers");
            }
            setLoadingSuppliers(false);
        };
        loadSuppliers();
    }, []);

    // Auto-generate PV No based on type
    useEffect(() => {
        const prefix = voucherType === "bank" ? "BPV" : "CPV";
        const datePart = `${new Date().getFullYear().toString().slice(-2)}${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
        const randomPart = Math.floor(1000 + Math.random() * 9000);
        form.setValue("pvNo", `${prefix}${datePart}${randomPart}`);
    }, [voucherType, form]);

    // Load pending invoices + available advances when supplier changes
    const selectedSupplierId = form.watch("supplierId");
    useEffect(() => {
        if (selectedSupplierId) {
            getPendingInvoicesBySupplier(selectedSupplierId).then(result => {
                setPendingInvoices(result.status ? result.data : []);
            });
            getAdvancesBySupplier(selectedSupplierId).then(result => {
                setAvailableAdvances(result.status ? result.data : []);
            });
            getSupplierSummary(selectedSupplierId).then(result => {
                setSupplierSummary(result.status ? result.data : null);
            });
        } else {
            setPendingInvoices([]);
            setSelectedInvoices([]);
            setAvailableAdvances([]);
            setSelectedAdvances([]);
            setSupplierSummary(null);
            form.setValue("creditAmount", 0);
        }
    }, [selectedSupplierId, form]);

    // When supplier changes, fetch their linked chart of accounts and pre-fill debit rows
    useEffect(() => {
        if (!selectedSupplierId) return;
        getVendorWithAccounts(selectedSupplierId).then(res => {
            if (res.status && res.data?.chartOfAccounts?.length > 0) {
                const linkedAccounts: { id: string }[] = res.data.chartOfAccounts;
                const currentRows = form.getValues("details").length;
                if (linkedAccounts.length === 1) {
                    form.setValue("details.0.accountId", linkedAccounts[0].id);
                } else {
                    linkedAccounts.forEach((acc, i) => {
                        if (i < currentRows) {
                            form.setValue(`details.${i}.accountId`, acc.id);
                            form.setValue(`details.${i}.debit`, 0);
                            form.setValue(`details.${i}.credit`, 0);
                        } else {
                            append({ accountId: acc.id, debit: 0, credit: 0 });
                        }
                    });
                }
            }
        });
    }, [selectedSupplierId, form, append]);

    // Toggle an invoice in/out of the selected list
    const toggleInvoice = (invoice: any) => {
        setSelectedInvoices(prev => {
            const exists = prev.find(i => i.purchaseInvoiceId === invoice.id);
            if (exists) return prev.filter(i => i.purchaseInvoiceId !== invoice.id);
            return [...prev, {
                purchaseInvoiceId: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                totalAmount: Number(invoice.totalAmount),
                paidAmount: Number(invoice.paidAmount),
                remainingAmount: Number(invoice.remainingAmount),
                payingNow: Number(invoice.remainingAmount),
            }];
        });
    };

    const updatePayingNow = (invoiceId: string, value: number) => {
        setSelectedInvoices(prev =>
            prev.map(i => i.purchaseInvoiceId === invoiceId ? { ...i, payingNow: value } : i)
        );
    };

    const toggleAdvance = (adv: any) => {
        setSelectedAdvances(prev => {
            const exists = prev.find(a => a.pvId === adv.pvId);
            if (exists) return prev.filter(a => a.pvId !== adv.pvId);
            return [...prev, { ...adv, applyingNow: adv.availableAmount }];
        });
    };

    const updateApplyingNow = (pvId: string, value: number) => {
        setSelectedAdvances(prev =>
            prev.map(a => a.pvId === pvId ? { ...a, applyingNow: value } : a)
        );
    };

    const totalInvoicePayments = selectedInvoices.reduce((s, i) => s + (i.payingNow || 0), 0);
    const totalAdvanceApplied = selectedAdvances.reduce((s, a) => s + (a.applyingNow || 0), 0);

    const onSubmit: SubmitHandler<PaymentVoucherFormValues> = async (values) => {
        try {
            setIsPending(true);

            const totalDebit = watchDetails.reduce((sum, detail) => sum + (Number(detail.debit) || 0), 0);
            const totalCredit = watchDetails.reduce((sum, detail) => sum + (Number(detail.credit) || 0), 0);
            const totalSettled = totalDebit + totalAdvanceApplied;

            if (selectedInvoices.length > 0 && totalInvoicePayments > totalSettled + 0.01) {
                toast.error(`Invoice payments (${totalInvoicePayments.toLocaleString()}) exceed cash (${totalDebit.toLocaleString()}) + advance (${totalAdvanceApplied.toLocaleString()}) = ${totalSettled.toLocaleString()}`);
                return;
            }

            const creditAccountEntry = watchDetails.find(detail => Number(detail.credit) > 0);
            const mainCreditAccountId = creditAccountEntry?.accountId || "";

            const finalSubmitData = {
                ...values,
                creditAccountId: mainCreditAccountId || values.creditAccountId,
                creditAmount: totalCredit || values.creditAmount,
                invoices: selectedInvoices.length > 0
                    ? selectedInvoices.map(i => ({ purchaseInvoiceId: i.purchaseInvoiceId, paidAmount: i.payingNow }))
                    : undefined,
                advanceApplications: selectedAdvances.length > 0
                    ? selectedAdvances.map(a => ({ advanceVoucherId: a.pvId, appliedAmount: a.applyingNow }))
                    : undefined,
            };

            const result = await createPaymentVoucher(finalSubmitData);
            if (result.status) {
                toast.success(result.message);
                router.push("/finance/payment-voucher/list");
            } else {
                toast.error(result.message);
            }
        } catch (error) {
            toast.error("An unexpected error occurred");
        } finally {
            setIsPending(false);
        }
    };

    // Watch for changes in detail rows to auto-balance
    const watchDetails = form.watch("details") || [];
    useEffect(() => {
        // Calculate total debit from all rows
        const totalDebit = watchDetails.reduce((sum, detail) => sum + (Number(detail.debit) || 0), 0);
        
        // Find the first row with debit amount (supplier row)
        const supplierRowIndex = watchDetails.findIndex(detail => Number(detail.debit) > 0);
        
        // Find the second row with account selected but no debit (bank/company row)
        const bankRowIndex = watchDetails.findIndex((detail, index) => 
            index !== supplierRowIndex && 
            detail.accountId && 
            Number(detail.debit) === 0
        );
        
        // If we have a supplier debit and a bank account selected, auto-fill credit
        if (supplierRowIndex >= 0 && bankRowIndex >= 1) {
            const supplierDebitAmount = Number(watchDetails[supplierRowIndex].debit);
            const currentBankCredit = Number(watchDetails[bankRowIndex].credit) || 0;
            
            if (supplierDebitAmount > 0 && currentBankCredit !== supplierDebitAmount) {
                // Auto-fill the credit amount in the bank row
                form.setValue(`details.${bankRowIndex}.credit`, supplierDebitAmount);
                form.setValue(`details.${bankRowIndex}.debit`, 0);
                console.log(`Auto-filled bank row credit: ${supplierDebitAmount}`);
            }
        }
    }, [watchDetails, form]);

    const totalDebit = watchDetails.reduce((sum, detail) => sum + (Number(detail.debit) || 0), 0);
    const totalCredit = watchDetails.reduce((sum, detail) => sum + (Number(detail.credit) || 0), 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

    return (
        <Card className="w-full">
            <CardHeader className="border-b flex flex-row items-center justify-between">
                <CardTitle>{voucherType === "bank" ? "Create Bank Payment Voucher Form" : "Create Cash Payment Voucher Form"}</CardTitle>
                <Tabs value={voucherType} onValueChange={(val) => form.setValue("type", val as "bank" | "cash")} className="w-[300px]">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="bank" className="flex items-center gap-2">
                            <CreditCard className="h-4 w-4" />
                            Bank
                        </TabsTrigger>
                        <TabsTrigger value="cash" className="flex items-center gap-2">
                            <Wallet className="h-4 w-4" />
                            Cash
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </CardHeader>
            <CardContent className="pt-6">
                <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-8">

                    {/* ── Advance Payment toggle + guidance ── */}
                    <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
                        <div className="flex items-center space-x-2">
                            <Controller
                                control={form.control}
                                name="isAdvance"
                                render={({ field }) => (
                                    <Checkbox
                                        id="isAdvance"
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                    />
                                )}
                            />
                            <Label htmlFor="isAdvance" className="text-sm font-semibold leading-none cursor-pointer">
                                Advance Payment
                                <span className="ml-2 font-normal text-muted-foreground">(paying before a purchase invoice exists)</span>
                            </Label>
                        </div>

                        {form.watch("isAdvance") ? (
                            <div className="rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-3 text-xs space-y-1.5">
                                <p className="font-semibold text-blue-800 dark:text-blue-300">✦ Advance Payment — account heads to use:</p>
                                <div className="grid grid-cols-2 gap-2 mt-1">
                                    <div className="bg-white dark:bg-blue-950/40 rounded p-2 border border-blue-100 dark:border-blue-800">
                                        <p className="font-bold text-blue-700 dark:text-blue-400">Row 1 — Debit</p>
                                        <p className="text-blue-900 dark:text-blue-200 font-mono">31030004 – ADVANCE TO SUPPLIERS</p>
                                        <p className="text-muted-foreground mt-0.5">Records the prepayment as an asset</p>
                                    </div>
                                    <div className="bg-white dark:bg-blue-950/40 rounded p-2 border border-blue-100 dark:border-blue-800">
                                        <p className="font-bold text-blue-700 dark:text-blue-400">Row 2 — Credit</p>
                                        <p className="text-blue-900 dark:text-blue-200 font-mono">Bank / Cash account</p>
                                        <p className="text-muted-foreground mt-0.5">Money leaving your bank or cash</p>
                                    </div>
                                </div>
                                <p className="text-muted-foreground pt-1">Leave invoices unchecked. When the PI arrives later, create a new PV, select the supplier — this advance will appear in the green table to apply against it.</p>
                            </div>
                        ) : (
                            <div className="rounded-md bg-muted/40 border border-border p-3 text-xs space-y-1.5">
                                <p className="font-semibold text-foreground">✦ Regular Payment — account heads to use:</p>
                                <div className="grid grid-cols-2 gap-2 mt-1">
                                    <div className="bg-background rounded p-2 border border-border">
                                        <p className="font-bold">Row 1 — Debit</p>
                                        <p className="font-mono text-muted-foreground">12030001 – A/P PARTIES</p>
                                        <p className="text-muted-foreground mt-0.5">Clears the supplier payable</p>
                                    </div>
                                    <div className="bg-background rounded p-2 border border-border">
                                        <p className="font-bold">Row 2 — Credit</p>
                                        <p className="font-mono text-muted-foreground">Bank / Cash account</p>
                                        <p className="text-muted-foreground mt-0.5">Only the cash portion (can be 0 if fully from advance)</p>
                                    </div>
                                </div>
                                <p className="text-muted-foreground pt-1">If you have an existing advance for this supplier, it will appear in the green table above the invoices — check it to apply it. The system posts the reversal journal automatically.</p>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground uppercase font-semibold">PV No</Label>
                            <Input {...form.register("pvNo")} disabled className="bg-muted font-medium" />
                        </div>

                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground uppercase font-semibold">PV Date</Label>
                            <Controller
                                control={form.control}
                                name="pvDate"
                                render={({ field }) => (
                                    <DatePicker
                                        value={field.value ? field.value.toISOString().split('T')[0] : ""}
                                        onChange={(date) => field.onChange(new Date(date))}
                                    />
                                )}
                            />
                        </div>

                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground uppercase font-semibold">Ref / Bill No.</Label>
                            <Input {...form.register("refBillNo")} placeholder="-" />
                        </div>

                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground uppercase font-semibold">Bill Date</Label>
                            <Controller
                                control={form.control}
                                name="billDate"
                                render={({ field }) => (
                                    <DatePicker
                                        value={field.value ? field.value.toISOString().split('T')[0] : ""}
                                        onChange={(date) => field.onChange(new Date(date))}
                                    />
                                )}
                            />
                        </div>
                    </div>

                    <div className="space-y-4 p-4 rounded-lg border border-dashed border-primary/20">
                        {/* Supplier selector */}
                        <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground uppercase font-semibold">Supplier</Label>
                            <Controller
                                control={form.control}
                                name="supplierId"
                                render={({ field }) => (
                                    <Autocomplete
                                        options={suppliers.map(supplier => ({ 
                                            value: supplier.id, 
                                            label: `${supplier.code || supplier.name} - ${supplier.name}` 
                                        }))}
                                        value={field.value}
                                        onValueChange={field.onChange}
                                        placeholder={loadingSuppliers ? "Loading suppliers..." : "Select Supplier (Optional)"}
                                        disabled={loadingSuppliers}
                                    />
                                )}
                            />
                            {suppliersError && <p className="text-xs text-amber-600">{suppliersError}</p>}

                            {/* Supplier balance summary — shown immediately on selection */}
                            {selectedSupplierId && supplierSummary && (
                                <div className="flex items-center gap-3 mt-2 flex-wrap">
                                    <div className="flex items-center gap-1.5 rounded-md bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 px-3 py-1.5">
                                        <span className="text-xs text-muted-foreground">Outstanding AP:</span>
                                        <span className="text-sm font-bold tabular-nums text-red-600">
                                            {supplierSummary.apBalance.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 border ${supplierSummary.advanceBalance > 0 ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800" : "bg-muted border-border"}`}>
                                        <span className="text-xs text-muted-foreground">Advance Available:</span>
                                        <span className={`text-sm font-bold tabular-nums ${supplierSummary.advanceBalance > 0 ? "text-green-600" : "text-muted-foreground"}`}>
                                            {supplierSummary.advanceBalance.toLocaleString()}
                                        </span>
                                        {supplierSummary.advanceBalance > 0 && (
                                            <span className="text-[10px] text-green-600 font-medium">← can apply</span>
                                        )}
                                    </div>
                                </div>
                            )}
                            {selectedSupplierId && !supplierSummary && (
                                <div className="flex items-center gap-2 mt-2">
                                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">Loading supplier balance...</span>
                                </div>
                            )}
                        </div>

                        {/* Invoice checklist — shown once a supplier is selected */}
                        {selectedSupplierId && (
                            <div className="space-y-4">

                                {/* ── Available Advances — always visible when supplier has advances ── */}
                                {availableAdvances.length > 0 && (
                                    <div className="space-y-2">
                                        <Label className="text-xs text-muted-foreground uppercase font-semibold flex items-center gap-2">
                                            <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                                            Available Advance Payments
                                            <span className="font-normal normal-case text-muted-foreground">
                                                — check to apply toward this payment
                                            </span>
                                        </Label>
                                        <div className="rounded-lg border border-green-200 dark:border-green-900 overflow-hidden">
                                            <table className="w-full text-sm">
                                                <thead className="bg-green-50 dark:bg-green-950/30 text-muted-foreground">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left w-8"></th>
                                                        <th className="px-3 py-2 text-left">Advance PV</th>
                                                        <th className="px-3 py-2 text-left">Date</th>
                                                        <th className="px-3 py-2 text-right">Total Advance</th>
                                                        <th className="px-3 py-2 text-right">Available</th>
                                                        <th className="px-3 py-2 text-right w-36">Applying Now</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border">
                                                    {availableAdvances.map((adv: any) => {
                                                        const entry = selectedAdvances.find(a => a.pvId === adv.pvId);
                                                        const isChecked = !!entry;
                                                        return (
                                                            <tr key={adv.pvId} className={isChecked ? "bg-green-50/50 dark:bg-green-950/20" : "hover:bg-muted/30"}>
                                                                <td className="px-3 py-2">
                                                                    <Checkbox checked={isChecked} onCheckedChange={() => toggleAdvance(adv)} />
                                                                </td>
                                                                <td className="px-3 py-2 font-medium">{adv.pvNo}</td>
                                                                <td className="px-3 py-2 text-muted-foreground text-xs">{new Date(adv.pvDate).toLocaleDateString()}</td>
                                                                <td className="px-3 py-2 text-right tabular-nums">{Number(adv.totalAmount).toLocaleString()}</td>
                                                                <td className="px-3 py-2 text-right tabular-nums font-semibold text-green-600">{Number(adv.availableAmount).toLocaleString()}</td>
                                                                <td className="px-3 py-2">
                                                                    <Input
                                                                        type="number" step="0.01" min={0.01} max={adv.availableAmount}
                                                                        value={isChecked ? entry!.applyingNow : ""}
                                                                        disabled={!isChecked}
                                                                        onChange={e => updateApplyingNow(adv.pvId, Number(e.target.value))}
                                                                        className="h-8 text-right font-mono text-sm"
                                                                    />
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                                {selectedAdvances.length > 0 && (
                                                    <tfoot className="border-t border-border bg-green-50/50 dark:bg-green-950/20 font-semibold text-sm">
                                                        <tr>
                                                            <td colSpan={5} className="px-3 py-2 text-right text-muted-foreground">Total advance being applied:</td>
                                                            <td className="px-3 py-2 text-right tabular-nums font-mono text-green-600">{totalAdvanceApplied.toLocaleString()}</td>
                                                        </tr>
                                                    </tfoot>
                                                )}
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* ── Purchase Invoices ── */}
                                <div className="space-y-2">
                                    <Label className="text-xs text-muted-foreground uppercase font-semibold">
                                        Purchase Invoices
                                        <span className="ml-2 font-normal normal-case text-muted-foreground">
                                            (check to include — leave all unchecked for advance payment)
                                        </span>
                                    </Label>

                                    {pendingInvoices.length === 0 ? (
                                        <p className="text-xs text-amber-500 py-2">
                                            No pending invoices — payment will be recorded as advance
                                        </p>
                                    ) : (
                                        <div className="rounded-lg border border-border overflow-hidden">
                                            <table className="w-full text-sm">
                                                <thead className="bg-muted text-muted-foreground">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left w-8"></th>
                                                        <th className="px-3 py-2 text-left">Invoice No</th>
                                                        <th className="px-3 py-2 text-right">Total</th>
                                                        <th className="px-3 py-2 text-right">Already Paid</th>
                                                        <th className="px-3 py-2 text-right">Outstanding</th>
                                                        <th className="px-3 py-2 text-right w-36">Paying Now</th>
                                                        <th className="px-3 py-2 text-center w-20">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border">
                                                    {pendingInvoices.map(invoice => {
                                                        const entry = selectedInvoices.find(i => i.purchaseInvoiceId === invoice.id);
                                                        const isChecked = !!entry;
                                                        const payingNow = entry?.payingNow ?? 0;
                                                        const totalSettled = totalDebit + totalAdvanceApplied;
                                                        const willBeFullyPaid = isChecked && Math.abs(payingNow - Number(invoice.remainingAmount)) < 0.01;
                                                        return (
                                                            <tr key={invoice.id} className={isChecked ? "bg-primary/5" : "hover:bg-muted/30"}>
                                                                <td className="px-3 py-2">
                                                                    <Checkbox checked={isChecked} onCheckedChange={() => toggleInvoice(invoice)} />
                                                                </td>
                                                                <td className="px-3 py-2 font-medium">{invoice.invoiceNumber}</td>
                                                                <td className="px-3 py-2 text-right tabular-nums">{Number(invoice.totalAmount).toLocaleString()}</td>
                                                                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{Number(invoice.paidAmount).toLocaleString()}</td>
                                                                <td className="px-3 py-2 text-right tabular-nums font-semibold text-red-500">{Number(invoice.remainingAmount).toLocaleString()}</td>
                                                                <td className="px-3 py-2">
                                                                    <Input
                                                                        type="number" step="0.01" min={0.01} max={Number(invoice.remainingAmount)}
                                                                        value={isChecked ? payingNow : ""}
                                                                        disabled={!isChecked}
                                                                        onChange={e => updatePayingNow(invoice.id, Number(e.target.value))}
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
                                                            <td colSpan={5} className="px-3 py-2 text-right text-muted-foreground">Total invoice payments:</td>
                                                            <td className={`px-3 py-2 text-right tabular-nums font-mono ${totalInvoicePayments > totalDebit + totalAdvanceApplied + 0.01 ? "text-red-500" : "text-green-600"}`}>
                                                                {totalInvoicePayments.toLocaleString()}
                                                            </td>
                                                            <td />
                                                        </tr>
                                                    </tfoot>
                                                )}
                                            </table>
                                        </div>
                                    )}

                                    {selectedInvoices.length === 0 && pendingInvoices.length > 0 && (
                                        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                                            <p className="text-sm text-amber-700 dark:text-amber-300">
                                                ⚡ No invoices selected — payment will be recorded as advance against this supplier.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* ── Payment breakdown summary ── */}
                                {(selectedInvoices.length > 0 || selectedAdvances.length > 0) && (
                                    <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5 text-sm">
                                        <p className="font-semibold text-xs uppercase text-muted-foreground mb-2">Payment Breakdown</p>
                                        {selectedAdvances.length > 0 && (
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">From advance(s):</span>
                                                <span className="font-mono font-semibold text-green-600">{totalAdvanceApplied.toLocaleString()}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">From {voucherType} ({voucherType === "bank" ? "cheque/transfer" : "cash"}):</span>
                                            <span className="font-mono font-semibold">{totalDebit.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between border-t border-border pt-1.5 font-bold">
                                            <span>Total settled:</span>
                                            <span className={`font-mono ${totalInvoicePayments > totalDebit + totalAdvanceApplied + 0.01 ? "text-red-500" : "text-primary"}`}>
                                                {(totalDebit + totalAdvanceApplied).toLocaleString()}
                                            </span>
                                        </div>
                                        {selectedInvoices.length > 0 && totalInvoicePayments > totalDebit + totalAdvanceApplied + 0.01 && (
                                            <p className="text-xs text-red-500 font-medium pt-1">
                                                ⚠ Still short by {(totalInvoicePayments - totalDebit - totalAdvanceApplied).toLocaleString()} — increase the {voucherType} payment or apply more advance.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {voucherType === "bank" && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-lg border border-dashed border-primary/20">
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground uppercase font-semibold">Cheque No</Label>
                                <Input {...form.register("chequeNo")} placeholder="Enter Cheque No" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground uppercase font-semibold">Cheque Date</Label>
                                <Controller
                                    control={form.control}
                                    name="chequeDate"
                                    render={({ field }) => (
                                        <DatePicker
                                            value={field.value ? field.value.toISOString().split('T')[0] : ""}
                                            onChange={(date) => field.onChange(new Date(date))}
                                        />
                                    )}
                                />
                            </div>
                        </div>
                    )}



                    <div className="space-y-4 pt-4">
                        <div className="flex items-center justify-between border-b pb-2">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800 dark:text-foreground">{voucherType === "bank" ? "Bank" : "Cash"} Payment Voucher Detail</h2>
                                {form.watch("isAdvance") ? (
                                    <p className="text-xs text-muted-foreground mt-0.5">Debit: <span className="font-mono font-semibold">31030004 – ADVANCE TO SUPPLIERS</span> &nbsp;|&nbsp; Credit: <span className="font-mono font-semibold">Bank / Cash account</span></p>
                                ) : (
                                    <p className="text-xs text-muted-foreground mt-0.5">Debit: <span className="font-mono font-semibold">12030001 – A/P PARTIES</span> &nbsp;|&nbsp; Credit: <span className="font-mono font-semibold">Bank / Cash account</span> (cash portion only)</p>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => append({ accountId: "", debit: 0, credit: 0 })}
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add More PV Rows
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

                    <div className="flex items-center space-x-2">
                        <Controller
                            control={form.control}
                            name="isTaxApplicable"
                            render={({ field }) => (
                                <Checkbox
                                    id="isTaxApplicable"
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            )}
                        />
                        <Label htmlFor="isTaxApplicable" className="text-sm font-medium leading-none">Tax Applicable</Label>
                    </div>

                    <div className="space-y-2 pt-4">
                        <Label htmlFor="description" className="text-xs text-muted-foreground uppercase font-semibold">Description</Label>
                        <Textarea
                            id="description"
                            placeholder="Enter payment description..."
                            {...form.register("description")}
                            disabled={isPending}
                            className="min-h-[100px] border-gray-300 dark:border-input rounded-lg"
                        />
                        {form.formState.errors.description && (
                            <p className="text-xs text-destructive font-medium">{form.formState.errors.description.message}</p>
                        )}
                    </div>

                    <div className="flex justify-center pt-6 border-t">
                        <Button
                            type="submit"
                            disabled={isPending || !isBalanced}
                        >
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create Payment Voucher
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
