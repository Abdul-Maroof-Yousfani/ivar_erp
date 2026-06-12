"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useForm, useFieldArray, Controller, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { paymentVoucherSchema, type PaymentVoucherFormValues } from "@/lib/validations/payment-voucher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Autocomplete } from "@/components/ui/autocomplete";
import { Plus, Trash2, Loader2, CreditCard, Wallet, Copy } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createPaymentVoucher, updatePaymentVoucher, getPendingInvoicesBySupplier, getAllSuppliers, getVendorWithAccounts, getAdvancesBySupplier, getSupplierSummary, type PaymentVoucher } from "@/lib/actions/payment-voucher";
import { ChartOfAccount } from "@/lib/actions/chart-of-account";
import { ChartOfAccountSelect, getSharedTree } from "@/components/ui/chart-of-account-select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { CheckIcon, ChevronDownIcon, Tag } from "lucide-react";
import { cn } from "@/lib/utils";
import { calculateTaxForAccount } from "@/lib/utils/tax-calculator";

// ─── Tag account selector (reused from JV form) ───────────────────────────────
function TagAccountSelect({ children, value, onValueChange, disabled }: {
    children: ChartOfAccount[];
    value?: string;
    onValueChange: (v: string) => void;
    disabled?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const selected = children.find((c) => c.id === value);
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button type="button" disabled={disabled} className={cn(
                    "flex items-center w-full h-8 px-2 rounded-md border border-dashed border-input bg-background text-xs cursor-pointer select-none text-left",
                    "hover:bg-accent hover:text-accent-foreground transition-colors",
                    "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50",
                    open && "ring-1 ring-ring/20",
                    disabled && "pointer-events-none opacity-50"
                )}>
                    <Tag className="h-3 w-3 shrink-0 text-muted-foreground mr-1.5" />
                    <span className={cn("flex-1 min-w-0 truncate", !selected && "text-muted-foreground")}>
                        {selected ? `${selected.code} - ${selected.name}` : "Tag sub-account (optional)"}
                    </span>
                    <ChevronDownIcon className={cn("ml-1 h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start" sideOffset={4}>
                <Command>
                    <CommandInput placeholder="Search sub-account..." className="h-8 text-xs" />
                    <CommandList className="max-h-52">
                        <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">No sub-accounts found.</CommandEmpty>
                        <CommandGroup>
                            {value && (
                                <CommandItem value="__clear__" onSelect={() => { onValueChange(""); setOpen(false); }} className="text-xs text-muted-foreground italic">
                                    Clear tag
                                </CommandItem>
                            )}
                            {children.map((child) => (
                                <CommandItem key={child.id} value={`${child.code} ${child.name}`} onSelect={() => { onValueChange(child.id); setOpen(false); }} className="flex items-center gap-2 text-xs">
                                    <span className="font-mono text-muted-foreground shrink-0">{child.code}</span>
                                    <span className="flex-1 truncate">{child.name}</span>
                                    {value === child.id && <CheckIcon className="h-3 w-3 shrink-0 text-primary" />}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

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

export function PaymentVoucherForm({ initialData }: { initialData?: any }) {
    const router = useRouter();
    const isRestoring = useRef(false);
    const [isPending, setIsPending] = useState(false);
    const [suppliers, setSuppliers] = useState<any[]>([]);
    const [pendingInvoices, setPendingInvoices] = useState<any[]>([]);
    const [selectedInvoices, setSelectedInvoices] = useState<InvoicePaymentEntry[]>([]);
    const [availableAdvances, setAvailableAdvances] = useState<any[]>([]);
    const [selectedAdvances, setSelectedAdvances] = useState<AdvanceEntry[]>([]);
    const [supplierSummary, setSupplierSummary] = useState<{ apBalance: number; advanceBalance: number } | null>(null);
    const [loadingSuppliers, setLoadingSuppliers] = useState(true);
    const [suppliersError, setSuppliersError] = useState<string>("");
    const [tree, setTree] = useState<ChartOfAccount[]>([]);

    const form = useForm<PaymentVoucherFormValues>({
        resolver: zodResolver(paymentVoucherSchema) as any,
        defaultValues: {
            type: initialData?.type || "bank",
            isAdvance: initialData?.isAdvance ?? false,
            pvNo: initialData?.pvNo || "",
            pvDate: initialData?.pvDate ? new Date(initialData.pvDate) : new Date(),
            refBillNo: initialData?.refBillNo || "",
            billDate: initialData?.billDate ? new Date(initialData.billDate) : undefined,
            chequeNo: initialData?.chequeNo || "",
            chequeDate: initialData?.chequeDate ? new Date(initialData.chequeDate) : undefined,
            creditAccountId: initialData?.creditAccountId || "",
            creditAmount: Number(initialData?.creditAmount) || 0,
            supplierId: initialData?.supplierId || "",
            invoices: initialData?.invoices || [],
            isTaxApplicable: initialData?.isTaxApplicable ?? false,
            description: initialData?.description || "",
            details: initialData?.details
                ? initialData.details.map((d: any) => ({
                      accountId: d.accountId,
                      tagAccountId: d.tagAccountId || "",
                      debit: Math.round(Number(d.debit) || 0),
                      credit: Math.round(Number(d.credit) || 0),
                      narration: d.narration || "",
                      refBillNo: d.refBillNo || "",
                      isTaxApplicable: d.isTaxApplicable ?? false,
                      taxableValue: Math.round(Number(d.taxableValue) || 0),
                  }))
                : [
                      { accountId: "", tagAccountId: "", debit: 0, credit: 0, narration: "", refBillNo: "", isTaxApplicable: false, taxableValue: 0 },
                      { accountId: "", tagAccountId: "", debit: 0, credit: 0, narration: "", refBillNo: "", isTaxApplicable: false, taxableValue: 0 },
                  ],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "details",
    });

    const voucherType = form.watch("type");

    // Poll for shared tree (loaded lazily by ChartOfAccountSelect on first open)
    useEffect(() => {
        const initial = getSharedTree();
        if (initial.length > 0) { setTree(initial); return; }
        const id = setInterval(() => {
            const t = getSharedTree();
            if (t.length > 0) { setTree(t); clearInterval(id); }
        }, 300);
        return () => clearInterval(id);
    }, []);

    // Clear tagAccountId when accountId changes for a row
    const prevAccountIds = useRef<Record<number, string>>({});
    const watchDetails = form.watch("details") || [];
    useEffect(() => {
        watchDetails.forEach((detail, index) => {
            const accountId = detail.accountId;
            if (prevAccountIds.current[index] !== undefined && prevAccountIds.current[index] !== accountId) {
                form.setValue(`details.${index}.tagAccountId`, "");
            }
            prevAccountIds.current[index] = accountId;
        });
    }, [watchDetails.map((d: any) => d.accountId).join(",")]);

    const prevDetailsRef = useRef<Array<{ accountId: string; tagAccountId: string; taxableValue: number }>>([]);

    // Derive child accounts for each row from the cached tree
    function findInTree(nodes: ChartOfAccount[], id: string): ChartOfAccount | undefined {
        for (const node of nodes) {
            if (node.id === id) return node;
            if (node.children?.length) { const f = findInTree(node.children, id); if (f) return f; }
        }
    }
    const rowChildren = useMemo(() => {
        return watchDetails.map((detail: any) => {
            if (!detail.accountId || tree.length === 0) return [];
            return findInTree(tree, detail.accountId)?.children ?? [];
        });
    }, [watchDetails.map((d: any) => d.accountId).join(","), tree]);

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

    // Load selected invoices/advances from initialData
    useEffect(() => {
        if (initialData) {
            if (initialData.invoices && Array.isArray(initialData.invoices)) {
                const mappedInvoices = initialData.invoices.map((inv: any) => {
                    const pi = inv.purchaseInvoice || {};
                    return {
                        purchaseInvoiceId: inv.purchaseInvoiceId,
                        invoiceNumber: pi.invoiceNumber || "",
                        totalAmount: Number(pi.totalAmount) || 0,
                        paidAmount: Number(pi.paidAmount) || 0,
                        remainingAmount: Number(pi.remainingAmount) || 0,
                        payingNow: Number(inv.paidAmount) || 0,
                    };
                });
                setSelectedInvoices(mappedInvoices);
            }

            if (initialData.advanceApplications && Array.isArray(initialData.advanceApplications)) {
                const mappedAdvances = initialData.advanceApplications.map((app: any) => {
                    const sa = app.sourceAdvance || {};
                    return {
                        pvId: app.sourceAdvanceId,
                        pvNo: sa.pvNo || "",
                        pvDate: sa.pvDate || "",
                        totalAmount: Number(sa.creditAmount) || 0,
                        availableAmount: Number(sa.creditAmount) - Number(sa.advanceApplied) + Number(app.appliedAmount),
                        applyingNow: Number(app.appliedAmount) || 0,
                    };
                });
                setSelectedAdvances(mappedAdvances);
            }
        }
    }, [initialData]);

    // Auto-generate PV No based on type
    useEffect(() => {
        if (initialData) return;
        const prefix = voucherType === "bank" ? "BPV" : "CPV";
        const datePart = `${new Date().getFullYear().toString().slice(-2)}${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
        const randomPart = Math.floor(1000 + Math.random() * 9000);
        form.setValue("pvNo", `${prefix}${datePart}${randomPart}`);
    }, [voucherType, form, initialData]);

    // Load pending invoices + available advances when supplier changes
    const selectedSupplierId = form.watch("supplierId");
    useEffect(() => {
        if (selectedSupplierId) {
            getPendingInvoicesBySupplier(selectedSupplierId).then(result => {
                let list = result.status ? result.data : [];
                if (initialData?.invoices && Array.isArray(initialData.invoices)) {
                    initialData.invoices.forEach((inv: any) => {
                        if (!list.find((x: any) => x.id === inv.purchaseInvoiceId)) {
                            const pi = inv.purchaseInvoice || {};
                            list.push({
                                id: inv.purchaseInvoiceId,
                                invoiceNumber: pi.invoiceNumber || "",
                                totalAmount: Number(pi.totalAmount) || 0,
                                paidAmount: Number(pi.paidAmount) || 0,
                                remainingAmount: Number(pi.remainingAmount) || 0,
                            });
                        }
                    });
                }
                setPendingInvoices(list);
            });
            getAdvancesBySupplier(selectedSupplierId).then(result => {
                let list = result.status ? result.data : [];
                if (initialData?.advanceApplications && Array.isArray(initialData.advanceApplications)) {
                    initialData.advanceApplications.forEach((app: any) => {
                        if (!list.find((x: any) => x.pvId === app.sourceAdvanceId)) {
                            const sa = app.sourceAdvance || {};
                            list.push({
                                pvId: app.sourceAdvanceId,
                                pvNo: sa.pvNo || "",
                                pvDate: sa.pvDate || "",
                                totalAmount: Number(sa.creditAmount) || 0,
                                availableAmount: Number(sa.creditAmount) - Number(sa.advanceApplied),
                            });
                        }
                    });
                }
                setAvailableAdvances(list);
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
    }, [selectedSupplierId, form, initialData]);

    // When supplier changes, fetch their linked chart of accounts and pre-fill debit rows
    useEffect(() => {
        if (initialData) return;
        if (!selectedSupplierId) return;
        if (isRestoring.current) return;
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
                            append({ accountId: acc.id, debit: 0, credit: 0, narration: "", refBillNo: "", isTaxApplicable: false, taxableValue: 0 });
                        }
                    });
                }
            }
        });
    }, [selectedSupplierId, form, append, initialData]);

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

    const duplicateToCredit = (fromIndex: number) => {
        const fromRow = form.getValues(`details.${fromIndex}`);
        const debitVal = Math.round(Number(fromRow.debit) || 0);
        
        const targetIndex = fromIndex + 1;
        const currentDetails = form.getValues("details") || [];
        
        if (targetIndex < currentDetails.length) {
            form.setValue(`details.${targetIndex}.credit`, debitVal, { shouldValidate: true });
            form.setValue(`details.${targetIndex}.debit`, 0, { shouldValidate: true });
            form.setValue(`details.${targetIndex}.narration`, fromRow.narration || "", { shouldValidate: true });
            form.setValue(`details.${targetIndex}.refBillNo`, fromRow.refBillNo || "", { shouldValidate: true });
            form.setValue(`details.${targetIndex}.isTaxApplicable`, fromRow.isTaxApplicable ?? false, { shouldValidate: true });
            form.setValue(`details.${targetIndex}.taxableValue`, fromRow.taxableValue ?? 0, { shouldValidate: true });
            if (fromRow.accountId) {
                form.setValue(`details.${targetIndex}.accountId`, fromRow.accountId, { shouldValidate: true });
            }
            if (fromRow.tagAccountId) {
                form.setValue(`details.${targetIndex}.tagAccountId`, fromRow.tagAccountId, { shouldValidate: true });
            }
            toast.success(`Copied details from Row ${fromIndex + 1} to Row ${targetIndex + 1} as Credit.`);
        } else {
            append({
                accountId: fromRow.accountId || "",
                tagAccountId: fromRow.tagAccountId || "",
                debit: 0,
                credit: debitVal,
                narration: fromRow.narration || "",
                refBillNo: fromRow.refBillNo || "",
                isTaxApplicable: fromRow.isTaxApplicable ?? false,
                taxableValue: fromRow.taxableValue ?? 0
            });
            toast.success(`Duplicated Row ${fromIndex + 1} to a new Credit Row.`);
        }
    };

    // Auto-save draft logic (multiple drafts keyed by pvNo)
    const watchAllFields = form.watch();
    const voucherNo = watchAllFields.pvNo;
    useEffect(() => {
        if (initialData || !voucherNo) return;
        const draftData = {
            formValues: watchAllFields,
            selectedInvoices,
            selectedAdvances,
        };
        const timeout = setTimeout(() => {
            const draftsJson = localStorage.getItem("payment-voucher-drafts") || "{}";
            try {
                const drafts = JSON.parse(draftsJson);
                drafts[voucherNo] = {
                    voucherNo,
                    updatedAt: new Date().toISOString(),
                    ...draftData,
                };
                localStorage.setItem("payment-voucher-drafts", JSON.stringify(drafts));
            } catch (e) {
                console.error("Error saving draft", e);
            }
        }, 1000);
        return () => clearTimeout(timeout);
    }, [watchAllFields, voucherNo, selectedInvoices, selectedAdvances, initialData]);

    // Restore draft logic
    useEffect(() => {
        if (initialData) return;

        // Check if there's a specific draftId query parameter
        const urlParams = new URLSearchParams(window.location.search);
        const urlDraftId = urlParams.get("draftId");

        const draftsJson = localStorage.getItem("payment-voucher-drafts");
        if (!draftsJson) return;

        try {
            const drafts = JSON.parse(draftsJson);

            if (urlDraftId) {
                const draft = drafts[urlDraftId];
                if (draft && draft.formValues) {
                    isRestoring.current = true;
                    if (draft.formValues.pvDate) draft.formValues.pvDate = new Date(draft.formValues.pvDate);
                    if (draft.formValues.billDate) draft.formValues.billDate = new Date(draft.formValues.billDate);
                    if (draft.formValues.chequeDate) draft.formValues.chequeDate = new Date(draft.formValues.chequeDate);
                    form.reset(draft.formValues);
                    if (draft.selectedInvoices) setSelectedInvoices(draft.selectedInvoices);
                    if (draft.selectedAdvances) setSelectedAdvances(draft.selectedAdvances);
                    
                    setTimeout(() => {
                        isRestoring.current = false;
                    }, 300);
                    toast.success(`Restored draft: ${urlDraftId}`);
                }
            } else {
                const draftKeys = Object.keys(drafts);
                if (draftKeys.length === 1) {
                    const singleKey = draftKeys[0];
                    const draft = drafts[singleKey];
                    const hasFormDetails = draft.formValues?.details?.some((d: { accountId?: string; debit?: number; credit?: number }) => d.accountId || (d.debit ?? 0) > 0 || (d.credit ?? 0) > 0);
                    const hasInvoicesOrAdvances = draft.selectedInvoices?.length > 0 || draft.selectedAdvances?.length > 0;
                    const hasDescriptionOrSupplier = draft.formValues?.description || draft.formValues?.supplierId;

                    if (hasFormDetails || hasInvoicesOrAdvances || hasDescriptionOrSupplier) {
                        toast(`You have an unsaved draft (${singleKey}).`, {
                            action: {
                                label: "Restore",
                                onClick: () => {
                                    isRestoring.current = true;
                                    if (draft.formValues) {
                                        if (draft.formValues.pvDate) draft.formValues.pvDate = new Date(draft.formValues.pvDate);
                                        if (draft.formValues.billDate) draft.formValues.billDate = new Date(draft.formValues.billDate);
                                        if (draft.formValues.chequeDate) draft.formValues.chequeDate = new Date(draft.formValues.chequeDate);
                                        form.reset(draft.formValues);
                                    }
                                    if (draft.selectedInvoices) setSelectedInvoices(draft.selectedInvoices);
                                    if (draft.selectedAdvances) setSelectedAdvances(draft.selectedAdvances);
                                    
                                    setTimeout(() => {
                                        isRestoring.current = false;
                                    }, 300);
                                    toast.success("Draft restored!");
                                }
                            },
                            cancel: {
                                label: "Discard",
                                onClick: () => {
                                    delete drafts[singleKey];
                                    localStorage.setItem("payment-voucher-drafts", JSON.stringify(drafts));
                                }
                            },
                            duration: 15000,
                        });
                    }
                } else if (draftKeys.length > 1) {
                    toast(`You have ${draftKeys.length} pending drafts.`, {
                        action: {
                            label: "View Drafts",
                            onClick: () => {
                                router.push("/finance/payment-voucher/list");
                            }
                        },
                        duration: 15000,
                    });
                }
            }
        } catch (e) {
            console.error("Failed to parse drafts", e);
        }
    }, [initialData, form, router]);

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
                details: values.details.map(detail => ({
                    accountId: detail.accountId,
                    tagAccountId: detail.tagAccountId || undefined,
                    debit: Math.round(Number(detail.debit) || 0),
                    credit: Math.round(Number(detail.credit) || 0),
                    narration: detail.narration || undefined,
                    refBillNo: detail.refBillNo || undefined,
                    isTaxApplicable: detail.isTaxApplicable ?? false,
                })),
                invoices: selectedInvoices.length > 0
                    ? selectedInvoices.map(i => ({ purchaseInvoiceId: i.purchaseInvoiceId, paidAmount: i.payingNow }))
                    : undefined,
                advanceApplications: selectedAdvances.length > 0
                    ? selectedAdvances.map(a => ({ advanceVoucherId: a.pvId, appliedAmount: a.applyingNow }))
                    : undefined,
            };

            const result = initialData
                ? await updatePaymentVoucher(initialData.id, finalSubmitData)
                : await createPaymentVoucher(finalSubmitData);
            if (result.status) {
                if (!initialData && voucherNo) {
                    const draftsJson = localStorage.getItem("payment-voucher-drafts");
                    if (draftsJson) {
                        try {
                            const drafts = JSON.parse(draftsJson);
                            delete drafts[voucherNo];
                            localStorage.setItem("payment-voucher-drafts", JSON.stringify(drafts));
                        } catch {}
                    }
                }
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

    // Watch for changes in detail rows to auto-balance and calculate taxes
    const watchDetailsString = watchDetails.map(d => `${d.debit}-${d.accountId}-${d.tagAccountId}-${d.isTaxApplicable}-${d.taxableValue}`).join(",");
    useEffect(() => {
        let totalTaxAmount = 0;

        // Auto-calculate taxes for any recognized tax rows
        if (tree.length > 0) {
            watchDetails.forEach((detail, index) => {
                const prev = prevDetailsRef.current[index] || { accountId: "", tagAccountId: "", taxableValue: 0 };
                const currentTaxableValue = Math.round(Number(detail.taxableValue) || 0);
                
                // Check if trigger fields changed for this row
                const triggerChanged = 
                    detail.accountId !== prev.accountId || 
                    detail.tagAccountId !== prev.tagAccountId || 
                    currentTaxableValue !== prev.taxableValue;

                if (detail.accountId && detail.tagAccountId) {
                    const accountNode = findInTree(tree, detail.accountId);
                    const tagNode = accountNode?.children?.find(c => c.id === detail.tagAccountId);

                    if (accountNode?.code && tagNode?.code) {
                        if (currentTaxableValue > 0) {
                            const calculatedTax = calculateTaxForAccount(accountNode.code, tagNode.code, currentTaxableValue);
                            if (calculatedTax !== null) {
                                const roundedTax = Math.round(calculatedTax);
                                if (triggerChanged) {
                                    form.setValue(`details.${index}.credit`, roundedTax, { shouldValidate: true });
                                    form.setValue(`details.${index}.debit`, 0, { shouldValidate: true });
                                    totalTaxAmount += roundedTax;
                                } else {
                                    // Use user's manual entry (subtracting any debit to get net credit impact)
                                    totalTaxAmount += Math.round(Number(detail.credit) || 0) - Math.round(Number(detail.debit) || 0);
                                }
                            }
                        } else {
                            if (triggerChanged) {
                                form.setValue(`details.${index}.credit`, 0, { shouldValidate: true });
                            } else {
                                totalTaxAmount += Math.round(Number(detail.credit) || 0) - Math.round(Number(detail.debit) || 0);
                            }
                        }
                    }
                }

                // Update the ref for this row
                prevDetailsRef.current[index] = {
                    accountId: detail.accountId || "",
                    tagAccountId: detail.tagAccountId || "",
                    taxableValue: currentTaxableValue,
                };
            });

            // Clean up extra rows in the ref if any were deleted
            if (prevDetailsRef.current.length > watchDetails.length) {
                prevDetailsRef.current = prevDetailsRef.current.slice(0, watchDetails.length);
            }
        }

        // Find the first row with debit amount (supplier row)
        const supplierRowIndex = watchDetails.findIndex(detail => Math.round(Number(detail.debit) || 0) > 0);
        
        // Find the second row with account selected but no debit and no tag (bank/company row)
        const bankRowIndex = watchDetails.findIndex((detail, index) => 
            index !== supplierRowIndex && 
            detail.accountId && 
            Math.round(Number(detail.debit) || 0) === 0 &&
            !detail.tagAccountId
        );
        
        // Auto-fill credit
        if (supplierRowIndex >= 0 && bankRowIndex >= 1) {
            const supplierDebitAmount = Math.round(Number(watchDetails[supplierRowIndex].debit) || 0);
            const currentBankCredit = Math.round(Number(watchDetails[bankRowIndex].credit) || 0);
            
            const expectedBankCredit = Math.round(Math.max(0, supplierDebitAmount - totalTaxAmount));
            
            if (supplierDebitAmount > 0 && currentBankCredit !== expectedBankCredit) {
                // Auto-fill the credit amount in the bank row
                form.setValue(`details.${bankRowIndex}.credit`, expectedBankCredit, { shouldValidate: true });
                form.setValue(`details.${bankRowIndex}.debit`, 0, { shouldValidate: true });
            }
        }
    }, [watchDetailsString, tree, form]);

    const totalDebit = watchDetails.reduce((sum, detail) => sum + (Number(detail.debit) || 0), 0);
    const totalCredit = watchDetails.reduce((sum, detail) => sum + (Number(detail.credit) || 0), 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

    return (
        <Card className="w-full">
            <CardHeader className="border-b flex flex-row items-center justify-between">
                <CardTitle>{initialData ? "Edit Payment Voucher" : (voucherType === "bank" ? "Create Bank Payment Voucher Form" : "Create Cash Payment Voucher Form")}</CardTitle>
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
                                    onClick={() => append({ accountId: "", tagAccountId: "", debit: 0, credit: 0, narration: "", refBillNo: "", isTaxApplicable: false, taxableValue: 0 })}
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
                                        <tr key={field.id} className="hover:bg-gray-50/50 dark:hover:bg-muted/50 align-top">
                                            <td className="px-4 py-3">
                                                <Controller
                                                    control={form.control}
                                                    name={`details.${index}.accountId`}
                                                    render={({ field }) => (
                                                        <ChartOfAccountSelect
                                                            value={field.value}
                                                            onValueChange={(val) => {
                                                                field.onChange(val);
                                                                const t = getSharedTree();
                                                                if (t.length > 0) setTree([...t]);
                                                            }}
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
                                                {(rowChildren[index]?.length ?? 0) > 0 && (
                                                    <div className="mt-1.5 flex gap-2">
                                                        <div className="flex-1">
                                                            <Controller
                                                                control={form.control}
                                                                name={`details.${index}.tagAccountId`}
                                                                render={({ field }) => (
                                                                    <TagAccountSelect
                                                                        children={rowChildren[index]}
                                                                        value={field.value ?? ""}
                                                                        onValueChange={field.onChange}
                                                                        disabled={isPending}
                                                                    />
                                                                )}
                                                            />
                                                        </div>
                                                        {watchDetails[index]?.tagAccountId && (
                                                            <div className="w-[120px] shrink-0">
                                                                <Input
                                                                    type="number"
                                                                    step="0.01"
                                                                    placeholder="Taxable Value"
                                                                    {...form.register(`details.${index}.taxableValue`, {
                                                                        valueAsNumber: true,
                                                                    })}
                                                                    disabled={isPending}
                                                                    className="h-8 text-xs border-gray-300 dark:border-input"
                                                                />
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                                <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-12 gap-2 border-t pt-2 border-gray-100 dark:border-muted/20">
                                                    <div className="sm:col-span-6">
                                                        <Input
                                                            placeholder="Line Narration (optional)"
                                                            {...form.register(`details.${index}.narration`)}
                                                            disabled={isPending}
                                                            className="h-8 text-xs border-gray-300 dark:border-input"
                                                        />
                                                    </div>
                                                    <div className="sm:col-span-3">
                                                        <Input
                                                            placeholder="Ref / Bill#"
                                                            {...form.register(`details.${index}.refBillNo`)}
                                                            disabled={isPending}
                                                            className="h-8 text-xs border-gray-300 dark:border-input"
                                                        />
                                                    </div>
                                                    <div className="sm:col-span-3 flex items-center gap-2 pl-1 select-none">
                                                        <Controller
                                                            control={form.control}
                                                            name={`details.${index}.isTaxApplicable`}
                                                            render={({ field }) => (
                                                                <Checkbox
                                                                    id={`details.${index}.isTaxApplicable`}
                                                                    checked={field.value ?? false}
                                                                    onCheckedChange={field.onChange}
                                                                    disabled={isPending}
                                                                />
                                                            )}
                                                        />
                                                        <Label
                                                            htmlFor={`details.${index}.isTaxApplicable`}
                                                            className="text-xs text-muted-foreground cursor-pointer font-medium"
                                                        >
                                                            Taxable
                                                        </Label>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <Input
                                                    type="number"
                                                    step="1"
                                                    placeholder="0"
                                                    {...form.register(`details.${index}.debit`, {
                                                        valueAsNumber: true,
                                                        onChange: (e) => {
                                                            const rawVal = Number(e.target.value) || 0;
                                                            const roundedVal = Math.round(rawVal);
                                                            if (rawVal !== roundedVal) {
                                                                form.setValue(`details.${index}.debit`, roundedVal, { shouldValidate: true });
                                                            }
                                                            if (roundedVal > 0) {
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
                                                    step="1"
                                                    placeholder="0"
                                                    {...form.register(`details.${index}.credit`, {
                                                        valueAsNumber: true,
                                                        onChange: (e) => {
                                                            const rawVal = Number(e.target.value) || 0;
                                                            const roundedVal = Math.round(rawVal);
                                                            if (rawVal !== roundedVal) {
                                                                form.setValue(`details.${index}.credit`, roundedVal, { shouldValidate: true });
                                                            }
                                                            if (roundedVal > 0) {
                                                                form.setValue(`details.${index}.debit`, 0, { shouldValidate: true });
                                                            }
                                                        }
                                                    })}
                                                    disabled={isPending}
                                                    className="h-10 border-gray-300 dark:border-input font-medium"
                                                />
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    {Number(watchDetails[index]?.debit) > 0 && (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            title="Duplicate to Credit Row"
                                                            onClick={() => duplicateToCredit(index)}
                                                            disabled={isPending}
                                                            className="rounded-full text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/30"
                                                        >
                                                            <Copy className="h-4 w-4" />
                                                        </Button>
                                                    )}
                                                    {fields.length > 2 ? (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => remove(index)}
                                                            disabled={isPending}
                                                            className="rounded-full text-destructive hover:text-destructive/90 hover:bg-destructive/10"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    ) : (
                                                        <span className="text-gray-300">---</span>
                                                    )}
                                                </div>
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
                            {initialData ? "Update Payment Voucher" : "Create Payment Voucher"}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
