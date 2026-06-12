"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useForm, useFieldArray, Controller, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { journalVoucherSchema, type JournalVoucherFormValues } from "@/lib/validations/journal-voucher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { ChartOfAccountSelect, getSharedTree } from "@/components/ui/chart-of-account-select";
import { Plus, Trash2, Loader2, Tag, CheckIcon, ChevronDownIcon, Copy } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createJournalVoucher, updateJournalVoucher, type JournalVoucher } from "@/lib/actions/journal-voucher";
import { ChartOfAccount } from "@/lib/actions/chart-of-account";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
import { cn } from "@/lib/utils";
import { calculateTaxForAccount } from "@/lib/utils/tax-calculator";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findInTree(nodes: ChartOfAccount[], id: string): ChartOfAccount | undefined {
    for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children?.length) {
            const found = findInTree(node.children, id);
            if (found) return found;
        }
    }
    return undefined;
}

// ─── Tag account selector ─────────────────────────────────────────────────────
interface TagAccountSelectProps {
    children: ChartOfAccount[];
    value?: string;
    onValueChange: (value: string) => void;
    disabled?: boolean;
}

function TagAccountSelect({ children, value, onValueChange, disabled }: TagAccountSelectProps) {
    const [open, setOpen] = useState(false);
    const selected = children.find((c) => c.id === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled}
                    className={cn(
                        "flex items-center w-full h-8 px-2 rounded-md border border-dashed border-input bg-background text-xs cursor-pointer select-none text-left",
                        "hover:bg-accent hover:text-accent-foreground transition-colors",
                        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring/50",
                        open && "ring-1 ring-ring/20",
                        disabled && "pointer-events-none opacity-50"
                    )}
                >
                    <Tag className="h-3 w-3 shrink-0 text-muted-foreground mr-1.5" />
                    <span className={cn("flex-1 min-w-0 truncate", !selected && "text-muted-foreground")}>
                        {selected
                            ? `${selected.code} - ${selected.name}`
                            : "Tag sub-account (optional)"}
                    </span>
                    <ChevronDownIcon
                        className={cn(
                            "ml-1 h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-200",
                            open && "rotate-180"
                        )}
                    />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="start" sideOffset={4}>
                <Command>
                    <CommandInput placeholder="Search sub-account..." className="h-8 text-xs" />
                    <CommandList className="max-h-52">
                        <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">
                            No sub-accounts found.
                        </CommandEmpty>
                        <CommandGroup>
                            {value && (
                                <CommandItem
                                    value="__clear__"
                                    onSelect={() => { onValueChange(""); setOpen(false); }}
                                    className="text-xs text-muted-foreground italic"
                                >
                                    Clear tag
                                </CommandItem>
                            )}
                            {children.map((child) => (
                                <CommandItem
                                    key={child.id}
                                    value={`${child.code} ${child.name}`}
                                    onSelect={() => { onValueChange(child.id); setOpen(false); }}
                                    className="flex items-center gap-2 text-xs"
                                >
                                    <span className="font-mono text-muted-foreground shrink-0">{child.code}</span>
                                    <span className="flex-1 truncate">{child.name}</span>
                                    {value === child.id && (
                                        <CheckIcon className="h-3 w-3 shrink-0 text-primary" />
                                    )}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

// ─── Main form ────────────────────────────────────────────────────────────────
export function JournalVoucherForm({ initialData }: { initialData?: JournalVoucher }) {
    const router = useRouter();
    const [isPending, setIsPending] = useState(false);
    // Shared tree — populated once the ChartOfAccountSelect loads it
    const [tree, setTree] = useState<ChartOfAccount[]>([]);

    const form = useForm<JournalVoucherFormValues>({
        resolver: zodResolver(journalVoucherSchema) as any,
        defaultValues: {
            jvNo: initialData?.jvNo || `JV${new Date().getFullYear().toString().slice(-2)}${(new Date().getMonth() + 1).toString().padStart(2, "0")}${Math.floor(1000 + Math.random() * 9000)}`,
            jvDate: initialData?.jvDate ? new Date(initialData.jvDate) : new Date(),
            description: initialData?.description || "",
            details: initialData?.details
                ? initialData.details.map((d) => ({
                      accountId: d.accountId,
                      tagAccountId: d.tagAccountId || "",
                      debit: Math.round(Number(d.debit) || 0),
                      credit: Math.round(Number(d.credit) || 0),
                      narration: d.narration || "",
                      refBillNo: d.refBillNo || "",
                      isTaxApplicable: d.isTaxApplicable ?? false,
                  }))
                : [
                      { accountId: "", tagAccountId: "", debit: 0, credit: 0, narration: "", refBillNo: "", isTaxApplicable: false },
                      { accountId: "", tagAccountId: "", debit: 0, credit: 0, narration: "", refBillNo: "", isTaxApplicable: false },
                  ],
        },
    });

    const { fields, append, remove } = useFieldArray({
        control: form.control,
        name: "details",
    });

    const watchDetails = form.watch("details") || [];

    // Poll for the shared tree until it's available (it loads lazily on first open)
    useEffect(() => {
        const initial = getSharedTree();
        if (initial.length > 0) { setTree(initial); return; }
        const id = setInterval(() => {
            const t = getSharedTree();
            if (t.length > 0) { setTree(t); clearInterval(id); }
        }, 300);
        return () => clearInterval(id);
    }, []);

    // When accountId changes for a row, clear its tagAccountId
    const prevAccountIds = useRef<Record<number, string>>({});
    useEffect(() => {
        watchDetails.forEach((detail, index) => {
            const accountId = detail.accountId;
            if (prevAccountIds.current[index] !== undefined &&
                prevAccountIds.current[index] !== accountId) {
                form.setValue(`details.${index}.tagAccountId`, "");
            }
            prevAccountIds.current[index] = accountId;
        });
    }, [watchDetails.map((d) => d.accountId).join(",")]);

    // Derive child accounts for each row from the cached tree
    const rowChildren = useMemo(() => {
        return watchDetails.map((detail) => {
            if (!detail.accountId || tree.length === 0) return [];
            const node = findInTree(tree, detail.accountId);
            return node?.children ?? [];
        });
    }, [watchDetails.map((d) => d.accountId).join(","), tree]);

    // Auto-save draft logic (multiple drafts keyed by jvNo)
    const watchAllFields = form.watch();
    const voucherNo = watchAllFields.jvNo;
    useEffect(() => {
        if (initialData || !voucherNo) return;
        const timeout = setTimeout(() => {
            const draftsJson = localStorage.getItem("journal-voucher-drafts") || "{}";
            try {
                const drafts = JSON.parse(draftsJson);
                drafts[voucherNo] = {
                    voucherNo,
                    updatedAt: new Date().toISOString(),
                    formValues: watchAllFields,
                };
                localStorage.setItem("journal-voucher-drafts", JSON.stringify(drafts));
            } catch (e) {
                console.error("Error saving draft", e);
            }
        }, 1000);
        return () => clearTimeout(timeout);
    }, [watchAllFields, voucherNo, initialData]);

    // Restore draft logic
    useEffect(() => {
        if (initialData) return;
        
        // 1. Check if there's a specific draftId query parameter
        const urlParams = new URLSearchParams(window.location.search);
        const urlDraftId = urlParams.get("draftId");
        
        const draftsJson = localStorage.getItem("journal-voucher-drafts");
        if (!draftsJson) return;
        
        try {
            const drafts = JSON.parse(draftsJson);
            
            if (urlDraftId) {
                const draft = drafts[urlDraftId];
                if (draft && draft.formValues) {
                    if (draft.formValues.jvDate) {
                        draft.formValues.jvDate = new Date(draft.formValues.jvDate);
                    }
                    form.reset(draft.formValues);
                    toast.success(`Restored draft: ${urlDraftId}`);
                }
            } else {
                // Check if any drafts exist
                const draftKeys = Object.keys(drafts);
                if (draftKeys.length === 1) {
                    const singleKey = draftKeys[0];
                    const draft = drafts[singleKey];
                    const hasDetails = draft.formValues?.details?.some((d: { accountId?: string; debit?: number; credit?: number }) => d.accountId || (d.debit ?? 0) > 0 || (d.credit ?? 0) > 0);
                    const hasDescription = draft.formValues?.description;
                    if (hasDetails || hasDescription) {
                        toast(`You have an unsaved draft (${singleKey}).`, {
                            action: {
                                label: "Restore",
                                onClick: () => {
                                    if (draft.formValues.jvDate) {
                                        draft.formValues.jvDate = new Date(draft.formValues.jvDate);
                                    }
                                    form.reset(draft.formValues);
                                    toast.success("Draft restored!");
                                }
                            },
                            cancel: {
                                label: "Discard",
                                onClick: () => {
                                    delete drafts[singleKey];
                                    localStorage.setItem("journal-voucher-drafts", JSON.stringify(drafts));
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
                                router.push("/finance/journal-voucher/list");
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

    const onSubmit: SubmitHandler<JournalVoucherFormValues> = async (values) => {
        try {
            setIsPending(true);
            const payload = {
                ...values,
                details: values.details.map((d) => ({
                    ...d,
                    debit: Math.round(Number(d.debit) || 0),
                    credit: Math.round(Number(d.credit) || 0),
                    tagAccountId: d.tagAccountId || undefined,
                })),
            };
            const result = initialData
                ? await updateJournalVoucher(initialData.id, payload)
                : await createJournalVoucher(payload);
            if (result.status) {
                if (!initialData && voucherNo) {
                    const draftsJson = localStorage.getItem("journal-voucher-drafts");
                    if (draftsJson) {
                        try {
                            const drafts = JSON.parse(draftsJson);
                            delete drafts[voucherNo];
                            localStorage.setItem("journal-voucher-drafts", JSON.stringify(drafts));
                        } catch {}
                    }
                }
                toast.success(initialData ? "Journal Voucher updated successfully" : "Journal Voucher created successfully");
                router.push("/finance/journal-voucher/list");
            } else {
                toast.error(result.message || (initialData ? "Failed to update Journal Voucher" : "Failed to create Journal Voucher"));
            }
        } catch {
            toast.error("An unexpected error occurred");
        } finally {
            setIsPending(false);
        }
    };

    // Watch for changes in detail rows to calculate taxes
    const watchDetailsString = watchDetails.map((d: any) => `${d.debit}-${d.credit}-${d.accountId}-${d.tagAccountId}-${d.isTaxApplicable}`).join(",");
    useEffect(() => {
        // Calculate total taxable amount (based on debits and credits where isTaxApplicable is true)
        const taxableDebitAmount = watchDetails.reduce((sum: number, detail: any) => {
            return sum + (detail.isTaxApplicable ? Math.round(Number(detail.debit) || 0) : 0);
        }, 0);
        
        const taxableCreditAmount = watchDetails.reduce((sum: number, detail: any) => {
            return sum + (detail.isTaxApplicable ? Math.round(Number(detail.credit) || 0) : 0);
        }, 0);
        
        const taxableAmount = Math.max(taxableDebitAmount, taxableCreditAmount);

        // Auto-calculate taxes for any recognized tax rows
        if (taxableAmount > 0 && tree.length > 0) {
            watchDetails.forEach((detail: any, index: number) => {
                if (detail.accountId && detail.tagAccountId) {
                    const accountNode = findInTree(tree, detail.accountId);
                    const tagNode = accountNode?.children?.find(c => c.id === detail.tagAccountId);

                    if (accountNode?.code && tagNode?.code) {
                        const calculatedTax = calculateTaxForAccount(accountNode.code, tagNode.code, taxableAmount);
                        if (calculatedTax !== null) {
                            const roundedTax = Math.round(calculatedTax);
                            const currentDebit = Math.round(Number(detail.debit) || 0);
                            const currentCredit = Math.round(Number(detail.credit) || 0);
                            
                            // Determine which side to place the tax
                            // If taxableAmount comes from Debits, tax is a Credit liability
                            // If taxableAmount comes from Credits, tax is a Debit asset
                            const isLiability = taxableDebitAmount > 0;
                            
                            if (isLiability) {
                                if (currentCredit !== roundedTax) {
                                    form.setValue(`details.${index}.credit`, roundedTax, { shouldValidate: true });
                                    form.setValue(`details.${index}.debit`, 0, { shouldValidate: true });
                                }
                            } else {
                                if (currentDebit !== roundedTax) {
                                    form.setValue(`details.${index}.debit`, roundedTax, { shouldValidate: true });
                                    form.setValue(`details.${index}.credit`, 0, { shouldValidate: true });
                                }
                            }
                        }
                    }
                }
            });
        }
    }, [watchDetailsString, tree, form]);

    const totalDebit = watchDetails.reduce((sum, d) => sum + (Number(d.debit) || 0), 0);
    const totalCredit = watchDetails.reduce((sum, d) => sum + (Number(d.credit) || 0), 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

    const duplicateRowToOpposite = (fromIndex: number) => {
        const fromRow = form.getValues(`details.${fromIndex}`);
        const debitVal = Math.round(Number(fromRow.debit) || 0);
        const creditVal = Math.round(Number(fromRow.credit) || 0);
        
        const val = Math.round(debitVal || creditVal);
        const isFromDebit = debitVal > 0;
        
        const targetIndex = fromIndex + 1;
        const currentDetails = form.getValues("details") || [];
        
        const oppositeRow = {
            accountId: "",
            tagAccountId: "",
            debit: isFromDebit ? 0 : val,
            credit: isFromDebit ? val : 0,
            narration: fromRow.narration || "",
            refBillNo: fromRow.refBillNo || "",
            isTaxApplicable: fromRow.isTaxApplicable ?? false,
        };
        
        if (targetIndex < currentDetails.length) {
            form.setValue(`details.${targetIndex}.debit`, oppositeRow.debit, { shouldValidate: true });
            form.setValue(`details.${targetIndex}.credit`, oppositeRow.credit, { shouldValidate: true });
            form.setValue(`details.${targetIndex}.narration`, oppositeRow.narration, { shouldValidate: true });
            form.setValue(`details.${targetIndex}.refBillNo`, oppositeRow.refBillNo, { shouldValidate: true });
            form.setValue(`details.${targetIndex}.isTaxApplicable`, oppositeRow.isTaxApplicable, { shouldValidate: true });
        } else {
            append(oppositeRow);
        }
    };

    return (
        <Card className="w-full">
            <CardHeader className="border-b">
                <CardTitle>{initialData ? "Edit Journal Voucher" : "Create Journal Voucher Form"}</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
                <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-8">

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <Label htmlFor="jvNo" className="text-xs text-muted-foreground uppercase font-semibold">
                                JV No <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="jvNo"
                                {...form.register("jvNo")}
                                disabled
                                className="bg-gray-100 dark:bg-muted h-11 border-gray-300 dark:border-input pointer-events-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground uppercase font-semibold">
                                JV Date <span className="text-destructive">*</span>
                            </Label>
                            <Controller
                                control={form.control}
                                name="jvDate"
                                render={({ field }) => (
                                    <DatePicker
                                        value={field.value ? field.value.toISOString().split("T")[0] : ""}
                                        onChange={(dateStr) => field.onChange(new Date(dateStr))}
                                        disabled={isPending}
                                        className="h-11 border-gray-300 dark:border-input"
                                    />
                                )}
                            />
                            {form.formState.errors.jvDate && (
                                <p className="text-xs text-destructive">{form.formState.errors.jvDate.message}</p>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4 pt-4">
                        <div className="flex items-center justify-between border-b pb-2">
                            <h2 className="text-xl font-bold text-gray-800 dark:text-foreground">Journal Voucher Detail</h2>
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => append({ accountId: "", tagAccountId: "", debit: 0, credit: 0, narration: "", refBillNo: "", isTaxApplicable: false })}
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Add More JV Rows
                            </Button>
                        </div>

                        <div className="border rounded-lg overflow-hidden border-gray-200 dark:border-border">
                            <table className="w-full text-sm">
                                <thead className="dark:bg-muted text-foreground border-b font-bold">
                                    <tr>
                                        <th className="px-4 py-3 text-left">Account Head</th>
                                        <th className="px-4 py-3 text-left w-45">Debit <span className="text-destructive">*</span></th>
                                        <th className="px-4 py-3 text-left w-45">Credit <span className="text-destructive">*</span></th>
                                        <th className="px-4 py-3 text-center w-24">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {fields.map((field, index) => {
                                        const children = rowChildren[index] ?? [];
                                        const hasChildren = children.length > 0;

                                        return (
                                            <tr key={field.id} className="hover:bg-gray-50/50 dark:hover:bg-muted/50 align-top">
                                                <td className="px-4 py-3">
                                                    {/* Account selector */}
                                                    <Controller
                                                        control={form.control}
                                                        name={`details.${index}.accountId`}
                                                        render={({ field }) => (
                                                            <ChartOfAccountSelect
                                                                value={field.value}
                                                                onValueChange={(val) => {
                                                                    field.onChange(val);
                                                                    // Eagerly update tree ref so rowChildren recalculates
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

                                                    {/* Tag sub-account — shown only when selected account has children */}
                                                    {hasChildren && (
                                                        <div className="mt-1.5">
                                                            <Controller
                                                                control={form.control}
                                                                name={`details.${index}.tagAccountId`}
                                                                render={({ field }) => (
                                                                    <TagAccountSelect
                                                                        children={children}
                                                                        value={field.value ?? ""}
                                                                        onValueChange={field.onChange}
                                                                        disabled={isPending}
                                                                    />
                                                                )}
                                                            />
                                                        </div>
                                                    )}

                                                    {/* Row-level narration, reference, and tax check */}
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
                                                        placeholder="Debit"
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
                                                            },
                                                        })}
                                                        disabled={isPending}
                                                        className="h-10 border-gray-300 dark:border-input font-medium"
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <Input
                                                        type="number"
                                                        step="1"
                                                        placeholder="Credit"
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
                                                            },
                                                        })}
                                                        disabled={isPending}
                                                        className="h-10 border-gray-300 dark:border-input font-medium"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => duplicateRowToOpposite(index)}
                                                            disabled={isPending}
                                                            title="Duplicate row data and swap debit/credit"
                                                            className="rounded-full hover:bg-blue-50 dark:hover:bg-blue-950/20 text-blue-600 h-8 w-8"
                                                        >
                                                            <Copy className="h-4 w-4" />
                                                        </Button>
                                                        {fields.length > 2 ? (
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => remove(index)}
                                                                disabled={isPending}
                                                                className="rounded-full text-destructive h-8 w-8"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        ) : (
                                                            <span className="text-gray-300 text-xs">---</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
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
                                            {!isBalanced && (
                                                <div
                                                    className="mx-auto w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"
                                                    title="Out of Balance"
                                                />
                                            )}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                        {form.formState.errors.details?.root && (
                            <p className="text-sm text-destructive font-medium">
                                {form.formState.errors.details.root.message}
                            </p>
                        )}
                    </div>

                    <div className="space-y-2 pt-4">
                        <Label htmlFor="description" className="text-xs text-muted-foreground uppercase font-semibold">
                            Description <span className="text-destructive">*</span>
                        </Label>
                        <Textarea
                            id="description"
                            placeholder="Description"
                            {...form.register("description")}
                            disabled={isPending}
                            className="min-h-25 border-gray-300 dark:border-input rounded-lg"
                        />
                        {form.formState.errors.description && (
                            <p className="text-xs text-destructive font-medium">{form.formState.errors.description.message}</p>
                        )}
                    </div>

                    <div className="flex justify-center pt-6 border-t">
                        <Button
                            type="submit"
                            disabled={isPending || !isBalanced || totalDebit === 0}
                        >
                            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {initialData ? "Update Journal Voucher" : "Create Journal Voucher"}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
