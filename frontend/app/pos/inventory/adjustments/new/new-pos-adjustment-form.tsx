"use client";

import React, { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    Card, CardContent, CardDescription, CardHeader, CardTitle
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
    Search, Trash, Loader2, RefreshCw, AlertCircle, CheckCircle, Info, Repeat,
    ClipboardList, Plus
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    createStockAdjustment,
    searchInventoryItems,
} from "@/lib/actions/stock-adjustment";
import { bulkSearchItems } from "@/lib/actions/items";
import { toast } from "sonner";

interface Warehouse {
    id: string;
    code: string;
    name: string;
}

interface Location {
    id: string;
    name: string;
    code: string;
}

interface NewPosAdjustmentFormProps {
    warehouse: Warehouse;
    location: Location;
}

interface SelectedItem {
    id: string;
    sku: string;
    description: string | null;
    currentQty: number;
    physicalQty: number;
    rate: number;
    color?: string | null;
    size?: string | null;
}

interface ParsedPasteItem {
    query: string;
    qty?: number;
    isExplicitDelta: boolean;
}

const REASONS = [
    { value: "Billing Mistake (Wrong Item Scanned)", label: "Billing Mistake (Wrong Item Scanned)" },
    { value: "Wrong Stock Swapped", label: "Wrong Stock Swapped" },
    { value: "Physical Mistake / Handover Error", label: "Physical Mistake / Handover Error" },
    { value: "Item Code Mismatch", label: "Item Code Mismatch" },
    { value: "Physical Damage Replacement", label: "Physical Damage Replacement" },
    { value: "Other / Mismatch Correction", label: "Other / Mismatch Correction" },
];

function parseQuickPasteText(content: string): ParsedPasteItem[] {
    if (!content || !content.trim()) return [];

    const headerKeywords = new Set([
        "barcode",
        "barcodes",
        "quantity",
        "qty",
        "sku",
        "skus",
        "item",
        "items",
        "description",
        "code",
        "physical",
        "count",
    ]);

    const rawTokens = content
        .split(/[\r\n\t,;|]+/)
        .map((t) => t.trim())
        .filter(Boolean);

    const tokens: string[] = [];
    for (const rawToken of rawTokens) {
        const parts = rawToken.split(/\s+/).filter(Boolean);
        tokens.push(...parts);
    }

    const cleanTokens = tokens.filter((t) => !headerKeywords.has(t.toLowerCase()));
    const results: ParsedPasteItem[] = [];
    let i = 0;

    while (i < cleanTokens.length) {
        const token = cleanTokens[i];

        const isSigned = token.startsWith("-") || token.startsWith("+");
        const isSmallNumber = !isNaN(Number(token)) && Math.abs(Number(token)) < 10000;
        const isBarcodeOrSku = token.length >= 6 || isNaN(Number(token)) || (!isSigned && Number(token) > 10000);

        if (!isBarcodeOrSku && (isSigned || isSmallNumber)) {
            i++;
            continue;
        }

        const query = token;
        let qty: number | undefined = undefined;
        let isExplicitDelta = false;

        if (i + 1 < cleanTokens.length) {
            const nextToken = cleanTokens[i + 1];
            const nextIsSigned = nextToken.startsWith("-") || nextToken.startsWith("+");
            const nextVal = Number(nextToken);

            if (!isNaN(nextVal) && (nextIsSigned || Math.abs(nextVal) < 100000) && nextToken.length < 7) {
                qty = nextVal;
                isExplicitDelta = nextIsSigned;
                i++;
            }
        }

        results.push({ query, qty, isExplicitDelta });
        i++;
    }

    return results;
}

export function NewPosAdjustmentForm({ warehouse, location }: NewPosAdjustmentFormProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const [tabMode, setTabMode] = useState<"swap" | "standard">("swap");
    const [reason, setReason] = useState<string>("");
    const [notes, setNotes] = useState<string>("");

    // --- SWAP MODE STATE ---
    const [swapOutQuery, setSwapOutQuery] = useState<string>("");
    const [swapOutResults, setSwapOutResults] = useState<any[]>([]);
    const [isSearchingOut, setIsSearchingOut] = useState(false);
    const [selectedOutItem, setSelectedOutItem] = useState<any | null>(null);

    const [swapInQuery, setSwapInQuery] = useState<string>("");
    const [swapInResults, setSwapInResults] = useState<any[]>([]);
    const [isSearchingIn, setIsSearchingIn] = useState(false);
    const [selectedInItem, setSelectedInItem] = useState<any | null>(null);

    const [swapQty, setSwapQty] = useState<number>(1);
    const [swapRate, setSwapRate] = useState<number>(0);

    // --- STANDARD MODE STATE ---
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);

    // Quick Paste state
    const [inputMode, setInputMode] = useState<"search" | "paste">("search");
    const [pasteContent, setPasteContent] = useState<string>("");
    const [pasteAdjustmentMode, setPasteAdjustmentMode] = useState<"relative" | "absolute">("relative");
    const [isResolvingPaste, setIsResolvingPaste] = useState<boolean>(false);

    // Debounce searches
    useEffect(() => {
        if (!swapOutQuery.trim() || !warehouse?.id || !location?.id) {
            setSwapOutResults([]);
            return;
        }
        const delayDebounceFn = setTimeout(async () => {
            setIsSearchingOut(true);
            try {
                const res = await searchInventoryItems(swapOutQuery, warehouse.id, location.id);
                if (res.status && Array.isArray(res.data)) {
                    setSwapOutResults(res.data);
                } else {
                    setSwapOutResults([]);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setIsSearchingOut(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [swapOutQuery, warehouse?.id, location?.id]);

    useEffect(() => {
        if (!swapInQuery.trim() || !warehouse?.id || !location?.id) {
            setSwapInResults([]);
            return;
        }
        const delayDebounceFn = setTimeout(async () => {
            setIsSearchingIn(true);
            try {
                const res = await searchInventoryItems(swapInQuery, warehouse.id, location.id);
                if (res.status && Array.isArray(res.data)) {
                    setSwapInResults(res.data);
                } else {
                    setSwapInResults([]);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setIsSearchingIn(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [swapInQuery, warehouse?.id, location?.id]);

    useEffect(() => {
        if (!searchQuery.trim() || !warehouse?.id || !location?.id) {
            setSearchResults([]);
            return;
        }
        const delayDebounceFn = setTimeout(async () => {
            setIsSearching(true);
            try {
                const res = await searchInventoryItems(searchQuery, warehouse.id, location.id);
                if (res.status && Array.isArray(res.data)) {
                    setSearchResults(res.data);
                } else {
                    setSearchResults([]);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery, warehouse?.id, location?.id]);

    // Handle standard item add
    const handleAddStandardItem = (item: any) => {
        const exists = selectedItems.find((i) => i.id === item.id);
        if (exists) {
            toast.warning(`Item ${item.sku} is already added`);
            return;
        }

        const newItem: SelectedItem = {
            id: item.id,
            sku: item.sku,
            description: item.description,
            currentQty: Number(item.totalQuantity || 0),
            physicalQty: Number(item.totalQuantity || 0),
            rate: Number(item.unitPrice || 0),
            color: item.color?.name || null,
            size: item.size?.name || null,
        };

        setSelectedItems((prev) => [...prev, newItem]);
        setSearchQuery("");
        setSearchResults([]);
    };

    const handleUpdateStandardItem = (index: number, fields: Partial<SelectedItem>) => {
        setSelectedItems((prev) => {
            const updated = [...prev];
            updated[index] = { ...updated[index], ...fields };
            return updated;
        });
    };

    const handleRemoveStandardItem = (index: number) => {
        setSelectedItems((prev) => prev.filter((_, i) => i !== index));
    };

    // Handle process Excel quick paste
    const handleProcessPaste = async () => {
        if (!pasteContent.trim()) {
            toast.error("Please enter or paste SKU/Barcode numbers.");
            return;
        }

        if (!warehouse?.id || !location?.id) {
            toast.error("Location and warehouse context missing.");
            return;
        }

        setIsResolvingPaste(true);
        try {
            const parsedItems = parseQuickPasteText(pasteContent);

            if (parsedItems.length === 0) {
                toast.error("No valid Barcodes or SKUs found in pasted text.");
                setIsResolvingPaste(false);
                return;
            }

            const uniqueQueries = Array.from(new Set(parsedItems.map((p) => p.query)));
            const res = await bulkSearchItems(uniqueQueries);

            if (!res.status || !res.data) {
                toast.error("Failed to resolve pasted items from server.");
                setIsResolvingPaste(false);
                return;
            }

            const masterItems = res.data;

            // Fetch exact location stock levels in parallel
            const stockMap = new Map<string, number>();
            await Promise.all(
                masterItems.map(async (item: any) => {
                    try {
                        const invRes = await searchInventoryItems(
                            item.sku || item.barCode || item.barcode || item.id,
                            warehouse.id,
                            location.id
                        );
                        if (invRes.status && Array.isArray(invRes.data)) {
                            const matchedInv = invRes.data.find((i: any) => i.id === item.id);
                            if (matchedInv) {
                                stockMap.set(item.id, Number(matchedInv.totalQuantity || 0));
                            } else {
                                stockMap.set(item.id, Number(item.totalQuantity || 0));
                            }
                        } else {
                            stockMap.set(item.id, Number(item.totalQuantity || 0));
                        }
                    } catch (e) {
                        stockMap.set(item.id, Number(item.totalQuantity || 0));
                    }
                })
            );

            const itemMap = new Map<string, any>();
            masterItems.forEach((item: any) => {
                const locQty = stockMap.has(item.id) ? stockMap.get(item.id)! : Number(item.totalQuantity || 0);
                const enrichedItem = { ...item, totalQuantity: locQty };

                if (item.sku) itemMap.set(item.sku.toLowerCase().trim(), enrichedItem);
                if (item.barcode) itemMap.set(item.barcode.toLowerCase().trim(), enrichedItem);
                if (item.barCode) itemMap.set(item.barCode.toLowerCase().trim(), enrichedItem);
                if (item.id) itemMap.set(item.id.toLowerCase().trim(), enrichedItem);
            });

            let foundCount = 0;
            const notFoundQueries: string[] = [];
            const updatedItems = [...selectedItems];

            for (const parsed of parsedItems) {
                const matchedItem = itemMap.get(parsed.query.toLowerCase().trim());
                if (matchedItem) {
                    foundCount++;
                    const existingIdx = updatedItems.findIndex((i) => i.id === matchedItem.id);
                    const systemQty = Number(matchedItem.totalQuantity || 0);

                    const rawQty = parsed.qty !== undefined ? parsed.qty : -1;
                    const isRelative = pasteAdjustmentMode === "relative" || parsed.isExplicitDelta || rawQty < 0;

                    if (existingIdx >= 0) {
                        if (isRelative) {
                            updatedItems[existingIdx].physicalQty = Math.max(
                                0,
                                updatedItems[existingIdx].physicalQty + rawQty
                            );
                        } else {
                            updatedItems[existingIdx].physicalQty = rawQty;
                        }
                    } else {
                        const targetPhysicalQty = isRelative
                            ? Math.max(0, systemQty + rawQty)
                            : rawQty;

                        updatedItems.push({
                            id: matchedItem.id,
                            sku: matchedItem.sku,
                            description: matchedItem.description,
                            currentQty: systemQty,
                            physicalQty: targetPhysicalQty,
                            rate: Number(matchedItem.unitCost || matchedItem.unitPrice || 0),
                            color: matchedItem.color?.name || null,
                            size: matchedItem.size?.name || null,
                        });
                    }
                } else {
                    if (!notFoundQueries.includes(parsed.query)) {
                        notFoundQueries.push(parsed.query);
                    }
                }
            }

            setSelectedItems(updatedItems);
            setPasteContent("");

            if (notFoundQueries.length > 0) {
                toast.warning(
                    `Added/updated ${foundCount} items. ${notFoundQueries.length} SKU(s) not found: ${notFoundQueries.slice(0, 3).join(", ")}${notFoundQueries.length > 3 ? "..." : ""}`
                );
            } else {
                toast.success(`Successfully added/updated ${foundCount} items with location stock levels.`);
            }
        } catch (error) {
            console.error("Paste processing error:", error);
            toast.error("An error occurred while processing pasted items.");
        } finally {
            setIsResolvingPaste(false);
        }
    };

    // Submit handler
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (tabMode === "swap") {
            if (!selectedOutItem) {
                toast.error("Please select a Swapped Out Item (Reduce Stock)");
                return;
            }
            if (!selectedInItem) {
                toast.error("Please select a Swapped In Item (Increase Stock)");
                return;
            }
            if (selectedOutItem.id === selectedInItem.id) {
                toast.error("Cannot swap an item with itself");
                return;
            }
            if (swapQty <= 0) {
                toast.error("Quantity must be greater than zero");
                return;
            }
            
            const currentOutQty = Number(selectedOutItem.totalQuantity || 0);
            if (currentOutQty < swapQty) {
                if (!confirm(`Warning: The store currently has only ${currentOutQty} units of the swapped-out item physically/system-wise. Creating this adjustment will result in negative stock. Do you want to proceed?`)) {
                    return;
                }
            }

            startTransition(async () => {
                try {
                    const payload = {
                        warehouseId: warehouse.id,
                        reason: reason || "Billing Swap Mismatch",
                        notes: notes || undefined,
                        status: "PENDING_APPROVAL",
                        adjustmentType: "SWAP",
                        items: [
                            {
                                itemId: selectedOutItem.id,
                                locationId: location.id,
                                physicalQty: Math.max(0, currentOutQty - swapQty),
                                rate: swapRate || Number(selectedOutItem.unitPrice || 0),
                                swapItemId: selectedInItem.id,
                            },
                            {
                                itemId: selectedInItem.id,
                                locationId: location.id,
                                physicalQty: Number(selectedInItem.totalQuantity || 0) + swapQty,
                                rate: swapRate || Number(selectedInItem.unitPrice || 0),
                                swapItemId: selectedOutItem.id,
                            }
                        ]
                    };

                    const res = await createStockAdjustment(payload);
                    if (res.status !== false) {
                        toast.success("Stock swap request submitted for approval");
                        router.push("/pos/inventory/adjustments");
                    } else {
                        toast.error(res.message || "Failed to submit request");
                    }
                } catch (err: any) {
                    toast.error(err.message || "An error occurred");
                }
            });
        } else {
            if (selectedItems.length === 0) {
                toast.error("Please add at least one item to adjust");
                return;
            }

            startTransition(async () => {
                try {
                    const payload = {
                        warehouseId: warehouse.id,
                        reason: reason || "Physical Count Mismatch",
                        notes: notes || undefined,
                        status: "PENDING_APPROVAL",
                        adjustmentType: "STANDARD",
                        items: selectedItems.map((item) => ({
                            itemId: item.id,
                            locationId: location.id,
                            physicalQty: item.physicalQty,
                            rate: item.rate,
                        }))
                    };

                    const res = await createStockAdjustment(payload);
                    if (res.status !== false) {
                        toast.success("Stock adjustment request submitted for approval");
                        router.push("/pos/inventory/adjustments");
                    } else {
                        toast.error(res.message || "Failed to submit request");
                    }
                } catch (err: any) {
                    toast.error(err.message || "An error occurred");
                }
            });
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Request Stock Adjustment</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Submit a request to correct inventory discrepancies. Requests must be approved by the ERP head office.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => router.push("/pos/inventory/adjustments")}
                        disabled={isPending}
                        className="border-slate-200 dark:border-slate-800"
                    >
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isPending} className="bg-primary text-primary-foreground hover:bg-primary/95 font-semibold">
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Submit Request
                    </Button>
                </div>
            </div>

            {/* Toggle Mode Tabs */}
            <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg w-full max-w-md border border-slate-200/50 dark:border-slate-800/50">
                <button
                    type="button"
                    className={cn(
                        "flex-1 py-1.5 px-3 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5",
                        tabMode === "swap"
                            ? "bg-white dark:bg-slate-950 text-primary shadow-sm"
                            : "text-muted-foreground hover:text-slate-900 dark:hover:text-slate-100"
                    )}
                    onClick={() => {
                        setTabMode("swap");
                        setReason("");
                    }}
                >
                    <Repeat className="h-3.5 w-3.5" />
                    Stock Swap (Billing Correction)
                </button>
                <button
                    type="button"
                    className={cn(
                        "flex-1 py-1.5 px-3 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5",
                        tabMode === "standard"
                            ? "bg-white dark:bg-slate-950 text-primary shadow-sm"
                            : "text-muted-foreground hover:text-slate-900 dark:hover:text-slate-100"
                    )}
                    onClick={() => {
                        setTabMode("standard");
                        setReason("");
                    }}
                >
                    <ClipboardList className="h-3.5 w-3.5" />
                    Standard Stock Count Correction
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Card */}
                <Card className="lg:col-span-2 shadow-sm border-muted">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg">
                            {tabMode === "swap" ? "Stock Swapping Details" : "Stock Items List"}
                        </CardTitle>
                        <CardDescription>
                            {tabMode === "swap" 
                                ? "Correct a billing error where a customer bought one size/color but another was scanned." 
                                : "List store items whose physical stock does not match the system's stock level."}
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {tabMode === "swap" ? (
                            // --- SWAP INTERFACE ---
                            <div className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Swapped Out Item */}
                                    <div className="space-y-2 relative">
                                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                            Swapped Out Item <span className="text-red-500">*</span>
                                            <span className="text-[10px] lowercase font-normal ml-1">(Stock will DECREASE)</span>
                                        </Label>
                                        
                                        {selectedOutItem ? (
                                            <div className="p-3 bg-red-50/50 dark:bg-red-950/10 border border-red-200 dark:border-red-900/50 rounded-lg flex justify-between items-start gap-4">
                                                <div>
                                                    <span className="font-mono font-bold text-sm block">{selectedOutItem.sku}</span>
                                                    <span className="text-xs text-muted-foreground block">{selectedOutItem.description}</span>
                                                    <div className="flex gap-2 text-[10px] text-slate-500 font-semibold mt-1">
                                                        {selectedOutItem.color?.name && <span>Color: {selectedOutItem.color.name}</span>}
                                                        {selectedOutItem.size?.name && <span>Size: {selectedOutItem.size.name}</span>}
                                                    </div>
                                                    <span className="text-[11px] font-semibold text-red-600 dark:text-red-400 mt-1 block">
                                                        System Stock: {Number(selectedOutItem.totalQuantity || 0).toFixed(2)}
                                                    </span>
                                                </div>
                                                <Button 
                                                    type="button" 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    onClick={() => {
                                                        setSelectedOutItem(null);
                                                        setSwapOutQuery("");
                                                    }}
                                                    className="h-8 text-red-600 hover:text-red-700 hover:bg-red-100/30"
                                                >
                                                    Remove
                                                </Button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-center border border-input rounded-md px-3 bg-white dark:bg-slate-900 focus-within:ring-2 focus-within:ring-primary">
                                                    <Search className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
                                                    <Input
                                                        className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-9 w-full text-sm"
                                                        placeholder="Search Item SKU to adjust OUT..."
                                                        value={swapOutQuery}
                                                        onChange={(e) => setSwapOutQuery(e.target.value)}
                                                    />
                                                    {isSearchingOut && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
                                                </div>

                                                {/* Dropdown */}
                                                {swapOutResults.length > 0 && (
                                                    <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-52 overflow-y-auto border border-muted bg-white dark:bg-slate-950 rounded-md shadow-lg divide-y divide-muted">
                                                        {swapOutResults.map((item) => (
                                                            <div
                                                                key={item.id}
                                                                className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer text-xs"
                                                                onClick={() => {
                                                                    setSelectedOutItem(item);
                                                                    setSwapOutResults([]);
                                                                    if (swapRate === 0) setSwapRate(Number(item.unitPrice || 0));
                                                                }}
                                                            >
                                                                <span className="font-mono font-bold">{item.sku}</span>
                                                                <div className="text-muted-foreground truncate">{item.description}</div>
                                                                <div className="flex gap-2 mt-0.5 text-[10px] font-semibold text-slate-500">
                                                                    {item.color?.name && <span>Color: {item.color.name}</span>}
                                                                    {item.size?.name && <span>Size: {item.size.name}</span>}
                                                                    <span>Available Stock: {Number(item.totalQuantity || 0)}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>

                                    {/* Swapped In Item */}
                                    <div className="space-y-2 relative">
                                        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                            Swapped In Item <span className="text-red-500">*</span>
                                            <span className="text-[10px] lowercase font-normal ml-1">(Stock will INCREASE)</span>
                                        </Label>
                                        
                                        {selectedInItem ? (
                                            <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-200 dark:border-emerald-900/50 rounded-lg flex justify-between items-start gap-4">
                                                <div>
                                                    <span className="font-mono font-bold text-sm block">{selectedInItem.sku}</span>
                                                    <span className="text-xs text-muted-foreground block">{selectedInItem.description}</span>
                                                    <div className="flex gap-2 text-[10px] text-slate-500 font-semibold mt-1">
                                                        {selectedInItem.color?.name && <span>Color: {selectedInItem.color.name}</span>}
                                                        {selectedInItem.size?.name && <span>Size: {selectedInItem.size.name}</span>}
                                                    </div>
                                                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1 block">
                                                        System Stock: {Number(selectedInItem.totalQuantity || 0).toFixed(2)}
                                                    </span>
                                                </div>
                                                <Button 
                                                    type="button" 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    onClick={() => {
                                                        setSelectedInItem(null);
                                                        setSwapInQuery("");
                                                    }}
                                                    className="h-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100/30"
                                                >
                                                    Remove
                                                </Button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="flex items-center border border-input rounded-md px-3 bg-white dark:bg-slate-900 focus-within:ring-2 focus-within:ring-primary">
                                                    <Search className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
                                                    <Input
                                                        className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-9 w-full text-sm"
                                                        placeholder="Search Item SKU to adjust IN..."
                                                        value={swapInQuery}
                                                        onChange={(e) => setSwapInQuery(e.target.value)}
                                                    />
                                                    {isSearchingIn && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
                                                </div>

                                                {/* Dropdown */}
                                                {swapInResults.length > 0 && (
                                                    <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-52 overflow-y-auto border border-muted bg-white dark:bg-slate-950 rounded-md shadow-lg divide-y divide-muted">
                                                        {swapInResults.map((item) => (
                                                            <div
                                                                key={item.id}
                                                                className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer text-xs"
                                                                onClick={() => {
                                                                    setSelectedInItem(item);
                                                                    setSwapInResults([]);
                                                                    if (swapRate === 0) setSwapRate(Number(item.unitPrice || 0));
                                                                }}
                                                            >
                                                                <span className="font-mono font-bold">{item.sku}</span>
                                                                <div className="text-muted-foreground truncate">{item.description}</div>
                                                                <div className="flex gap-2 mt-0.5 text-[10px] font-semibold text-slate-500">
                                                                    {item.color?.name && <span>Color: {item.color.name}</span>}
                                                                    {item.size?.name && <span>Size: {item.size.name}</span>}
                                                                    <span>Available Stock: {Number(item.totalQuantity || 0)}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>

                                {selectedOutItem && selectedInItem && (
                                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-lg space-y-4">
                                        <h4 className="text-sm font-bold flex items-center gap-1.5">
                                            <Info className="h-4 w-4 text-blue-600" />
                                            Correction Configuration
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <Label htmlFor="swap-qty" className="text-xs">Quantity to Swap</Label>
                                                <Input
                                                    id="swap-qty"
                                                    type="number"
                                                    min={1}
                                                    value={swapQty}
                                                    onChange={(e) => setSwapQty(Math.max(1, parseInt(e.target.value) || 1))}
                                                    className="h-9 text-sm font-semibold"
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <Label htmlFor="swap-rate" className="text-xs">Unit Rate (PKR)</Label>
                                                <Input
                                                    id="swap-rate"
                                                    type="number"
                                                    min={0}
                                                    value={swapRate}
                                                    onChange={(e) => setSwapRate(Math.max(0, parseFloat(e.target.value) || 0))}
                                                    className="h-9 text-sm font-semibold"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            // --- STANDARD COUNT INTERFACE ---
                            <div className="space-y-4">
                                {/* Input Mode Selector */}
                                <div className="flex border-b border-muted mb-4 gap-4">
                                    <button
                                        type="button"
                                        className={cn(
                                            "pb-2 px-1 text-sm font-semibold border-b-2 transition-all",
                                            inputMode === "search"
                                                ? "border-primary text-primary"
                                                : "border-transparent text-muted-foreground"
                                        )}
                                        onClick={() => setInputMode("search")}
                                    >
                                        Search Items
                                    </button>
                                    <button
                                        type="button"
                                        className={cn(
                                            "pb-2 px-1 text-sm font-semibold border-b-2 transition-all",
                                            inputMode === "paste"
                                                ? "border-primary text-primary"
                                                : "border-transparent text-muted-foreground"
                                        )}
                                        onClick={() => setInputMode("paste")}
                                    >
                                        Quick Select (Paste from Excel)
                                    </button>
                                </div>

                                {inputMode === "search" && (
                                    <div className="relative">
                                        <div className="flex items-center border border-input rounded-md px-3 bg-white dark:bg-slate-900 focus-within:ring-2 focus-within:ring-primary">
                                            <Search className="h-5 w-5 text-muted-foreground mr-2 shrink-0" />
                                            <Input
                                                className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-10 w-full"
                                                placeholder="Type SKU or description to add..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                            />
                                            {isSearching && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
                                        </div>

                                        {/* Dropdown */}
                                        {searchResults.length > 0 && (
                                            <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto border border-muted bg-white dark:bg-slate-950 rounded-md shadow-lg divide-y divide-muted">
                                                {searchResults.map((item) => (
                                                    <div
                                                        key={item.id}
                                                        className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer text-xs"
                                                        onClick={() => handleAddStandardItem(item)}
                                                    >
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="font-mono font-bold text-sm">{item.sku}</span>
                                                            <span className="text-muted-foreground">{item.description}</span>
                                                            <div className="flex gap-2 mt-0.5 text-[10px] font-semibold text-slate-500">
                                                                {item.color?.name && <span>Color: {item.color.name}</span>}
                                                                {item.size?.name && <span>Size: {item.size.name}</span>}
                                                            </div>
                                                        </div>
                                                        <span className="text-slate-500 font-semibold">Stock: {Number(item.totalQuantity || 0)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {inputMode === "paste" && (
                                    <div className="space-y-4">
                                        {/* Action Mode Toggle */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 bg-slate-50 dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800">
                                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Pasted Quantity Action:</span>
                                            <div className="flex gap-2 text-xs">
                                                <label className={cn(
                                                    "flex items-center gap-1.5 px-2.5 py-1 rounded cursor-pointer font-medium border transition-all",
                                                    pasteAdjustmentMode === "relative"
                                                        ? "bg-white dark:bg-slate-950 border-primary text-primary shadow-sm"
                                                        : "border-transparent text-muted-foreground hover:text-slate-800"
                                                )}>
                                                    <input
                                                        type="radio"
                                                        name="posPasteMode"
                                                        value="relative"
                                                        checked={pasteAdjustmentMode === "relative"}
                                                        onChange={() => setPasteAdjustmentMode("relative")}
                                                        className="sr-only"
                                                    />
                                                    <span>Deduct / Add Offset (e.g. -1, -2, +1)</span>
                                                </label>

                                                <label className={cn(
                                                    "flex items-center gap-1.5 px-2.5 py-1 rounded cursor-pointer font-medium border transition-all",
                                                    pasteAdjustmentMode === "absolute"
                                                        ? "bg-white dark:bg-slate-950 border-primary text-primary shadow-sm"
                                                        : "border-transparent text-muted-foreground hover:text-slate-800"
                                                )}>
                                                    <input
                                                        type="radio"
                                                        name="posPasteMode"
                                                        value="absolute"
                                                        checked={pasteAdjustmentMode === "absolute"}
                                                        onChange={() => setPasteAdjustmentMode("absolute")}
                                                        className="sr-only"
                                                    />
                                                    <span>Set Total Physical Count</span>
                                                </label>
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <Label htmlFor="pos-quick-paste-box" className="text-xs text-muted-foreground">
                                                Paste list of Barcodes/SKUs and optional Quantities directly from Excel.
                                            </Label>
                                            <Textarea
                                                id="pos-quick-paste-box"
                                                placeholder={`Example:\nBarcode\tQuantity\n196606817132\t-1\n196974922698\t-2`}
                                                value={pasteContent}
                                                onChange={(e) => setPasteContent(e.target.value)}
                                                rows={6}
                                                className="font-mono text-sm"
                                            />
                                        </div>

                                        <Button
                                            type="button"
                                            onClick={handleProcessPaste}
                                            disabled={isResolvingPaste}
                                            className="gap-2"
                                        >
                                            {isResolvingPaste ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Plus className="h-4 w-4" />
                                            )}
                                            Process & Add Pasted Items
                                        </Button>
                                    </div>
                                )}

                                {/* Table of items */}
                                {selectedItems.length === 0 ? (
                                    <div className="p-8 border border-dashed border-muted rounded-lg text-center space-y-2">
                                        <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground/50" />
                                        <p className="text-xs text-muted-foreground">No items added to adjustment list yet.</p>
                                    </div>
                                ) : (
                                    <div className="border border-muted rounded-lg overflow-hidden">
                                        <table className="w-full text-xs">
                                            <thead className="bg-slate-50 dark:bg-slate-900 border-b border-muted">
                                                <tr>
                                                    <th className="p-2.5 text-left font-bold">Item SKU</th>
                                                    <th className="p-2.5 text-right font-bold">System Qty</th>
                                                    <th className="p-2.5 text-right font-bold w-28">Physical Count</th>
                                                    <th className="p-2.5 text-right font-bold">Discrepancy</th>
                                                    <th className="p-2.5 text-right font-bold">Unit Price</th>
                                                    <th className="p-2.5 text-center font-bold w-12">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-muted">
                                                {selectedItems.map((item, idx) => {
                                                    const disc = item.physicalQty - item.currentQty;
                                                    return (
                                                        <tr key={item.id}>
                                                            <td className="p-2.5">
                                                                <span className="font-mono font-bold block">{item.sku}</span>
                                                                <span className="text-muted-foreground block truncate max-w-48">{item.description}</span>
                                                            </td>
                                                            <td className="p-2.5 text-right tabular-nums text-muted-foreground">
                                                                {item.currentQty.toFixed(2)}
                                                            </td>
                                                            <td className="p-2.5 text-right">
                                                                <Input
                                                                    type="number"
                                                                    step="1"
                                                                    min="0"
                                                                    value={item.physicalQty}
                                                                    onChange={(e) => handleUpdateStandardItem(idx, { physicalQty: parseFloat(e.target.value) || 0 })}
                                                                    className="h-7 text-right px-2 font-mono text-xs font-bold"
                                                                />
                                                            </td>
                                                            <td className="p-2.5 text-right tabular-nums font-bold">
                                                                {disc === 0 ? (
                                                                    <span className="text-slate-400">0</span>
                                                                ) : disc > 0 ? (
                                                                    <span className="text-emerald-600">+{disc}</span>
                                                                ) : (
                                                                    <span className="text-red-600">{disc}</span>
                                                                )}
                                                            </td>
                                                            <td className="p-2.5 text-right tabular-nums">
                                                                {item.rate.toLocaleString("en-PK")}
                                                            </td>
                                                            <td className="p-2.5 text-center">
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleRemoveStandardItem(idx)}
                                                                    className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                                >
                                                                    <Trash className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Sidebar Card */}
                <Card className="shadow-sm border-muted h-fit space-y-4">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Adjustment Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="reason-select">Reason for Adjustment</Label>
                            {tabMode === "swap" ? (
                                <Select value={reason} onValueChange={setReason}>
                                    <SelectTrigger id="reason-select">
                                        <SelectValue placeholder="Select Reason..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {REASONS.map((r) => (
                                            <SelectItem key={r.value} value={r.value}>
                                                {r.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <Input
                                    id="reason-select"
                                    placeholder="e.g. Store Count Discrepancy"
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                />
                            )}
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="notes-textarea">Additional Notes</Label>
                            <Textarea
                                id="notes-textarea"
                                rows={3}
                                placeholder="Add notes for head office reviewers..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </form>
    );
}
