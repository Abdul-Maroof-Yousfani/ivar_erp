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
import { ChartOfAccountSelect, getSharedTree, fetchSharedTree } from "@/components/ui/chart-of-account-select";
import { Plus, Trash2, Loader2, Tag, CheckIcon, ChevronDownIcon, Copy, Upload, Pencil, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { VoucherImportModal } from "@/components/finance/voucher-import-modal";
import { Autocomplete } from "@/components/ui/autocomplete";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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

function getLeafSubAccounts(node: ChartOfAccount | undefined): ChartOfAccount[] {
    if (!node || !node.children || node.children.length === 0) return [];
    const result: ChartOfAccount[] = [];
    for (const child of node.children) {
        if (!child.isGroup || !child.children || child.children.length === 0) {
            result.push(child);
        } else {
            result.push(...getLeafSubAccounts(child));
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
    id?: string;
}

function TagAccountSelect({ children, value, onValueChange, disabled, id }: TagAccountSelectProps) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const selected = children.find((c) => c.id === value);

    useEffect(() => {
        if (!open) {
            setSearch("");
        }
    }, [open]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
        if (disabled) return;
        if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
            e.preventDefault();
            setSearch(e.key);
            setOpen(true);
        } else if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
        }
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    id={id}
                    type="button"
                    role="combobox"
                    aria-expanded={open}
                    disabled={disabled}
                    onKeyDown={handleKeyDown}
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
                    {selected && (
                        <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                navigator.clipboard.writeText(selected.name);
                                toast.success(`Copied tag name: "${selected.name}"`);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    navigator.clipboard.writeText(selected.name);
                                    toast.success(`Copied tag name: "${selected.name}"`);
                                }
                            }}
                            className="p-1 ml-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                            title="Copy tag account name"
                        >
                            <Copy className="h-3.5 w-3.5" />
                        </span>
                    )}
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
                    <CommandInput
                        placeholder="Search sub-account..."
                        className="h-8 text-xs"
                        value={search}
                        onValueChange={setSearch}
                        autoFocus
                    />
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
    const [tree, setTree] = useState<ChartOfAccount[]>([]);

    // States for Master-Detail Grid Entry
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [entryLine, setEntryLine] = useState({
        accountId: "",
        tagAccountId: "",
        debit: 0,
        credit: 0,
        narration: "",
        refBillNo: "",
        refBillNo2: "",
        taxType: "" as "Taxable" | "BTL" | "REIMB" | "Exempt" | "",
    });

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
                      refBillNo2: d.refBillNo2 || "",
                      taxType: (d.taxType as "Taxable" | "BTL" | "REIMB" | "Exempt" | "") ?? "",
                  }))
                : [],
        },
    });

    const { fields, append, remove, replace, update } = useFieldArray({
        control: form.control,
        name: "details",
    });

    const watchDetails = form.watch("details") || [];
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [filterAccountId, setFilterAccountId] = useState<string>("");
    const [filterSubAccountId, setFilterSubAccountId] = useState<string>("");
    const [rowSearchQuery, setRowSearchQuery] = useState("");
     const [sortField, setSortField] = useState<"debit" | "credit" | null>(null);
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
    const [colFilterAccount, setColFilterAccount] = useState("");
    const [colFilterNarration, setColFilterNarration] = useState("");
    const [colFilterDebit, setColFilterDebit] = useState("");
    const [colFilterCredit, setColFilterCredit] = useState("");

    const handleSort = (field: "debit" | "credit") => {
        if (sortField === field) {
            if (sortOrder === "asc") {
                setSortOrder("desc");
            } else {
                setSortField(null);
            }
        } else {
            setSortField(field);
            setSortOrder("asc");
        }
    };

    // Clear sub-account filter if parent account filter changes
    useEffect(() => {
        setFilterSubAccountId("");
    }, [filterAccountId]);

    const selectedAccountIds = useMemo<string[]>(() => {
        return Array.from(new Set(watchDetails.map((d: any) => d.accountId as string).filter(Boolean)));
    }, [watchDetails.map((d: any) => d.accountId).join(",")]);

    const filterOptions = useMemo(() => {
        return selectedAccountIds.map(id => {
            const node = findInTree(tree, id);
            return {
                value: id,
                label: node ? `${node.code} - ${node.name}` : id
            };
        });
    }, [selectedAccountIds, tree]);

    const filterSubAccountOptions = useMemo(() => {
        if (tree.length === 0) return [];
        
        const usedSubAccountIds = Array.from(new Set(
            watchDetails
                .filter((d: any) => !filterAccountId || d.accountId === filterAccountId)
                .map((d: any) => d.tagAccountId as string)
                .filter(Boolean)
        ));

        const uniqueOptionsMap = new Map<string, { value: string; label: string }>();
        usedSubAccountIds.forEach(id => {
            const node = findInTree(tree, id);
            const code = node?.code || id;
            const label = node ? `${node.code} - ${node.name}` : id;
            if (!uniqueOptionsMap.has(code)) {
                uniqueOptionsMap.set(code, {
                    value: code,
                    label: label
                });
            }
        });

        return Array.from(uniqueOptionsMap.values());
    }, [filterAccountId, watchDetails, tree]);

    // Derive child sub-accounts for active line entry
    const activeLineChildren = useMemo(() => {
        const nodes = getSharedTree().length > 0 ? getSharedTree() : tree;
        if (!entryLine.accountId || nodes.length === 0) return [];
        const node = findInTree(nodes, entryLine.accountId);
        return getLeafSubAccounts(node);
    }, [entryLine.accountId, tree]);

    // Copy previous row values (F4 shortcut)
    const handleCopyPrevious = () => {
        const details = form.getValues("details") || [];
        if (details.length === 0) {
            toast.info("No previous row to copy from.");
            return;
        }
        const lastRow = details[details.length - 1];

        // Auto-calculate balanced amount
        const totalDebit = details.reduce((sum, d) => sum + (Number(d.debit) || 0), 0);
        const totalCredit = details.reduce((sum, d) => sum + (Number(d.credit) || 0), 0);
        const diff = totalDebit - totalCredit;

        let defaultDebit = 0;
        let defaultCredit = 0;
        if (diff > 0) {
            defaultCredit = diff;
        } else if (diff < 0) {
            defaultDebit = Math.abs(diff);
        }

        setEntryLine((prev) => ({
            ...prev,
            accountId: lastRow.accountId || "",
            tagAccountId: lastRow.tagAccountId || "",
            narration: lastRow.narration || "",
            refBillNo: lastRow.refBillNo || "",
            refBillNo2: lastRow.refBillNo2 || "",
            taxType: lastRow.taxType || "",
            debit: defaultDebit,
            credit: defaultCredit,
        }));
        toast.success("Copied details from last row.");
    };

    const handleCopyLastTagAccount = () => {
        const details = form.getValues("details") || [];
        const lastRowWithTag = [...details].reverse().find(d => d.tagAccountId);
        if (!lastRowWithTag) {
            toast.error("No previous rows with a Tag Sub-account found.");
            return;
        }
        setEntryLine(prev => ({
            ...prev,
            tagAccountId: lastRowWithTag.tagAccountId,
        }));
        toast.success("Copied Tag Sub-account.");
    };

    // Add or Update Line
    const handleAddOrUpdateLine = () => {
        if (!entryLine.accountId) {
            toast.error("Please select an Account Head.");
            return;
        }

        // Validate that Tag Sub-account is selected if the account head has children
        const nodes = getSharedTree().length > 0 ? getSharedTree() : tree;
        const node = findInTree(nodes, entryLine.accountId);
        const subAccounts = getLeafSubAccounts(node);
        if (node && subAccounts.length > 0 && !entryLine.tagAccountId) {
            toast.error("Tag Sub-account is required for this account head.");
            return;
        }

        const debitVal = Math.round(Number(entryLine.debit) || 0);
        const creditVal = Math.round(Number(entryLine.credit) || 0);

        if (debitVal === 0 && creditVal === 0) {
            toast.error("Please enter a positive Debit or Credit amount.");
            return;
        }

        if (debitVal > 0 && creditVal > 0) {
            toast.error("A line cannot have both Debit and Credit.");
            return;
        }

        const lineData = {
            ...entryLine,
            debit: debitVal,
            credit: creditVal,
            narration: entryLine.narration ? entryLine.narration.toUpperCase() : "",
        };

        if (editingIndex !== null) {
            update(editingIndex, lineData);
            setEditingIndex(null);
            toast.success(`Updated line #${editingIndex + 1}.`);
        } else {
            append(lineData);
            toast.success("Added new transaction line.");
        }

        // Reset Entry Line state
        setEntryLine(prev => ({
            accountId: "",
            tagAccountId: "",
            debit: 0,
            credit: 0,
            narration: prev.narration,
            refBillNo: prev.refBillNo,
            refBillNo2: prev.refBillNo2,
            taxType: "",
        }));

        // Refocus account selector
        setTimeout(() => {
            document.getElementById("entry-accountId")?.focus();
        }, 50);
    };

    // Keydown handler for keyboard-driven data entry
    const handleEntryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, fieldName: string) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (fieldName === "debit") {
                const val = Number(e.currentTarget.value) || 0;
                if (val > 0) {
                    handleAddOrUpdateLine();
                } else {
                    document.getElementById("entry-credit")?.focus();
                }
            } else if (fieldName === "credit") {
                handleAddOrUpdateLine();
            } else if (fieldName === "narration") {
                document.getElementById("entry-refBillNo")?.focus();
            } else if (fieldName === "refBillNo") {
                document.getElementById("entry-refBillNo2")?.focus();
            } else if (fieldName === "refBillNo2") {
                document.getElementById("entry-debit")?.focus();
            }
        }
    };

    const focusTaxType = () => {
        const activeOpt = entryLine.taxType || "Taxable";
        document.getElementById(`entry-taxType-${activeOpt}`)?.focus();
    };

    // Global listener for F4 and Alt+C keys
    useEffect(() => {
        const handleGlobalKeyDown = (e: KeyboardEvent) => {
            if (e.key === "F4") {
                e.preventDefault();
                handleCopyPrevious();
            }
            if (e.altKey && (e.key === "c" || e.key === "C")) {
                e.preventDefault();
                handleCopyLastTagAccount();
            }
        };
        window.addEventListener("keydown", handleGlobalKeyDown);
        return () => window.removeEventListener("keydown", handleGlobalKeyDown);
    }, [watchDetails]);

    // Poll for the shared tree until it's available (it loads lazily on first open)
    useEffect(() => {
        fetchSharedTree().then((t) => {
            if (t && t.length > 0) setTree(t);
        });
        const initial = getSharedTree();
        if (initial.length > 0) { setTree(initial); return; }
        const id = setInterval(() => {
            const t = getSharedTree();
            if (t.length > 0) { setTree(t); clearInterval(id); }
        }, 200);
        return () => clearInterval(id);
    }, []);

    // Derive child accounts for each row from the cached tree
    const rowChildren = useMemo(() => {
        const nodes = getSharedTree().length > 0 ? getSharedTree() : tree;
        return watchDetails.map((detail) => {
            if (!detail.accountId || nodes.length === 0) return [];
            const node = findInTree(nodes, detail.accountId);
            return getLeafSubAccounts(node);
        });
    }, [watchDetails.map((d) => d.accountId).join(","), tree]);

    // Auto-save draft logic (multiple drafts keyed by jvNo)
    const watchAllFields = form.watch();
    const voucherNo = watchAllFields.jvNo;
    useEffect(() => {
        if (initialData || !voucherNo) return;

        // Avoid saving empty drafts (no details, no description)
        const hasFormDetails = watchAllFields.details?.some((d: any) => d.accountId || (d.debit ?? 0) > 0 || (d.credit ?? 0) > 0 || d.narration || d.refBillNo);
        const hasDescription = !!watchAllFields.description;

        if (!hasFormDetails && !hasDescription) {
            // Delete draft if it exists to keep localStorage clean (e.g. if user cleared form)
            const draftsJson = localStorage.getItem("journal-voucher-drafts");
            if (draftsJson) {
                try {
                    const drafts = JSON.parse(draftsJson);
                    if (drafts[voucherNo]) {
                        delete drafts[voucherNo];
                        localStorage.setItem("journal-voucher-drafts", JSON.stringify(drafts));
                    }
                } catch {}
            }
            return;
        }

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
            // Validate all detail lines have a Tag Sub-account if the account has children
            const nodes = getSharedTree().length > 0 ? getSharedTree() : tree;
            for (let i = 0; i < values.details.length; i++) {
                const detail = values.details[i];
                const node = findInTree(nodes, detail.accountId);
                const subAccounts = getLeafSubAccounts(node);
                if (node && subAccounts.length > 0 && !detail.tagAccountId) {
                    toast.error(`Line #${i + 1}: Tag Sub-account is required for account "${node.name}".`);
                    return;
                }
            }

            setIsPending(true);
            const payload = {
                ...values,
                details: values.details.map((d) => ({
                    ...d,
                    debit: Math.round(Number(d.debit) || 0),
                    credit: Math.round(Number(d.credit) || 0),
                    narration: d.narration ? d.narration.toUpperCase() : undefined,
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
                if (initialData) {
                    router.push("/finance/journal-voucher/list");
                } else {
                    const currentDesc = form.getValues("description");
                    // Reset form for a new voucher
                    form.reset({
                        jvNo: `JV${new Date().getFullYear().toString().slice(-2)}${(new Date().getMonth() + 1).toString().padStart(2, "0")}${Math.floor(1000 + Math.random() * 9000)}`,
                        jvDate: new Date(),
                        description: currentDesc || "",
                        details: [],
                    });
                    setEntryLine(prev => ({
                        accountId: "",
                        tagAccountId: "",
                        debit: 0,
                        credit: 0,
                        narration: prev.narration,
                        refBillNo: prev.refBillNo,
                        refBillNo2: prev.refBillNo2,
                        taxType: "",
                    }));
                }
            } else {
                toast.error(result.message || (initialData ? "Failed to update Journal Voucher" : "Failed to create Journal Voucher"));
            }
        } catch {
            toast.error("An unexpected error occurred");
        } finally {
            setIsPending(false);
        }
    };



    const totalDebit = watchDetails.reduce((sum, d) => sum + (Number(d.debit) || 0), 0);
    const totalCredit = watchDetails.reduce((sum, d) => sum + (Number(d.credit) || 0), 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

    const visibleDetails = useMemo(() => {
        const query = rowSearchQuery.trim().toLowerCase();
        
        // Map details with originalIndex
        const detailsWithIndex = watchDetails.map((d: any, originalIndex: number) => ({
            ...d,
            originalIndex
        }));

        const filtered = detailsWithIndex.filter((detail: any) => {
            const matchesAccount = !filterAccountId || detail.accountId === filterAccountId;
            const accountNode = findInTree(tree, detail.accountId);
            const tagNode = accountNode?.children?.find(c => c.id === detail.tagAccountId);
            const subAccountCode = tagNode?.code || detail.tagAccountId;
            const matchesSubAccount = !filterSubAccountId || subAccountCode === filterSubAccountId;
            if (!matchesAccount || !matchesSubAccount) return false;

            const accountText = accountNode ? `${accountNode.code} ${accountNode.name}`.toLowerCase() : "";
            const tagText = tagNode ? `${tagNode.code} ${tagNode.name}`.toLowerCase() : "";
            const narrationText = (detail.narration || "").toLowerCase();
            const refText1 = (detail.refBillNo || "").toLowerCase();
            const refText2 = (detail.refBillNo2 || "").toLowerCase();

            // Column filters
            if (colFilterAccount && !accountText.includes(colFilterAccount.toLowerCase()) && !tagText.includes(colFilterAccount.toLowerCase())) {
                return false;
            }
            if (colFilterNarration && !narrationText.includes(colFilterNarration.toLowerCase()) && !refText1.includes(colFilterNarration.toLowerCase()) && !refText2.includes(colFilterNarration.toLowerCase())) {
                return false;
            }
            if (colFilterDebit && !(Number(detail.debit) > 0 && String(detail.debit).includes(colFilterDebit))) {
                return false;
            }
            if (colFilterCredit && !(Number(detail.credit) > 0 && String(detail.credit).includes(colFilterCredit))) {
                return false;
            }

            if (!query) return true;
            return accountText.includes(query) ||
                   tagText.includes(query) ||
                   narrationText.includes(query) ||
                   refText1.includes(query) ||
                   refText2.includes(query);
        });

        if (sortField) {
            filtered.sort((a: any, b: any) => {
                const valA = Number(a[sortField]) || 0;
                const valB = Number(b[sortField]) || 0;
                return sortOrder === "asc" ? valA - valB : valB - valA;
            });
        }

        return filtered;
    }, [watchDetails, filterAccountId, filterSubAccountId, rowSearchQuery, tree, sortField, sortOrder, colFilterAccount, colFilterNarration, colFilterDebit, colFilterCredit]);

    const displayedTotalDebit = useMemo(() => {
        return visibleDetails.reduce((sum, d) => sum + (Number(d.debit) || 0), 0);
    }, [visibleDetails]);

    const displayedTotalCredit = useMemo(() => {
        return visibleDetails.reduce((sum, d) => sum + (Number(d.credit) || 0), 0);
    }, [visibleDetails]);

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
            refBillNo2: fromRow.refBillNo2 || "",
            taxType: (fromRow.taxType ?? "") as "Taxable" | "BTL" | "REIMB" | "Exempt" | "",
        };
        
        if (targetIndex < currentDetails.length) {
            form.setValue(`details.${targetIndex}.debit`, oppositeRow.debit, { shouldValidate: true });
            form.setValue(`details.${targetIndex}.credit`, oppositeRow.credit, { shouldValidate: true });
            form.setValue(`details.${targetIndex}.narration`, oppositeRow.narration, { shouldValidate: true });
            form.setValue(`details.${targetIndex}.refBillNo`, oppositeRow.refBillNo, { shouldValidate: true });
            form.setValue(`details.${targetIndex}.refBillNo2`, oppositeRow.refBillNo2, { shouldValidate: true });
            form.setValue(`details.${targetIndex}.taxType`, oppositeRow.taxType, { shouldValidate: true });
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
                            <div className="flex gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsImportModalOpen(true)}
                                    disabled={isPending}
                                >
                                    <Upload className="h-4 w-4 mr-2" />
                                    Import Excel/CSV
                                </Button>
                            </div>
                        </div>

                        {/* ── Line Entry Card (Top Form) ── */}
                        <div className="p-4 rounded-xl border bg-muted/20 dark:bg-muted/5 border-border space-y-4 shadow-sm">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                                    {editingIndex !== null ? (
                                        <span className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                                            <span className="h-2.5 w-2.5 rounded-full bg-blue-500 animate-pulse" />
                                            Editing Line #{editingIndex + 1}
                                        </span>
                                    ) : (
                                        "Add Transaction Line"
                                    )}
                                </h3>
                                {editingIndex !== null && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs text-destructive hover:bg-destructive/10"
                                        onClick={() => {
                                            setEditingIndex(null);
                                            setEntryLine({
                                                accountId: "",
                                                tagAccountId: "",
                                                debit: 0,
                                                credit: 0,
                                                narration: "",
                                                refBillNo: "",
                                                refBillNo2: "",
                                                taxType: "",
                                            });
                                        }}
                                    >
                                        Cancel Edit
                                    </Button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                                <div className="md:col-span-4 space-y-1">
                                    <Label className="text-[11px] text-muted-foreground font-semibold">ACCOUNT HEAD *</Label>
                                    <ChartOfAccountSelect
                                        id="entry-accountId"
                                        value={entryLine.accountId}
                                        onValueChange={(val) => {
                                            setEntryLine(prev => ({ ...prev, accountId: val, tagAccountId: "" }));
                                            setTimeout(() => {
                                                const nodes = getSharedTree().length > 0 ? getSharedTree() : tree;
                                                const node = findInTree(nodes, val);
                                                const subAccounts = getLeafSubAccounts(node);
                                                if (subAccounts.length > 0) {
                                                    document.getElementById("entry-tagAccountId")?.focus();
                                                } else {
                                                    focusTaxType();
                                                }
                                            }, 50);
                                        }}
                                        placeholder="Select Account"
                                        excludeTags={true}
                                        disabled={isPending}
                                        mode="popover"
                                    />
                                </div>

                                {/* Tag/Sub-account Selection */}
                                <div className="md:col-span-4 space-y-1">
                                    <Label className="text-[11px] text-muted-foreground font-semibold">TAG SUB-ACCOUNT</Label>
                                    <TagAccountSelect
                                        id="entry-tagAccountId"
                                        children={activeLineChildren}
                                        value={entryLine.tagAccountId}
                                        onValueChange={(val) => {
                                            setEntryLine(prev => ({ ...prev, tagAccountId: val }));
                                            setTimeout(() => {
                                                if (val) {
                                                    focusTaxType();
                                                } else {
                                                    document.getElementById("entry-narration")?.focus();
                                                }
                                            }, 50);
                                        }}
                                        disabled={isPending || activeLineChildren.length === 0}
                                    />
                                </div>

                                {/* Tax Type Selection */}
                                <div className="md:col-span-4 space-y-1 select-none">
                                    <Label className="text-[11px] text-muted-foreground font-semibold">TAX TYPE</Label>
                                    <div className="flex h-9 items-center gap-1 border rounded-md px-1 bg-background border-input">
                                        {(["Taxable", "BTL", "REIMB", "Exempt"] as const).map((opt) => {
                                            const isSelected = entryLine.taxType === opt;
                                            const isFirst = opt === "Taxable";
                                            const tabIndex = entryLine.taxType ? (isSelected ? 0 : -1) : (isFirst ? 0 : -1);
                                            return (
                                                <button
                                                    key={opt}
                                                    id={`entry-taxType-${opt}`}
                                                    type="button"
                                                    disabled={isPending}
                                                    tabIndex={tabIndex}
                                                    onClick={() => {
                                                        setEntryLine(prev => ({
                                                            ...prev,
                                                            taxType: prev.taxType === opt ? "" : opt
                                                        }));
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                                                            e.preventDefault();
                                                            const opts = ["Taxable", "BTL", "REIMB", "Exempt"] as const;
                                                            const currentIndex = opts.indexOf(opt);
                                                            const nextIndex = e.key === "ArrowRight"
                                                                ? (currentIndex + 1) % opts.length
                                                                : (currentIndex - 1 + opts.length) % opts.length;
                                                            const nextOpt = opts[nextIndex];
                                                            setEntryLine(prev => ({ ...prev, taxType: nextOpt }));
                                                            setTimeout(() => {
                                                                document.getElementById(`entry-taxType-${nextOpt}`)?.focus();
                                                            }, 10);
                                                        } else if (e.key === "Enter") {
                                                            e.preventDefault();
                                                            document.getElementById("entry-narration")?.focus();
                                                        }
                                                    }}
                                                    className={cn(
                                                        "flex-1 flex items-center justify-center cursor-pointer py-1 rounded text-[10px] font-medium border transition-colors text-center h-7 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                                                        isSelected
                                                            ? "bg-primary text-primary-foreground border-primary"
                                                            : "border-transparent text-muted-foreground hover:bg-accent"
                                                    )}
                                                >
                                                    {opt}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                                {/* Narration */}
                                <div className="md:col-span-6 space-y-1">
                                    <Label className="text-[11px] text-muted-foreground font-semibold">LINE NARRATION</Label>
                                    <Input
                                        id="entry-narration"
                                        placeholder="Narration for this line..."
                                        value={entryLine.narration}
                                        onChange={(e) => setEntryLine(prev => ({ ...prev, narration: e.target.value }))}
                                        onKeyDown={(e) => handleEntryKeyDown(e, "narration")}
                                        disabled={isPending}
                                        className="h-9 border-input bg-background uppercase"
                                    />
                                </div>

                                {/* Ref 1 */}
                                <div className="md:col-span-3 space-y-1">
                                    <Label className="text-[11px] text-muted-foreground font-semibold">REF 1</Label>
                                    <Input
                                        id="entry-refBillNo"
                                        placeholder="Reference 1"
                                        value={entryLine.refBillNo}
                                        onChange={(e) => setEntryLine(prev => ({ ...prev, refBillNo: e.target.value }))}
                                        onKeyDown={(e) => handleEntryKeyDown(e, "refBillNo")}
                                        disabled={isPending}
                                        className="h-9 border-input bg-background"
                                    />
                                </div>

                                {/* Ref 2 */}
                                <div className="md:col-span-3 space-y-1">
                                    <Label className="text-[11px] text-muted-foreground font-semibold">REF 2</Label>
                                    <Input
                                        id="entry-refBillNo2"
                                        placeholder="Reference 2"
                                        value={entryLine.refBillNo2}
                                        onChange={(e) => setEntryLine(prev => ({ ...prev, refBillNo2: e.target.value }))}
                                        onKeyDown={(e) => handleEntryKeyDown(e, "refBillNo2")}
                                        disabled={isPending}
                                        className="h-9 border-input bg-background"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center pt-2">
                                {/* Debit */}
                                <div className="md:col-span-4 space-y-1">
                                    <Label className="text-[11px] text-muted-foreground font-semibold">DEBIT AMOUNT</Label>
                                    <Input
                                        id="entry-debit"
                                        type="number"
                                        step="1"
                                        placeholder="0"
                                        value={entryLine.debit || ""}
                                        onChange={(e) => {
                                            const rawVal = Number(e.target.value) || 0;
                                            const roundedVal = Math.round(rawVal);
                                            setEntryLine(prev => ({
                                                ...prev,
                                                debit: roundedVal,
                                                credit: roundedVal > 0 ? 0 : prev.credit
                                            }));
                                        }}
                                        onKeyDown={(e) => handleEntryKeyDown(e, "debit")}
                                        disabled={isPending}
                                        className="h-9 border-input bg-background font-mono text-sm font-semibold"
                                    />
                                </div>

                                {/* Credit */}
                                <div className="md:col-span-4 space-y-1">
                                    <Label className="text-[11px] text-muted-foreground font-semibold">CREDIT AMOUNT</Label>
                                    <Input
                                        id="entry-credit"
                                        type="number"
                                        step="1"
                                        placeholder="0"
                                        value={entryLine.credit || ""}
                                        onChange={(e) => {
                                            const rawVal = Number(e.target.value) || 0;
                                            const roundedVal = Math.round(rawVal);
                                            setEntryLine(prev => ({
                                                ...prev,
                                                credit: roundedVal,
                                                debit: roundedVal > 0 ? 0 : prev.debit
                                            }));
                                        }}
                                        onKeyDown={(e) => handleEntryKeyDown(e, "credit")}
                                        disabled={isPending}
                                        className="h-9 border-input bg-background font-mono text-sm font-semibold"
                                    />
                                </div>

                                {/* Form Action Buttons */}
                                <div className="md:col-span-4 flex gap-2 self-end pt-4 md:pt-0">
                                    <Button
                                        type="button"
                                        variant="default"
                                        onClick={handleAddOrUpdateLine}
                                        disabled={isPending}
                                        className="flex-1 h-9 shadow-sm font-semibold"
                                    >
                                        {editingIndex !== null ? "Update Line" : "Add Line"}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleCopyPrevious}
                                        disabled={isPending || watchDetails.length === 0}
                                        title="Copy previous row details (F4)"
                                        className="h-9 w-12 px-0 text-muted-foreground hover:text-foreground font-bold"
                                    >
                                        F4
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Filter Bar */}
                        {selectedAccountIds.length > 0 && (
                            <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/40 rounded-lg border border-dashed">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Filter by Account Head:</span>
                                    <div className="w-[280px]">
                                        <Autocomplete
                                            options={filterOptions}
                                            value={filterAccountId}
                                            onValueChange={setFilterAccountId}
                                            placeholder="All Accounts"
                                            searchPlaceholder="Search selected accounts..."
                                        />
                                    </div>
                                </div>

                                {filterSubAccountOptions.length > 0 && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Sub-account:</span>
                                        <div className="w-[280px]">
                                            <Autocomplete
                                                options={filterSubAccountOptions}
                                                value={filterSubAccountId}
                                                onValueChange={setFilterSubAccountId}
                                                placeholder="All Sub-accounts"
                                                searchPlaceholder="Search sub-accounts..."
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-muted-foreground uppercase whitespace-nowrap">Search Rows:</span>
                                    <div className="w-[220px]">
                                        <Input
                                            type="text"
                                            placeholder="Search narration, ref, etc..."
                                            value={rowSearchQuery}
                                            onChange={(e) => setRowSearchQuery(e.target.value)}
                                            className="h-9 bg-background border-input text-xs"
                                        />
                                    </div>
                                </div>

                                {(filterAccountId || filterSubAccountId || rowSearchQuery || colFilterAccount || colFilterNarration || colFilterDebit || colFilterCredit) && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setFilterAccountId("");
                                            setFilterSubAccountId("");
                                            setRowSearchQuery("");
                                            setColFilterAccount("");
                                            setColFilterNarration("");
                                            setColFilterDebit("");
                                            setColFilterCredit("");
                                        }}
                                        className="text-xs text-destructive hover:bg-destructive/10 h-9 px-3"
                                    >
                                        Clear Filters
                                    </Button>
                                )}
                            </div>
                        )}

                        {/* ── Transaction Lines List (Bottom Form) ── */}
                        <div className="border rounded-xl overflow-auto border-border bg-card max-h-[450px]">
                            <table className="w-full text-sm border-collapse">
                                <thead className="bg-muted text-muted-foreground border-b text-xs font-bold uppercase tracking-wider sticky top-0 z-10">
                                    <tr>
                                        <th className="px-4 py-3 text-left w-12 bg-muted/95 backdrop-blur-sm">#</th>
                                        <th className="px-4 py-3 text-left bg-muted/95 backdrop-blur-sm">Account Head & Tag</th>
                                        <th className="px-4 py-3 text-left bg-muted/95 backdrop-blur-sm">Narration & References</th>
                                        <th 
                                            className="px-4 py-3 text-right w-[150px] cursor-pointer hover:bg-muted select-none bg-muted/95 backdrop-blur-sm"
                                            onClick={() => handleSort("debit")}
                                        >
                                            <div className="flex items-center justify-end gap-1">
                                                <span>Debit</span>
                                                {sortField === "debit" ? (
                                                    sortOrder === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                                ) : (
                                                    <ArrowUpDown className="h-3 w-3 text-muted-foreground/30" />
                                                )}
                                            </div>
                                        </th>
                                        <th 
                                            className="px-4 py-3 text-right w-[150px] cursor-pointer hover:bg-muted select-none bg-muted/95 backdrop-blur-sm"
                                            onClick={() => handleSort("credit")}
                                        >
                                            <div className="flex items-center justify-end gap-1">
                                                <span>Credit</span>
                                                {sortField === "credit" ? (
                                                    sortOrder === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                                                ) : (
                                                    <ArrowUpDown className="h-3 w-3 text-muted-foreground/30" />
                                                )}
                                            </div>
                                        </th>
                                        <th className="px-4 py-3 text-center w-28 bg-muted/95 backdrop-blur-sm">Actions</th>
                                    </tr>
                                    <tr className="bg-muted/40 border-t border-border/60">
                                        <th className="px-2 py-1 bg-muted/95 backdrop-blur-sm"></th>
                                        <th className="px-2 py-1 bg-muted/95 backdrop-blur-sm">
                                            <Input
                                                placeholder="Filter account..."
                                                value={colFilterAccount}
                                                onChange={(e) => setColFilterAccount(e.target.value)}
                                                className="h-7 text-xs bg-background border-muted-foreground/25 font-normal normal-case"
                                            />
                                        </th>
                                        <th className="px-2 py-1 bg-muted/95 backdrop-blur-sm">
                                            <Input
                                                placeholder="Filter narration/ref..."
                                                value={colFilterNarration}
                                                onChange={(e) => setColFilterNarration(e.target.value)}
                                                className="h-7 text-xs bg-background border-muted-foreground/25 font-normal normal-case"
                                            />
                                        </th>
                                        <th className="px-2 py-1 bg-muted/95 backdrop-blur-sm">
                                            <Input
                                                placeholder="Filter debit..."
                                                value={colFilterDebit}
                                                onChange={(e) => setColFilterDebit(e.target.value)}
                                                className="h-7 text-xs text-right bg-background border-muted-foreground/25 font-normal normal-case"
                                            />
                                        </th>
                                        <th className="px-2 py-1 bg-muted/95 backdrop-blur-sm">
                                            <Input
                                                placeholder="Filter credit..."
                                                value={colFilterCredit}
                                                onChange={(e) => setColFilterCredit(e.target.value)}
                                                className="h-7 text-xs text-right bg-background border-muted-foreground/25 font-normal normal-case"
                                            />
                                        </th>
                                        <th className="px-2 py-1 bg-muted/95 backdrop-blur-sm"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {watchDetails.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                                                No lines added yet. Use the editor above to add lines.
                                            </td>
                                        </tr>
                                    ) : (
                                        visibleDetails.map((field, index) => {
                                            const nodes = getSharedTree().length > 0 ? getSharedTree() : tree;
                                            const accountNode = findInTree(nodes, field.accountId);
                                            const subAccounts = getLeafSubAccounts(accountNode);
                                            const tagNode = subAccounts.find(c => c.id === field.tagAccountId || c.code === field.tagAccountId);

                                            return (
                                                <tr
                                                    key={field.originalIndex}
                                                    className={cn(
                                                        "hover:bg-muted/20 align-top transition-colors",
                                                        editingIndex === field.originalIndex && "bg-blue-50/40 dark:bg-blue-950/15"
                                                    )}
                                                >
                                                    <td className="px-4 py-3 font-medium text-muted-foreground">{index + 1}</td>
                                                    <td className="px-4 py-3">
                                                        <div className="font-semibold text-foreground">
                                                            {accountNode ? `${accountNode.code} - ${accountNode.name}` : "Unknown Account"}
                                                        </div>
                                                        {tagNode && (
                                                            <div className="text-xs text-muted-foreground font-mono mt-0.5 flex items-center gap-1">
                                                                <span className="px-1.5 py-0.2 rounded bg-muted font-sans text-[9px] uppercase border font-semibold">Tag</span>
                                                                <span>{tagNode.code} - {tagNode.name}</span>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        navigator.clipboard.writeText(tagNode.name);
                                                                        toast.success(`Copied tag name: "${tagNode.name}"`);
                                                                    }}
                                                                    className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                                                                    title="Copy tag account name"
                                                                >
                                                                    <Copy className="h-3 w-3" />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        {field.narration ? (
                                                            <div className="italic text-muted-foreground text-xs">{field.narration}</div>
                                                        ) : (
                                                            <div className="text-muted-foreground/30 text-xs italic">No narration</div>
                                                        )}
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            {field.refBillNo && (
                                                                <span className="px-1.5 py-0.5 rounded bg-muted border text-[9px] font-mono">Ref1: {field.refBillNo}</span>
                                                            )}
                                                            {field.refBillNo2 && (
                                                                <span className="px-1.5 py-0.5 rounded bg-muted border text-[9px] font-mono">Ref2: {field.refBillNo2}</span>
                                                            )}
                                                            {field.taxType && (
                                                                <span className="px-1.5 py-0.5 rounded bg-muted border text-[9px] text-blue-600 dark:text-blue-400 font-semibold uppercase">{field.taxType}</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-foreground">
                                                        {field.debit > 0 ? field.debit.toLocaleString() : "—"}
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums text-foreground">
                                                        {field.credit > 0 ? field.credit.toLocaleString() : "—"}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => {
                                                                    setEditingIndex(field.originalIndex);
                                                                    setEntryLine({
                                                                        accountId: field.accountId,
                                                                        tagAccountId: field.tagAccountId || "",
                                                                        debit: field.debit,
                                                                        credit: field.credit,
                                                                        narration: field.narration || "",
                                                                        refBillNo: field.refBillNo || "",
                                                                        refBillNo2: field.refBillNo2 || "",
                                                                        taxType: field.taxType || "",
                                                                    });
                                                                    setTimeout(() => {
                                                                        document.getElementById("entry-accountId")?.focus();
                                                                    }, 50);
                                                                }}
                                                                disabled={isPending}
                                                                title="Edit line"
                                                                className="rounded-full h-8 w-8 hover:bg-muted text-muted-foreground hover:text-foreground"
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => duplicateRowToOpposite(field.originalIndex)}
                                                                disabled={isPending}
                                                                title="Duplicate row data and swap debit/credit"
                                                                className="rounded-full hover:bg-blue-50 dark:hover:bg-blue-950/20 text-blue-600 h-8 w-8"
                                                            >
                                                                <Copy className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => {
                                                                    remove(field.originalIndex);
                                                                    if (editingIndex === field.originalIndex) {
                                                                        setEditingIndex(null);
                                                                        setEntryLine({
                                                                            accountId: "",
                                                                            tagAccountId: "",
                                                                            debit: 0,
                                                                            credit: 0,
                                                                            narration: "",
                                                                            refBillNo: "",
                                                                            refBillNo2: "",
                                                                            taxType: "",
                                                                        });
                                                                    }
                                                                }}
                                                                disabled={isPending}
                                                                title="Delete line"
                                                                className="rounded-full h-8 w-8 text-destructive hover:bg-destructive/10"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                                <tfoot className="font-bold border-t border-border bg-card text-foreground sticky bottom-0 z-10 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
                                    <tr>
                                        <td colSpan={3} className="px-4 py-4 text-right pr-8 text-muted-foreground text-xs uppercase tracking-wider bg-card">Totals:</td>
                                        <td className="px-4 py-4 text-right text-base font-mono tabular-nums bg-card">
                                            {displayedTotalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-4 text-right text-base font-mono tabular-nums bg-card">
                                            {displayedTotalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-4 text-center bg-card">
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
                            Description
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
                    <VoucherImportModal
                        open={isImportModalOpen}
                        onOpenChange={setIsImportModalOpen}
                        voucherType="journal"
                        onImportComplete={(importedRows) => {
                            replace(importedRows);
                            toast.success(`Successfully imported ${importedRows.length} rows.`);
                        }}
                    />
                </form>
            </CardContent>
        </Card>
    );
}
