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
import { authFetch } from "@/lib/auth";
import { Plus, Trash2, Loader2, Tag, CheckIcon, ChevronDownIcon, Copy, Edit2, Upload } from "lucide-react";
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

export function contractTree(nodes: ChartOfAccount[], parentName?: string): ChartOfAccount[] {
    const result: ChartOfAccount[] = [];
    for (const node of nodes) {
        let currentChildren = node.children;
        if (currentChildren && currentChildren.length > 0) {
            currentChildren = contractTree(currentChildren, node.name);
        }
        const nodeCopy = { ...node, children: currentChildren };
        
        if (
            parentName &&
            node.isGroup &&
            node.name.toLowerCase().replace(/\s+/g, ' ').trim() === parentName.toLowerCase().replace(/\s+/g, ' ').trim()
        ) {
            if (currentChildren) {
                result.push(...currentChildren);
            }
        } else {
            result.push(nodeCopy);
        }
    }
    return result;
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
                : [],
        },
    });

    const { fields, append, remove, update } = useFieldArray({
        control: form.control,
        name: "details",
    });

    const watchDetails = form.watch("details") || [];

    // Eagerly fetch and cache the shared tree on mount, or poll if needed
    useEffect(() => {
        const initial = getSharedTree();
        if (initial.length > 0) {
            setTree(initial);
            return;
        }
        
        // Eager fetch
        authFetch(`/finance/chart-of-accounts/tree`, {})
            .then((res) => {
                const data = res.data;
                if (Array.isArray(data)) {
                    setTree(data);
                }
            })
            .catch((err) => console.error("Eager tree fetch failed:", err));

        const id = setInterval(() => {
            const t = getSharedTree();
            if (t.length > 0) { setTree(t); clearInterval(id); }
        }, 500);
        return () => clearInterval(id);
    }, []);

    // Memoize the contracted tree for faster lookups
    const contractedTree = useMemo(() => {
        return contractTree(tree);
    }, [tree]);

    // Editor panel states
    const [editorAccountId, setEditorAccountId] = useState("");
    const [editorTagAccountId, setEditorTagAccountId] = useState("");
    const [editorTaxType, setEditorTaxType] = useState<"Taxable" | "BTL" | "REIMB" | "Exempt">("Exempt");
    const [editorNarration, setEditorNarration] = useState("");
    const [editorRef1, setEditorRef1] = useState("");
    const [editorRef2, setEditorRef2] = useState("");
    const [editorDebit, setEditorDebit] = useState<number | "">("");
    const [editorCredit, setEditorCredit] = useState<number | "">("");
    const [editingIndex, setEditingIndex] = useState<number | null>(null);

    // Table filters
    const [filterAccount, setFilterAccount] = useState("");
    const [filterNarrationRef, setFilterNarrationRef] = useState("");
    const [filterDebit, setFilterDebit] = useState("");
    const [filterCredit, setFilterCredit] = useState("");

    // Derive children for tag select based on selected account head in editor
    const editorChildren = useMemo(() => {
        if (!editorAccountId || contractedTree.length === 0) return [];
        const node = findInTree(contractedTree, editorAccountId);
        return node?.children ?? [];
    }, [editorAccountId, contractedTree]);
    const hasEditorChildren = editorChildren.length > 0;

    // F4 keyboard shortcut to trigger Add Line
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "F4") {
                e.preventDefault();
                handleAddLine();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [editorAccountId, editorTagAccountId, editorTaxType, editorNarration, editorRef1, editorRef2, editorDebit, editorCredit, editingIndex]);

    const handleAddLine = () => {
        if (!editorAccountId) {
            toast.error("Please select an Account Head");
            return;
        }

        const debitNum = Number(editorDebit) || 0;
        const creditNum = Number(editorCredit) || 0;

        if (debitNum === 0 && creditNum === 0) {
            toast.error("Either Debit or Credit must be greater than 0");
            return;
        }

        if (debitNum > 0 && creditNum > 0) {
            toast.error("A line cannot have both Debit and Credit amounts");
            return;
        }

        // Concatenate references: Ref 1 and Ref 2
        let refBillNo = editorRef1;
        if (editorRef2) {
            refBillNo = refBillNo ? `${refBillNo} | ${editorRef2}` : editorRef2;
        }

        const lineData = {
            accountId: editorAccountId,
            tagAccountId: editorTagAccountId || "",
            debit: debitNum,
            credit: creditNum,
            narration: editorNarration || "",
            refBillNo,
            isTaxApplicable: editorTaxType === "Taxable",
        };

        if (editingIndex !== null) {
            update(editingIndex, lineData);
            setEditingIndex(null);
            toast.success("Line updated successfully");
        } else {
            append(lineData);
            toast.success("Line added successfully");
        }

        // Reset editor inputs
        setEditorAccountId("");
        setEditorTagAccountId("");
        setEditorTaxType("Exempt");
        setEditorNarration("");
        setEditorRef1("");
        setEditorRef2("");
        setEditorDebit("");
        setEditorCredit("");
    };

    const handleEditLine = (index: number) => {
        const line = watchDetails[index];
        if (!line) return;

        setEditingIndex(index);
        setEditorAccountId(line.accountId);
        setEditorTagAccountId(line.tagAccountId || "");
        setEditorTaxType(line.isTaxApplicable ? "Taxable" : "Exempt");
        setEditorNarration(line.narration || "");

        // Split refBillNo back into Ref 1 and Ref 2
        const refs = (line.refBillNo || "").split(" | ");
        setEditorRef1(refs[0] || "");
        setEditorRef2(refs[1] || "");

        setEditorDebit(line.debit > 0 ? line.debit : "");
        setEditorCredit(line.credit > 0 ? line.credit : "");
    };

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
        const taxableDebitAmount = watchDetails.reduce((sum: number, detail: any) => {
            return sum + (detail.isTaxApplicable ? Math.round(Number(detail.debit) || 0) : 0);
        }, 0);
        
        const taxableCreditAmount = watchDetails.reduce((sum: number, detail: any) => {
            return sum + (detail.isTaxApplicable ? Math.round(Number(detail.credit) || 0) : 0);
        }, 0);
        
        const taxableAmount = Math.max(taxableDebitAmount, taxableCreditAmount);

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

    // Filtered details list for table view
    const filteredFields = useMemo(() => {
        return fields
            .map((field, index) => ({ field, index }))
            .filter(({ index }) => {
                const detail = watchDetails[index];
                if (!detail) return false;

                // Account Filter
                if (filterAccount) {
                    const accountNode = findInTree(tree, detail.accountId);
                    const tagNode = accountNode?.children?.find(c => c.id === detail.tagAccountId);
                    const labelText = `${accountNode ? `${accountNode.code} ${accountNode.name}` : detail.accountId} ${tagNode ? `${tagNode.code} ${tagNode.name}` : ""}`.toLowerCase();
                    if (!labelText.includes(filterAccount.toLowerCase())) return false;
                }

                // Narration & Refs Filter
                if (filterNarrationRef) {
                    const labelText = `${detail.narration || ""} ${detail.refBillNo || ""}`.toLowerCase();
                    if (!labelText.includes(filterNarrationRef.toLowerCase())) return false;
                }

                // Debit Filter
                if (filterDebit) {
                    if (detail.debit === 0 || !String(detail.debit).includes(filterDebit)) return false;
                }

                // Credit Filter
                if (filterCredit) {
                    if (detail.credit === 0 || !String(detail.credit).includes(filterCredit)) return false;
                }

                return true;
            });
    }, [fields, watchDetails, tree, filterAccount, filterNarrationRef, filterDebit, filterCredit]);

    return (
        <Card className="w-full">
            <CardHeader className="border-b">
                <CardTitle>{initialData ? "Edit Journal Voucher" : "Create Journal Voucher Form"}</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
                <form onSubmit={form.handleSubmit(onSubmit as any)} className="space-y-8">

                    {/* Top Row: JV No & Date */}
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

                    <div className="space-y-6 pt-4">
                        <div className="flex items-center justify-between border-b pb-3">
                            <h2 className="text-xl font-bold text-gray-800 dark:text-foreground">Journal Voucher Detail</h2>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => toast.info("Excel/CSV import coming soon!")}
                                className="flex items-center gap-2 border-gray-300 hover:bg-gray-50 text-xs font-semibold"
                            >
                                <Upload className="h-4 w-4 text-muted-foreground" />
                                Import Excel/CSV
                            </Button>
                        </div>

                        {/* ─── ADD TRANSACTION LINE PANEL ─── */}
                        <div className="bg-gray-50/50 dark:bg-muted/10 border border-gray-200 dark:border-border rounded-xl p-5 space-y-4">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                                {editingIndex !== null ? "Edit Transaction Line" : "Add Transaction Line"}
                            </h3>

                            {/* Row 1: Account Head, Tag Account, Tax Type */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                <div className="md:col-span-5 space-y-1.5">
                                    <Label className="text-[10px] text-muted-foreground uppercase font-bold">
                                        Account Head <span className="text-destructive">*</span>
                                    </Label>
                                    <ChartOfAccountSelect
                                        value={editorAccountId}
                                        onValueChange={(val) => {
                                            setEditorAccountId(val);
                                            setEditorTagAccountId("");
                                        }}
                                        placeholder="Select Account"
                                        disabled={isPending}
                                        allowGroups={false}
                                        className="h-10 border-gray-300 dark:border-input shadow-xs"
                                    />
                                </div>
                                <div className="md:col-span-4 space-y-1.5">
                                    <Label className="text-[10px] text-muted-foreground uppercase font-bold">
                                        Tag Sub-Account
                                    </Label>
                                    <TagAccountSelect
                                        children={editorChildren}
                                        value={editorTagAccountId}
                                        onValueChange={setEditorTagAccountId}
                                        disabled={!hasEditorChildren || isPending}
                                    />
                                </div>
                                <div className="md:col-span-3 space-y-1.5">
                                    <Label className="text-[10px] text-muted-foreground uppercase font-bold">
                                        Tax Type
                                    </Label>
                                    <div className="flex rounded-lg bg-gray-200/50 dark:bg-muted p-1 h-10 border border-gray-300 dark:border-input">
                                        {(["Taxable", "BTL", "REIMB", "Exempt"] as const).map((type) => (
                                            <button
                                                key={type}
                                                type="button"
                                                disabled={isPending}
                                                onClick={() => setEditorTaxType(type)}
                                                className={cn(
                                                    "flex-1 rounded-md text-[10px] font-semibold select-none transition-all duration-150 cursor-pointer",
                                                    editorTaxType === type
                                                        ? "bg-white dark:bg-background text-foreground shadow-xs font-bold"
                                                        : "text-muted-foreground hover:text-foreground"
                                                )}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Row 2: Narration, Ref 1, Ref 2 */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                <div className="md:col-span-6 space-y-1.5">
                                    <Label className="text-[10px] text-muted-foreground uppercase font-bold">
                                        Line Narration
                                    </Label>
                                    <Input
                                        placeholder="Narration for this line..."
                                        value={editorNarration}
                                        onChange={(e) => setEditorNarration(e.target.value)}
                                        disabled={isPending}
                                        className="h-10 border-gray-300 dark:border-input"
                                    />
                                </div>
                                <div className="md:col-span-3 space-y-1.5">
                                    <Label className="text-[10px] text-muted-foreground uppercase font-bold">
                                        Ref 1
                                    </Label>
                                    <Input
                                        placeholder="Reference 1"
                                        value={editorRef1}
                                        onChange={(e) => setEditorRef1(e.target.value)}
                                        disabled={isPending}
                                        className="h-10 border-gray-300 dark:border-input"
                                    />
                                </div>
                                <div className="md:col-span-3 space-y-1.5">
                                    <Label className="text-[10px] text-muted-foreground uppercase font-bold">
                                        Ref 2
                                    </Label>
                                    <Input
                                        placeholder="Reference 2"
                                        value={editorRef2}
                                        onChange={(e) => setEditorRef2(e.target.value)}
                                        disabled={isPending}
                                        className="h-10 border-gray-300 dark:border-input"
                                    />
                                </div>
                            </div>

                            {/* Row 3: Debit, Credit, Button */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                                <div className="md:col-span-4 space-y-1.5">
                                    <Label className="text-[10px] text-muted-foreground uppercase font-bold">
                                        Debit Amount
                                    </Label>
                                    <Input
                                        type="number"
                                        step="1"
                                        placeholder="0"
                                        value={editorDebit}
                                        onChange={(e) => {
                                            const val = e.target.value === "" ? "" : Math.round(Number(e.target.value));
                                            setEditorDebit(val);
                                            if (val && Number(val) > 0) setEditorCredit("");
                                        }}
                                        disabled={isPending}
                                        className="h-10 border-gray-300 dark:border-input font-medium"
                                    />
                                </div>
                                <div className="md:col-span-4 space-y-1.5">
                                    <Label className="text-[10px] text-muted-foreground uppercase font-bold">
                                        Credit Amount
                                    </Label>
                                    <Input
                                        type="number"
                                        step="1"
                                        placeholder="0"
                                        value={editorCredit}
                                        onChange={(e) => {
                                            const val = e.target.value === "" ? "" : Math.round(Number(e.target.value));
                                            setEditorCredit(val);
                                            if (val && Number(val) > 0) setEditorDebit("");
                                        }}
                                        disabled={isPending}
                                        className="h-10 border-gray-300 dark:border-input font-medium"
                                    />
                                </div>
                                <div className="md:col-span-4">
                                    <Button
                                        type="button"
                                        onClick={handleAddLine}
                                        disabled={isPending}
                                        className="h-10 w-full bg-violet-600 hover:bg-violet-700 text-white font-bold rounded-lg relative flex items-center justify-center gap-2 shadow-xs transition-colors"
                                    >
                                        <span>{editingIndex !== null ? "Update Line" : "Add Line"}</span>
                                        <span className="absolute right-3 px-1.5 py-0.5 text-[9px] font-mono bg-violet-800 text-violet-200 rounded border border-violet-500">
                                            F4
                                        </span>
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* ─── ADDED LINES TABLE VIEW ─── */}
                        <div className="border rounded-xl overflow-hidden border-gray-200 dark:border-border shadow-xs">
                            <table className="w-full text-xs">
                                <thead className="bg-gray-150 dark:bg-muted text-gray-700 dark:text-foreground border-b border-gray-200 dark:border-border font-bold">
                                    <tr>
                                        <th className="px-4 py-3.5 text-left w-12 text-[10px] uppercase font-semibold">#</th>
                                        <th className="px-4 py-3.5 text-left text-[10px] uppercase font-semibold">Account Head & Tag</th>
                                        <th className="px-4 py-3.5 text-left text-[10px] uppercase font-semibold">Narration & References</th>
                                        <th className="px-4 py-3.5 text-right w-40 text-[10px] uppercase font-semibold">Debit</th>
                                        <th className="px-4 py-3.5 text-right w-40 text-[10px] uppercase font-semibold">Credit</th>
                                        <th className="px-4 py-3.5 text-center w-28 text-[10px] uppercase font-semibold">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {/* Local filters row */}
                                    <tr className="bg-gray-50/50 dark:bg-muted/30 border-b border-gray-200 dark:border-border">
                                        <td className="px-4 py-2"></td>
                                        <td className="px-4 py-2">
                                            <Input
                                                placeholder="Filter account..."
                                                value={filterAccount}
                                                onChange={(e) => setFilterAccount(e.target.value)}
                                                className="h-8 text-xs bg-background border-gray-200 dark:border-input"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <Input
                                                placeholder="Filter narration/ref..."
                                                value={filterNarrationRef}
                                                onChange={(e) => setFilterNarrationRef(e.target.value)}
                                                className="h-8 text-xs bg-background border-gray-200 dark:border-input"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <Input
                                                placeholder="Filter debit..."
                                                value={filterDebit}
                                                onChange={(e) => setFilterDebit(e.target.value)}
                                                className="h-8 text-xs bg-background border-gray-200 dark:border-input text-right"
                                            />
                                        </td>
                                        <td className="px-4 py-2">
                                            <Input
                                                placeholder="Filter credit..."
                                                value={filterCredit}
                                                onChange={(e) => setFilterCredit(e.target.value)}
                                                className="h-8 text-xs bg-background border-gray-200 dark:border-input text-right"
                                            />
                                        </td>
                                        <td className="px-4 py-2"></td>
                                    </tr>

                                    {filteredFields.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground bg-white dark:bg-background">
                                                No lines added yet. Use the editor above to add lines.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredFields.map(({ field, index }, idx) => {
                                            const detail = watchDetails[index];
                                            if (!detail) return null;

                                            const accountNode = findInTree(contractedTree, detail.accountId);
                                            const tagNode = accountNode?.children?.find(c => c.id === detail.tagAccountId);

                                            return (
                                                <tr key={field.id} className="hover:bg-gray-50/30 dark:hover:bg-muted/10 border-b border-gray-200 dark:border-border bg-white dark:bg-background/20">
                                                    <td className="px-4 py-3 text-muted-foreground align-middle font-medium">
                                                        {idx + 1}
                                                    </td>
                                                    <td className="px-4 py-3 align-middle font-semibold">
                                                        <div>{accountNode ? `${accountNode.code} - ${accountNode.name}` : detail.accountId}</div>
                                                        {tagNode && (
                                                            <div className="text-[10px] text-violet-600 dark:text-violet-400 font-semibold mt-0.5 flex items-center gap-1">
                                                                <Tag className="h-2.5 w-2.5 shrink-0" />
                                                                {tagNode.code} - {tagNode.name}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 align-middle text-muted-foreground">
                                                        <div className="max-w-xs truncate">{detail.narration || "—"}</div>
                                                        {detail.refBillNo && (
                                                            <div className="text-[10px] text-gray-400 dark:text-muted-foreground/60 font-medium mt-0.5">
                                                                Ref: {detail.refBillNo}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 text-right align-middle font-mono font-bold text-sm">
                                                        {detail.debit > 0 ? detail.debit.toLocaleString() : "—"}
                                                    </td>
                                                    <td className="px-4 py-3 text-right align-middle font-mono font-bold text-sm">
                                                        {detail.credit > 0 ? detail.credit.toLocaleString() : "—"}
                                                    </td>
                                                    <td className="px-4 py-3 text-center align-middle">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                disabled={isPending}
                                                                onClick={() => handleEditLine(index)}
                                                                className={cn(
                                                                    "h-7 w-7 rounded-full text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20",
                                                                    editingIndex === index && "bg-blue-100 ring-2 ring-blue-500"
                                                                )}
                                                                title="Edit this line"
                                                            >
                                                                <Edit2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                disabled={isPending}
                                                                onClick={() => remove(index)}
                                                                className="h-7 w-7 rounded-full text-destructive hover:bg-red-50 dark:hover:bg-red-950/20"
                                                                title="Delete this line"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                                <tfoot className="font-bold border-t border-gray-200 dark:border-border bg-gray-50/50 dark:bg-muted/10">
                                    <tr>
                                        <td className="px-4 py-4 text-right pr-8 text-gray-600 dark:text-muted-foreground" colSpan={3}>Totals:</td>
                                        <td className="px-4 py-4 text-right text-lg text-foreground font-mono">
                                            {totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-4 text-right text-lg text-foreground font-mono">
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

                    {/* Voucher Description */}
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

                    {/* Form Submission Button */}
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
