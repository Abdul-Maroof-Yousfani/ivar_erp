"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Loader2, CreditCard, Wallet, Copy, Upload, Pencil, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { VoucherImportModal } from "@/components/finance/voucher-import-modal";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createReceiptVoucher, updateReceiptVoucher, getAllCustomers, getPendingInvoicesByCustomer, type ReceiptVoucher } from "@/lib/actions/receipt-voucher";
import { ChartOfAccount } from "@/lib/actions/chart-of-account";
import { ChartOfAccountSelect, getSharedTree, fetchSharedTree } from "@/components/ui/chart-of-account-select";
import { cn } from "@/lib/utils";
import { calculateTaxForAccount } from "@/lib/utils/tax-calculator";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

// ─── Tag account selector ─────────────────────────────────────────────────────
function TagAccountSelect({ children, value, onValueChange, disabled, id }: {
    children: ChartOfAccount[];
    value?: string;
    onValueChange: (v: string) => void;
    disabled?: boolean;
    id?: string;
}) {
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
                        {selected ? `${selected.code} - ${selected.name}` : "Tag sub-account (optional)"}
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
                    <ChevronDownIcon className={cn("ml-1 h-3 w-3 shrink-0 text-muted-foreground transition-transform duration-200", open && "rotate-180")} />
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

type InvoiceReceiptEntry = {
    salesInvoiceId: string;
    invoiceNo: string;
    grandTotal: number;
    paidAmount: number;
    balanceAmount: number;
    receivingNow: number;
};

export function ReceiptVoucherForm({ initialData, defaultType = "bank" }: { initialData?: any; defaultType?: "bank" | "cash" | "rs_rv" }) {
    const router = useRouter();
    const isRestoring = useRef(false);
    const [isPending, setIsPending] = useState(false);
    const [customers, setCustomers] = useState<any[]>([]);
    const [pendingInvoices, setPendingInvoices] = useState<any[]>([]);
    const [selectedInvoices, setSelectedInvoices] = useState<InvoiceReceiptEntry[]>([]);
    const [loadingCustomers, setLoadingCustomers] = useState(true);
    const [tree, setTree] = useState<ChartOfAccount[]>([]);

    const form = useForm<ReceiptVoucherFormValues>({
        resolver: zodResolver(receiptVoucherSchema) as any,
        defaultValues: {
            type: initialData?.type || defaultType,
            rvNo: initialData?.rvNo || "",
            rvDate: initialData?.rvDate ? new Date(initialData.rvDate) : new Date(),
            refBillNo: initialData?.refBillNo || "",
            billDate: initialData?.billDate ? new Date(initialData.billDate) : undefined,
            chequeNo: initialData?.chequeNo || "",
            chequeDate: initialData?.chequeDate ? new Date(initialData.chequeDate) : undefined,
            description: initialData?.description || "",
            customerId: initialData?.customerId || "",
            isAdvance: initialData?.isAdvance ?? false,
            taxType: (initialData?.taxType as "Taxable" | "BTL" | "REIMB" | "Exempt" | "") ?? "",
            invoices: initialData?.invoices || [],
            details: initialData?.details
                ? initialData.details.map((d: any) => ({
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

    const { fields, append, remove, replace, update } = useFieldArray({ control: form.control, name: "details" });
    const watchDetails = form.watch("details") || [];

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
        if (!entryLine.accountId || tree.length === 0) return [];
        const node = findInTree(tree, entryLine.accountId);
        return node?.children ?? [];
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
        if (node && (node.children?.length ?? 0) > 0 && !entryLine.tagAccountId) {
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

    const voucherType = form.watch("type");

    // Poll for shared tree
    useEffect(() => {
        fetchSharedTree();
        const initial = getSharedTree();
        if (initial.length > 0) { setTree(initial); return; }
        const id = setInterval(() => {
            const t = getSharedTree();
            if (t.length > 0) { setTree(t); clearInterval(id); }
        }, 300);
        return () => clearInterval(id);
    }, []);



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

    useEffect(() => {
        if (initialData) return;
        if (isRestoring.current) return;
        const prefix = voucherType === "bank" ? "BRV" : "CRV";
        const datePart = `${new Date().getFullYear().toString().slice(-2)}${(new Date().getMonth() + 1).toString().padStart(2, '0')}`;
        form.setValue("rvNo", `${prefix}${datePart}${Math.floor(1000 + Math.random() * 9000)}`);
    }, [voucherType, form, initialData]);

    useEffect(() => {
        getAllCustomers().then(r => {
            setCustomers(r.status ? r.data : []);
            setLoadingCustomers(false);
        });
    }, []);

    // Load selected invoices from initialData
    useEffect(() => {
        if (initialData && initialData.invoices && Array.isArray(initialData.invoices)) {
            const mappedInvoices = initialData.invoices.map((inv: any) => {
                const si = inv.salesInvoice || {};
                return {
                    salesInvoiceId: inv.salesInvoiceId,
                    invoiceNo: si.invoiceNo || "",
                    grandTotal: Number(si.grandTotal) || 0,
                    paidAmount: Number(si.paidAmount) || 0,
                    balanceAmount: Number(si.balanceAmount) || 0,
                    receivingNow: Number(inv.receivedAmount) || 0,
                };
            });
            setSelectedInvoices(mappedInvoices);
        }
    }, [initialData]);

    const selectedCustomerId = form.watch("customerId");
    useEffect(() => {
        if (selectedCustomerId) {
            getPendingInvoicesByCustomer(selectedCustomerId).then(r => {
                let list = (r.status ? r.data : []).filter((inv: any) => Number(inv.balanceAmount) > 0);
                if (initialData?.invoices && Array.isArray(initialData.invoices)) {
                    initialData.invoices.forEach((inv: any) => {
                        if (!list.find((x: any) => x.id === inv.salesInvoiceId)) {
                            const si = inv.salesInvoice || {};
                            list.push({
                                id: inv.salesInvoiceId,
                                invoiceNo: si.invoiceNo || "",
                                grandTotal: Number(si.grandTotal) || 0,
                                paidAmount: Number(si.paidAmount) || 0,
                                balanceAmount: Number(si.balanceAmount) || 0,
                            });
                        }
                    });
                }
                setPendingInvoices(list);
            });
        } else {
            setPendingInvoices([]);
            setSelectedInvoices([]);
        }
    }, [selectedCustomerId, initialData]);

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
    const totalSelectedInvoicesAmount = selectedInvoices.reduce((s, i) => s + (i.grandTotal || 0), 0);
    const totalSelectedInvoicesPaid = selectedInvoices.reduce((s, i) => s + (i.paidAmount || 0), 0);
    const totalSelectedInvoicesBalance = selectedInvoices.reduce((s, i) => s + (i.balanceAmount || 0), 0);

    const duplicateRowToOpposite = (fromIndex: number) => {
        const fromRow = form.getValues(`details.${fromIndex}`);
        const debitVal = Math.round(Number(fromRow.debit) || 0);
        const creditVal = Math.round(Number(fromRow.credit) || 0);
        
        const val = Math.round(debitVal || creditVal);
        const isFromDebit = debitVal > 0;
        
        const targetIndex = fromIndex + 1;
        const currentDetails = form.getValues("details") || [];
        
        const oppositeRow = {
            accountId: fromRow.accountId || "",
            tagAccountId: fromRow.tagAccountId || "",
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
            if (oppositeRow.accountId) form.setValue(`details.${targetIndex}.accountId`, oppositeRow.accountId, { shouldValidate: true });
            if (oppositeRow.tagAccountId) form.setValue(`details.${targetIndex}.tagAccountId`, oppositeRow.tagAccountId, { shouldValidate: true });
        } else {
            append(oppositeRow);
        }
    };



    const totalDebit = watchDetails.reduce((sum: number, detail: any) => sum + (Number(detail.debit) || 0), 0);
    const totalCredit = watchDetails.reduce((sum: number, detail: any) => sum + (Number(detail.credit) || 0), 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

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

    // Auto-save draft logic (multiple drafts keyed by rvNo)
    const watchAllFields = form.watch();
    const voucherNo = watchAllFields.rvNo;
    useEffect(() => {
        if (initialData || !voucherNo) return;

        // Avoid saving empty drafts (no details, no description, no customer, no cheque/refs)
        const hasFormDetails = watchAllFields.details?.some((d: any) => d.accountId || (d.debit ?? 0) > 0 || (d.credit ?? 0) > 0 || d.narration || d.refBillNo);
        const hasInvoices = selectedInvoices.length > 0;
        const hasDescriptionOrCustomer = watchAllFields.description || watchAllFields.customerId;
        const hasReferenceOrCheque = watchAllFields.refBillNo || watchAllFields.chequeNo;

        if (!hasFormDetails && !hasInvoices && !hasDescriptionOrCustomer && !hasReferenceOrCheque) {
            // Delete draft if it exists to keep localStorage clean (e.g. if user cleared form)
            const draftsJson = localStorage.getItem("receipt-voucher-drafts");
            if (draftsJson) {
                try {
                    const drafts = JSON.parse(draftsJson);
                    if (drafts[voucherNo]) {
                        delete drafts[voucherNo];
                        localStorage.setItem("receipt-voucher-drafts", JSON.stringify(drafts));
                    }
                } catch {}
            }
            return;
        }

        const draftData = {
            formValues: watchAllFields,
            selectedInvoices,
        };
        const timeout = setTimeout(() => {
            const draftsJson = localStorage.getItem("receipt-voucher-drafts") || "{}";
            try {
                const drafts = JSON.parse(draftsJson);
                drafts[voucherNo] = {
                    voucherNo,
                    updatedAt: new Date().toISOString(),
                    ...draftData,
                };
                localStorage.setItem("receipt-voucher-drafts", JSON.stringify(drafts));
            } catch (e) {
                console.error("Error saving draft", e);
            }
        }, 1000);
        return () => clearTimeout(timeout);
    }, [watchAllFields, voucherNo, selectedInvoices, initialData]);

    // Restore draft logic
    useEffect(() => {
        if (initialData) return;

        // Check if there's a specific draftId query parameter
        const urlParams = new URLSearchParams(window.location.search);
        const urlDraftId = urlParams.get("draftId");

        const draftsJson = localStorage.getItem("receipt-voucher-drafts");
        if (!draftsJson) return;

        try {
            const drafts = JSON.parse(draftsJson);

            if (urlDraftId) {
                const draft = drafts[urlDraftId];
                if (draft && draft.formValues) {
                    isRestoring.current = true;
                    if (draft.formValues.rvDate) draft.formValues.rvDate = new Date(draft.formValues.rvDate);
                    if (draft.formValues.billDate) draft.formValues.billDate = new Date(draft.formValues.billDate);
                    if (draft.formValues.chequeDate) draft.formValues.chequeDate = new Date(draft.formValues.chequeDate);
                    form.reset(draft.formValues);
                    if (draft.selectedInvoices) setSelectedInvoices(draft.selectedInvoices);
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
                    const hasInvoices = draft.selectedInvoices?.length > 0;
                    const hasDescriptionOrCustomer = draft.formValues?.description || draft.formValues?.customerId;

                    if (hasFormDetails || hasInvoices || hasDescriptionOrCustomer) {
                        toast(`You have an unsaved draft (${singleKey}).`, {
                            action: {
                                label: "Restore",
                                onClick: () => {
                                    isRestoring.current = true;
                                    if (draft.formValues) {
                                        if (draft.formValues.rvDate) draft.formValues.rvDate = new Date(draft.formValues.rvDate);
                                        if (draft.formValues.billDate) draft.formValues.billDate = new Date(draft.formValues.billDate);
                                        if (draft.formValues.chequeDate) draft.formValues.chequeDate = new Date(draft.formValues.chequeDate);
                                        form.reset(draft.formValues);
                                    }
                                    if (draft.selectedInvoices) setSelectedInvoices(draft.selectedInvoices);
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
                                    localStorage.setItem("receipt-voucher-drafts", JSON.stringify(drafts));
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
                                router.push("/erp/finance/receipt-voucher/list");
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

    const onSubmit: SubmitHandler<ReceiptVoucherFormValues> = async (values) => {
        try {
            // Validate all detail lines have a Tag Sub-account if the account has children
            const nodes = getSharedTree().length > 0 ? getSharedTree() : tree;
            for (let i = 0; i < values.details.length; i++) {
                const detail = values.details[i];
                const node = findInTree(nodes, detail.accountId);
                if (node && (node.children?.length ?? 0) > 0 && !detail.tagAccountId) {
                    toast.error(`Line #${i + 1}: Tag Sub-account is required for account "${node.name}".`);
                    return;
                }
            }

            setIsPending(true);
            
            console.log('Form submission started');
            console.log('Form values:', values);

            if (selectedInvoices.length > 0 && totalInvoiceReceipts > totalDebit + 0.01) {
                toast.error(`Invoice receipts (${totalInvoiceReceipts.toLocaleString()}) exceed voucher debit (${totalDebit.toLocaleString()})`);
                return;
            }

            // Find debit account and amount from details
            const debitEntry = watchDetails.find(detail => Number(detail.debit) > 0);
            const mainDebitAccountId = debitEntry?.accountId || "";

            const finalData = {
                ...values,
                debitAccountId: mainDebitAccountId || values.debitAccountId,
                debitAmount: totalDebit || values.debitAmount,
                details: watchDetails
                    .filter(detail => Math.round(Number(detail.debit) || 0) > 0 || Math.round(Number(detail.credit) || 0) > 0)
                    .map(detail => ({
                        accountId: detail.accountId,
                        tagAccountId: detail.tagAccountId || undefined,
                        debit: Math.round(Number(detail.debit) || 0),
                        credit: Math.round(Number(detail.credit) || 0),
                        narration: detail.narration ? detail.narration.toUpperCase() : undefined,
                        refBillNo: detail.refBillNo || undefined,
                        refBillNo2: detail.refBillNo2 || undefined,
                        taxType: detail.taxType ?? "Taxable",
                    })),
                invoices: selectedInvoices.length > 0
                    ? selectedInvoices.map(i => ({ salesInvoiceId: i.salesInvoiceId, receivedAmount: i.receivingNow }))
                    : undefined,
            };

            console.log('Final data being sent:', finalData);

            const result = initialData
                ? await updateReceiptVoucher(initialData.id, finalData)
                : await createReceiptVoucher(finalData);
            
            console.log('API result:', result);

            if (result.status) {
                if (!initialData && voucherNo) {
                    const draftsJson = localStorage.getItem("receipt-voucher-drafts");
                    if (draftsJson) {
                        try {
                            const drafts = JSON.parse(draftsJson);
                            delete drafts[voucherNo];
                            localStorage.setItem("receipt-voucher-drafts", JSON.stringify(drafts));
                        } catch {}
                    }
                }
                if (initialData || finalData.type === "rs_rv" || defaultType === "rs_rv") {
                    router.push(finalData.type === "rs_rv" || defaultType === "rs_rv" ? "/erp/finance/retail-sale-receipt-voucher/list" : "/erp/finance/receipt-voucher/list");
                } else {
                    const currentRefBillNo = form.getValues("refBillNo");
                    const currentChequeNo = form.getValues("chequeNo");
                    const currentDesc = form.getValues("description");
                    
                    form.reset({
                        type: voucherType || "bank",
                        rvNo: `${voucherType === "bank" ? "BRV" : "CRV"}${new Date().getFullYear().toString().slice(-2)}${(new Date().getMonth() + 1).toString().padStart(2, '0')}${Math.floor(1000 + Math.random() * 9000)}`,
                        rvDate: new Date(),
                        customerId: "",
                        refBillNo: currentRefBillNo || "",
                        chequeNo: currentChequeNo || "",
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
                    
                    setSelectedInvoices([]);
                }
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
                <CardTitle>{initialData ? "Edit Receipt Voucher" : `Create ${voucherType === "bank" ? "Bank" : "Cash"} Receipt Voucher`}</CardTitle>
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

                    {/* ── Advance Receipt toggle + guidance ── */}
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
                                Advance Receipt
                                <span className="ml-2 font-normal text-muted-foreground">(receiving payment before a sales invoice is created)</span>
                            </Label>
                        </div>

                        {form.watch("isAdvance") ? (
                            <div className="rounded-md bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-3 text-xs space-y-1.5">
                                <p className="font-semibold text-blue-800 dark:text-blue-300">✦ Advance Receipt — account heads to use:</p>
                                <div className="grid grid-cols-2 gap-2 mt-1">
                                    <div className="bg-white dark:bg-blue-950/40 rounded p-2 border border-blue-100 dark:border-blue-800">
                                        <p className="font-bold text-blue-700 dark:text-blue-400">Row 1 — Credit</p>
                                        <p className="text-blue-900 dark:text-blue-200 font-mono">Customer Advance Account / Payable</p>
                                        <p className="text-muted-foreground mt-0.5">Records the liability of advance receipt</p>
                                    </div>
                                    <div className="bg-white dark:bg-blue-950/40 rounded p-2 border border-blue-100 dark:border-blue-800">
                                        <p className="font-bold text-blue-700 dark:text-blue-400">Row 2 — Debit</p>
                                        <p className="text-blue-900 dark:text-blue-200 font-mono">Bank / Cash account</p>
                                        <p className="text-muted-foreground mt-0.5">Money entering your bank or cash</p>
                                    </div>
                                </div>
                                <p className="text-muted-foreground pt-1">Leave invoices unchecked. This will be booked as a customer advance.</p>
                            </div>
                        ) : (
                            <div className="rounded-md bg-muted/40 border border-border p-3 text-xs space-y-1.5">
                                <p className="font-semibold text-foreground">✦ Regular Receipt — account heads to use:</p>
                                <div className="grid grid-cols-2 gap-2 mt-1">
                                    <div className="bg-background rounded p-2 border border-border">
                                        <p className="font-bold">Row 1 — Credit</p>
                                        <p className="font-mono text-muted-foreground">Accounts Receivable (A/R) / Customers</p>
                                        <p className="text-muted-foreground mt-0.5">Clears the customer outstanding balance</p>
                                    </div>
                                    <div className="bg-background rounded p-2 border border-border">
                                        <p className="font-bold">Row 2 — Debit</p>
                                        <p className="font-mono text-muted-foreground">Bank / Cash account</p>
                                        <p className="text-muted-foreground mt-0.5">The received amount entering bank or cash</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

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
                                <div className="flex items-center gap-2">
                                    <div className="flex-1">
                                        <Autocomplete
                                            options={customers.map(c => ({ value: c.id, label: `${c.code} - ${c.name}` }))}
                                            value={field.value}
                                            onValueChange={field.onChange}
                                            placeholder={loadingCustomers ? "Loading customers..." : "Select Customer (Optional)"}
                                            disabled={loadingCustomers}
                                        />
                                    </div>
                                    {field.value && (() => {
                                        const selectedCustomer = customers.find(c => c.id === field.value);
                                        return selectedCustomer ? (
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="icon"
                                                className="h-10 w-10 shrink-0"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(selectedCustomer.name);
                                                    toast.success(`Copied customer name: "${selectedCustomer.name}"`);
                                                }}
                                                title="Copy Customer Name"
                                            >
                                                <Copy className="h-4 w-4" />
                                            </Button>
                                        ) : null;
                                    })()}
                                </div>
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
                                                        <td colSpan={2} className="px-3 py-2 text-right text-muted-foreground">Totals:</td>
                                                        <td className="px-3 py-2 text-right tabular-nums font-mono">
                                                            {totalSelectedInvoicesAmount.toLocaleString()}
                                                        </td>
                                                        <td className="px-3 py-2 text-right tabular-nums font-mono text-muted-foreground">
                                                            {totalSelectedInvoicesPaid.toLocaleString()}
                                                        </td>
                                                        <td className="px-3 py-2 text-right tabular-nums font-mono text-red-500">
                                                            {totalSelectedInvoicesBalance.toLocaleString()}
                                                        </td>
                                                        <td className={`px-3 py-2 text-right tabular-nums font-mono ${totalInvoiceReceipts > displayedTotalDebit + 0.01 ? "text-red-500" : "text-green-600"}`}>
                                                            {totalInvoiceReceipts.toLocaleString()}
                                                        </td>
                                                        <td />
                                                    </tr>
                                                </tfoot>
                                            )}
                                        </table>
                                    </div>
                                )}
                                {totalInvoiceReceipts > displayedTotalDebit + 0.01 && (
                                    <p className="text-xs text-red-500 font-medium">
                                        ⚠ Invoice receipts ({totalInvoiceReceipts.toLocaleString()}) exceed voucher debit ({displayedTotalDebit.toLocaleString()}).
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="space-y-4 pt-4">
                        <div className="flex items-center justify-between border-b pb-2">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800 dark:text-foreground">{voucherType === "bank" ? "Bank" : "Cash"} Receipt Voucher Detail</h2>
                                {form.watch("isAdvance") ? (
                                    <p className="text-xs text-muted-foreground mt-0.5">Debit: <span className="font-mono font-semibold">Bank / Cash account</span> &nbsp;|&nbsp; Credit: <span className="font-mono font-semibold">Customer Advance Account</span></p>
                                ) : (
                                    <p className="text-xs text-muted-foreground mt-0.5">Debit: <span className="font-mono font-semibold">Bank / Cash account</span> &nbsp;|&nbsp; Credit: <span className="font-mono font-semibold">A/R PARTIES</span></p>
                                )}
                            </div>
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
                                {/* Account Selector */}
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
                                                const hasChildren = (node?.children?.length ?? 0) > 0;
                                                if (hasChildren) {
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
                                <div className="md:col-span-8 space-y-1">
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
                                <div className="md:col-span-2 space-y-1">
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
                                <div className="md:col-span-2 space-y-1">
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
                                            const accountNode = findInTree(tree, field.accountId);
                                            const tagNode = accountNode?.children?.find(c => c.id === field.tagAccountId);

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
                                            {!isBalanced && totalDebit > 0 && (
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

                    {/* Description */}
                    <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground uppercase font-semibold">Description</Label>
                        <Textarea {...form.register("description")} placeholder="Enter description for this receipt voucher" />
                        {form.formState.errors.description && (
                            <p className="text-xs text-destructive">{form.formState.errors.description.message}</p>
                        )}
                    </div>

                    <div className="flex justify-center gap-3 pt-6 border-t">
                        <Button
                            type="submit"
                            variant="outline"
                            disabled={isPending || !isBalanced}
                            onClick={() => form.setValue("status", "draft")}
                        >
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save as Draft
                        </Button>
                        <Button
                            type="submit"
                            disabled={isPending || !isBalanced}
                            onClick={() => form.setValue("status", "pending_check")}
                        >
                            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {initialData ? "Update & Submit for Check" : "Submit for Check"}
                        </Button>
                    </div>

                    <VoucherImportModal
                        open={isImportModalOpen}
                        onOpenChange={setIsImportModalOpen}
                        voucherType="receipt"
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