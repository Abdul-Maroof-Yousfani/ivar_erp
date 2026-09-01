"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Search,
    Trash,
    Loader2,
    Plus,
    AlertCircle,
    CheckCircle,
    Repeat,
    ClipboardList,
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
    warehouseId?: string | null;
    warehouse?: { id: string; name: string; code: string } | null;
}

interface NewStockAdjustmentFormProps {
    warehouses: Warehouse[];
    locations: Location[];
}

interface SelectedItem {
    id: string; // resolved item UUID
    sku: string;
    description: string | null;
    currentQty: number;
    physicalQty: number;
    rate: number;
    color?: string | null;
    size?: string | null;
    locationId: string | null;
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
    { value: "Annual Stock Audit / Discrepancy", label: "Annual Stock Audit / Discrepancy" },
    { value: "Other / Mismatch Correction", label: "Other / Mismatch Correction" },
];

/**
 * Robust parser for text pasted from Excel (or barcodes/SKU list).
 * Handles headers, tabs, commas, newlines, space-separated tokens, and signed deltas (+/-).
 */
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

    // Tokenize whole text by newlines, tabs, commas, semicolons, pipes
    const rawTokens = content
        .split(/[\r\n\t,;|]+/)
        .map((t) => t.trim())
        .filter(Boolean);

    // Flatten any space-separated tokens in each line
    const tokens: string[] = [];
    for (const rawToken of rawTokens) {
        const parts = rawToken.split(/\s+/).filter(Boolean);
        tokens.push(...parts);
    }

    // Filter out header keywords if they appear
    const cleanTokens = tokens.filter((t) => !headerKeywords.has(t.toLowerCase()));

    const results: ParsedPasteItem[] = [];
    let i = 0;

    while (i < cleanTokens.length) {
        const token = cleanTokens[i];

        const isSigned = token.startsWith("-") || token.startsWith("+");
        const isSmallNumber = !isNaN(Number(token)) && Math.abs(Number(token)) < 10000;
        const isBarcodeOrSku = token.length >= 6 || isNaN(Number(token)) || (!isSigned && Number(token) > 10000);

        if (!isBarcodeOrSku && (isSigned || isSmallNumber)) {
            // Standalone number without query, skip
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
                i++; // consume quantity token
            }
        }

        results.push({ query, qty, isExplicitDelta });
        i++;
    }

    return results;
}

export function NewStockAdjustmentForm({ warehouses, locations }: NewStockAdjustmentFormProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const [tabMode, setTabMode] = useState<"swap" | "standard">("swap");
    const [locationId, setLocationId] = useState<string>("none");
    const [warehouseId, setWarehouseId] = useState<string>("");
    const [reason, setReason] = useState<string>("");
    const [notes, setNotes] = useState<string>("");

    // Auto-select warehouse when location changes if location has linked warehouse
    const handleLocationChange = (locId: string) => {
        setLocationId(locId);
        if (locId !== "none") {
            const foundLoc = locations.find((l) => l.id === locId);
            if (foundLoc) {
                const linkedWhId = foundLoc.warehouse?.id || foundLoc.warehouseId;
                if (linkedWhId && warehouses.some((w) => w.id === linkedWhId)) {
                    setWarehouseId(linkedWhId);
                }
            }
        }
    };

    // Auto-select default warehouse if only one warehouse or not set
    useEffect(() => {
        if (!warehouseId && warehouses.length > 0) {
            setWarehouseId(warehouses[0].id);
        }
    }, [warehouses, warehouseId]);

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
    const [isSearching, setIsSearching] = useState<boolean>(false);
    const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);

    // Quick Paste state
    const [inputMode, setInputMode] = useState<"search" | "paste">("search");
    const [pasteContent, setPasteContent] = useState<string>("");
    const [pasteAdjustmentMode, setPasteAdjustmentMode] = useState<"relative" | "absolute">("relative");
    const [isResolvingPaste, setIsResolvingPaste] = useState<boolean>(false);

    // Debounced searches for Swap Mode
    useEffect(() => {
        if (!swapOutQuery.trim() || !warehouseId) {
            setSwapOutResults([]);
            return;
        }
        const delayDebounceFn = setTimeout(async () => {
            setIsSearchingOut(true);
            try {
                const locId = locationId !== "none" ? locationId : undefined;
                const res = await searchInventoryItems(swapOutQuery, warehouseId, locId);
                if (res.status && Array.isArray(res.data)) {
                    setSwapOutResults(res.data);
                } else {
                    setSwapOutResults([]);
                }
            } catch (err) {
                console.error("Swap Out search error:", err);
            } finally {
                setIsSearchingOut(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [swapOutQuery, warehouseId, locationId]);

    useEffect(() => {
        if (!swapInQuery.trim() || !warehouseId) {
            setSwapInResults([]);
            return;
        }
        const delayDebounceFn = setTimeout(async () => {
            setIsSearchingIn(true);
            try {
                const locId = locationId !== "none" ? locationId : undefined;
                const res = await searchInventoryItems(swapInQuery, warehouseId, locId);
                if (res.status && Array.isArray(res.data)) {
                    setSwapInResults(res.data);
                } else {
                    setSwapInResults([]);
                }
            } catch (err) {
                console.error("Swap In search error:", err);
            } finally {
                setIsSearchingIn(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [swapInQuery, warehouseId, locationId]);

    // Debounced search for Standard Mode
    useEffect(() => {
        if (!searchQuery.trim() || !warehouseId) {
            setSearchResults([]);
            return;
        }

        const delayDebounceFn = setTimeout(async () => {
            setIsSearching(true);
            try {
                const locId = locationId !== "none" ? locationId : undefined;
                const result = await searchInventoryItems(searchQuery, warehouseId, locId);
                if (result.status && Array.isArray(result.data)) {
                    setSearchResults(result.data);
                } else {
                    setSearchResults([]);
                }
            } catch (error) {
                console.error("Search error:", error);
            } finally {
                setIsSearching(false);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery, warehouseId, locationId]);

    // Handle adding item in Standard mode
    const handleAddItem = (item: any) => {
        const targetLocId = locationId !== "none" ? locationId : null;
        const existing = selectedItems.find((i) => i.id === item.id && i.locationId === targetLocId);
        if (existing) {
            toast.warning(`Item ${item.sku} is already added to this adjustment`);
            return;
        }

        const newItem: SelectedItem = {
            id: item.id,
            sku: item.sku,
            description: item.description,
            currentQty: Number(item.totalQuantity || 0),
            physicalQty: Number(item.totalQuantity || 0),
            rate: Number(item.unitCost || item.unitPrice || 0),
            color: item.color?.name || null,
            size: item.size?.name || null,
            locationId: targetLocId,
        };

        setSelectedItems((prev) => [...prev, newItem]);
        setSearchQuery("");
        setSearchResults([]);
    };

    // Update item in standard list
    const handleUpdateItem = (index: number, fields: Partial<SelectedItem>) => {
        setSelectedItems((prev) => {
            const updated = [...prev];
            updated[index] = { ...updated[index], ...fields };
            return updated;
        });
    };

    // Remove item from standard list
    const handleRemoveItem = (index: number) => {
        setSelectedItems((prev) => prev.filter((_, i) => i !== index));
    };

    // Handle process Excel quick paste
    const handleProcessPaste = async () => {
        if (!pasteContent.trim()) {
            toast.error("Please enter or paste SKU/Barcode numbers.");
            return;
        }

        if (!warehouseId) {
            toast.error("Please select a warehouse first.");
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
            const targetLocId = locationId !== "none" ? locationId : null;

            // Fetch exact location/warehouse stock for every found item
            const stockMap = new Map<string, number>();
            await Promise.all(
                masterItems.map(async (item: any) => {
                    try {
                        const invRes = await searchInventoryItems(
                            item.sku || item.barCode || item.barcode || item.id,
                            warehouseId,
                            targetLocId || undefined
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
                    const existingIdx = updatedItems.findIndex(
                        (i) => i.id === matchedItem.id && i.locationId === targetLocId
                    );
                    const systemQty = Number(matchedItem.totalQuantity || 0);

                    // Determine adjustment delta or physical count
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
                            locationId: targetLocId,
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

    // Calculate totals for Standard mode
    const totalItems = selectedItems.length;
    const valueIncrease = selectedItems.reduce((acc, item) => {
        const diff = item.physicalQty - item.currentQty;
        return diff > 0 ? acc + diff * item.rate : acc;
    }, 0);
    const valueDecrease = selectedItems.reduce((acc, item) => {
        const diff = item.physicalQty - item.currentQty;
        return diff < 0 ? acc + Math.abs(diff) * item.rate : acc;
    }, 0);
    const netChange = valueIncrease - valueDecrease;

    // Handle Form Submit
    const handleSubmit = (targetStatus: "DRAFT" | "PENDING_APPROVAL" | "SUBMITTED") => {
        if (!warehouseId) {
            toast.error("Please select a warehouse.");
            return;
        }

        if (tabMode === "swap") {
            if (!selectedOutItem) {
                toast.error("Please select a Swapped Out Item (Stock Decrease).");
                return;
            }
            if (!selectedInItem) {
                toast.error("Please select a Swapped In Item (Stock Increase).");
                return;
            }
            if (selectedOutItem.id === selectedInItem.id) {
                toast.error("Cannot swap an item with itself.");
                return;
            }
            if (swapQty <= 0) {
                toast.error("Quantity must be greater than zero.");
                return;
            }

            const currentOutQty = Number(selectedOutItem.totalQuantity || 0);
            if (currentOutQty < swapQty) {
                if (
                    !confirm(
                        `Warning: Available stock for '${selectedOutItem.sku}' is ${currentOutQty}. Processing this swap will result in negative stock. Do you wish to continue?`
                    )
                ) {
                    return;
                }
            }

            startTransition(async () => {
                try {
                    const targetLocId = locationId !== "none" ? locationId : undefined;
                    const payload = {
                        warehouseId,
                        reason: reason || "Billing Swap Mismatch",
                        notes: notes || undefined,
                        status: targetStatus,
                        adjustmentType: "SWAP",
                        items: [
                            {
                                itemId: selectedOutItem.id,
                                locationId: targetLocId,
                                physicalQty: Math.max(0, currentOutQty - swapQty),
                                rate: swapRate || Number(selectedOutRate(selectedOutItem)),
                                swapItemId: selectedInItem.id,
                            },
                            {
                                itemId: selectedInItem.id,
                                locationId: targetLocId,
                                physicalQty: Number(selectedInItem.totalQuantity || 0) + swapQty,
                                rate: swapRate || Number(selectedInRate(selectedInItem)),
                                swapItemId: selectedOutItem.id,
                            },
                        ],
                    };

                    const res = await createStockAdjustment(payload);
                    if (res.status !== false) {
                        toast.success(
                            targetStatus === "DRAFT"
                                ? "Stock swap draft saved successfully."
                                : "Stock swap request submitted for approval."
                        );
                        router.push("/erp/inventory/transactions/stock-adjustment");
                    } else {
                        toast.error(res.message || "Failed to save stock adjustment.");
                    }
                } catch (error: any) {
                    toast.error(error.message || "An unexpected error occurred.");
                }
            });
        } else {
            if (selectedItems.length === 0) {
                toast.error("Please add at least one item to adjust.");
                return;
            }

            startTransition(async () => {
                try {
                    const payload = {
                        warehouseId,
                        reason: reason || "Physical Count Mismatch",
                        notes: notes || undefined,
                        status: targetStatus,
                        adjustmentType: "STANDARD",
                        items: selectedItems.map((item) => ({
                            itemId: item.id,
                            locationId: item.locationId || (locationId !== "none" ? locationId : undefined),
                            physicalQty: item.physicalQty,
                            rate: item.rate,
                        })),
                    };

                    const res = await createStockAdjustment(payload);
                    if (res.status !== false) {
                        toast.success(
                            targetStatus === "DRAFT"
                                ? "Draft stock adjustment created."
                                : "Stock adjustment request submitted successfully."
                        );
                        router.push("/erp/inventory/transactions/stock-adjustment");
                    } else {
                        toast.error(res.message || "Failed to create stock adjustment.");
                    }
                } catch (error: any) {
                    toast.error(error.message || "An error occurred.");
                }
            });
        }
    };

    function selectedOutRate(item: any) {
        return item.unitCost || item.unitPrice || 0;
    }
    function selectedInRate(item: any) {
        return item.unitCost || item.unitPrice || 0;
    }

    return (
        <div className="space-y-6">
            {/* Header Title & Actions */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">New Stock Adjustment</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Create standard stock count corrections or billing swap adjustments for stores and warehouses.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => router.push("/erp/inventory/transactions/stock-adjustment")}
                        disabled={isPending}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => handleSubmit("DRAFT")}
                        disabled={isPending}
                    >
                        Save as Draft
                    </Button>
                    <Button
                        type="button"
                        onClick={() => handleSubmit("PENDING_APPROVAL")}
                        disabled={isPending}
                        className="bg-primary text-primary-foreground font-semibold hover:bg-primary/95"
                    >
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
                        "flex-1 py-2 px-3 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5",
                        tabMode === "swap"
                            ? "bg-white dark:bg-slate-950 text-primary shadow-sm"
                            : "text-muted-foreground hover:text-slate-900 dark:hover:text-slate-100"
                    )}
                    onClick={() => {
                        setTabMode("swap");
                        setReason("");
                    }}
                >
                    <Repeat className="h-4 w-4" />
                    Stock Swap (Billing Correction)
                </button>
                <button
                    type="button"
                    className={cn(
                        "flex-1 py-2 px-3 text-xs font-bold rounded-md transition-all flex items-center justify-center gap-1.5",
                        tabMode === "standard"
                            ? "bg-white dark:bg-slate-950 text-primary shadow-sm"
                            : "text-muted-foreground hover:text-slate-900 dark:hover:text-slate-100"
                    )}
                    onClick={() => {
                        setTabMode("standard");
                        setReason("");
                    }}
                >
                    <ClipboardList className="h-4 w-4" />
                    Standard Stock Count Correction
                </button>
            </div>

            {/* Document Header Controls */}
            <Card className="shadow-sm border-muted">
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Location & Header Information</CardTitle>
                    <CardDescription>Select target store location, linked warehouse, and adjustment rationale</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="location-select">Target Store Location / Outlet</Label>
                            <Select value={locationId} onValueChange={handleLocationChange}>
                                <SelectTrigger id="location-select" className="w-full">
                                    <SelectValue placeholder="Warehouse Direct (No Outlet Location)" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Warehouse Direct (Head Office Stock)</SelectItem>
                                    {locations.map((l) => (
                                        <SelectItem key={l.id} value={l.id}>
                                            {l.name} ({l.code})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="warehouse-select">
                                Primary Warehouse <span className="text-red-500">*</span>
                            </Label>
                            <Select
                                value={warehouseId}
                                onValueChange={(val) => {
                                    setWarehouseId(val);
                                    setSelectedItems([]);
                                }}
                                required
                            >
                                <SelectTrigger id="warehouse-select" className="w-full">
                                    <SelectValue placeholder="Select Warehouse" />
                                </SelectTrigger>
                                <SelectContent>
                                    {warehouses.map((w) => (
                                        <SelectItem key={w.id} value={w.id}>
                                            {w.name} ({w.code})
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="reason-input">Reason for Adjustment</Label>
                            {tabMode === "swap" ? (
                                <Select value={reason} onValueChange={setReason}>
                                    <SelectTrigger id="reason-input" className="w-full">
                                        <SelectValue placeholder="Select Billing / Swap Reason" />
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
                                    id="reason-input"
                                    placeholder="e.g. Annual Audit, Damaged Stock, Code Correction"
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                />
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="notes-input">Internal Remarks / Reference</Label>
                            <Input
                                id="notes-input"
                                placeholder="Optional reference notes or supervisor instructions..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* TAB MODE CONTENT */}
            {tabMode === "swap" ? (
                /* --- SWAP MODE INTERFACE --- */
                <Card className="shadow-sm border-muted">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Stock Swapping (Billing Error Correction)</CardTitle>
                        <CardDescription>
                            Correct situations where a customer bought one variant (color/size) but another was scanned during checkout.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
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
                                            <span className="text-xs text-muted-foreground block">{selectedOutItem.description || "No description"}</span>
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
                                            className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-100/50"
                                        >
                                            Change
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="relative">
                                            <Input
                                                placeholder="Search SKU or description for Swapped Out Item..."
                                                value={swapOutQuery}
                                                onChange={(e) => setSwapOutQuery(e.target.value)}
                                                className="pr-8"
                                                disabled={!warehouseId}
                                            />
                                            {isSearchingOut && (
                                                <Loader2 className="h-4 w-4 animate-spin text-primary absolute right-2.5 top-2.5" />
                                            )}
                                        </div>
                                        {swapOutResults.length > 0 && (
                                            <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto border border-muted bg-white dark:bg-slate-950 rounded-md shadow-lg divide-y divide-muted">
                                                {swapOutResults.map((item) => (
                                                    <div
                                                        key={item.id}
                                                        className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer flex justify-between items-center text-xs"
                                                        onClick={() => {
                                                            setSelectedOutItem(item);
                                                            setSwapOutResults([]);
                                                            setSwapOutQuery("");
                                                            if (!swapRate) setSwapRate(Number(item.unitCost || item.unitPrice || 0));
                                                        }}
                                                    >
                                                        <div>
                                                            <span className="font-mono font-bold block">{item.sku}</span>
                                                            <span className="text-muted-foreground block">{item.description}</span>
                                                        </div>
                                                        <span className="font-semibold text-slate-600 dark:text-slate-400">
                                                            Qty: {Number(item.totalQuantity || 0)}
                                                        </span>
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
                                            <span className="text-xs text-muted-foreground block">{selectedInItem.description || "No description"}</span>
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
                                            className="h-7 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100/50"
                                        >
                                            Change
                                        </Button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="relative">
                                            <Input
                                                placeholder="Search SKU or description for Swapped In Item..."
                                                value={swapInQuery}
                                                onChange={(e) => setSwapInQuery(e.target.value)}
                                                className="pr-8"
                                                disabled={!warehouseId}
                                            />
                                            {isSearchingIn && (
                                                <Loader2 className="h-4 w-4 animate-spin text-primary absolute right-2.5 top-2.5" />
                                            )}
                                        </div>
                                        {swapInResults.length > 0 && (
                                            <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto border border-muted bg-white dark:bg-slate-950 rounded-md shadow-lg divide-y divide-muted">
                                                {swapInResults.map((item) => (
                                                    <div
                                                        key={item.id}
                                                        className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer flex justify-between items-center text-xs"
                                                        onClick={() => {
                                                            setSelectedInItem(item);
                                                            setSwapInResults([]);
                                                            setSwapInQuery("");
                                                            if (!swapRate) setSwapRate(Number(item.unitCost || item.unitPrice || 0));
                                                        }}
                                                    >
                                                        <div>
                                                            <span className="font-mono font-bold block">{item.sku}</span>
                                                            <span className="text-muted-foreground block">{item.description}</span>
                                                        </div>
                                                        <span className="font-semibold text-slate-600 dark:text-slate-400">
                                                            Qty: {Number(item.totalQuantity || 0)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Quantity & Unit Rate Inputs */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                            <div className="space-y-2">
                                <Label htmlFor="swap-qty">Swap Quantity <span className="text-red-500">*</span></Label>
                                <Input
                                    id="swap-qty"
                                    type="number"
                                    min="1"
                                    step="1"
                                    value={swapQty}
                                    onChange={(e) => setSwapQty(Math.max(1, parseInt(e.target.value) || 1))}
                                    className="font-mono font-bold"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="swap-rate">Unit Cost / Price Rate (PKR)</Label>
                                <Input
                                    id="swap-rate"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={swapRate}
                                    onChange={(e) => setSwapRate(parseFloat(e.target.value) || 0)}
                                    className="font-mono"
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                /* --- STANDARD MODE INTERFACE --- */
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <Card className="lg:col-span-2 shadow-sm border-muted">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg">Items to Adjust</CardTitle>
                            <CardDescription>Search for active SKU or barcode to add them, or paste Excel stock lists.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
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

                            {/* Search Mode */}
                            {inputMode === "search" && (
                                <div className="relative">
                                    <div className="flex items-center border border-input rounded-md px-3 bg-white dark:bg-slate-900 focus-within:ring-2 focus-within:ring-primary">
                                        <Search className="h-5 w-5 text-muted-foreground mr-2 shrink-0" />
                                        <Input
                                            className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 px-0 h-10 w-full"
                                            placeholder={
                                                warehouseId
                                                    ? "Type SKU or item description to search..."
                                                    : "Select warehouse first to search items"
                                            }
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            disabled={!warehouseId}
                                        />
                                        {isSearching && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
                                    </div>

                                    {/* Search Results Dropdown */}
                                    {searchResults.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto border border-muted bg-white dark:bg-slate-950 rounded-md shadow-lg divide-y divide-muted">
                                            {searchResults.map((item) => (
                                                <div
                                                    key={item.id}
                                                    className="flex items-center justify-between p-3 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer transition-colors"
                                                    onClick={() => handleAddItem(item)}
                                                >
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="font-mono text-sm font-semibold">{item.sku}</span>
                                                        <span className="text-xs text-muted-foreground">{item.description || "No description"}</span>
                                                    </div>
                                                    <div className="flex items-center gap-4 text-xs font-semibold">
                                                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-slate-700 dark:text-slate-300">
                                                            On Hand: {Number(item.totalQuantity || 0)}
                                                        </span>
                                                        <span className="text-primary">
                                                            Cost: {Number(item.unitCost || item.unitPrice || 0).toFixed(2)} PKR
                                                        </span>
                                                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 rounded-full bg-primary/10 text-primary hover:bg-primary/20">
                                                            <Plus className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Paste Mode */}
                            {inputMode === "paste" && (
                                <div className="space-y-4">
                                    {/* Paste Mode Action Toggle */}
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
                                                    name="pasteMode"
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
                                                    name="pasteMode"
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
                                        <Label htmlFor="quick-paste-box" className="text-xs text-muted-foreground">
                                            Paste list of Barcodes/SKUs and optional Quantities (separated by Tab, Comma, Space, or Newline) directly from Excel.
                                        </Label>
                                        <Textarea
                                            id="quick-paste-box"
                                            placeholder={`Example 1 (Deduct/Add delta):\n196606817132\t-1\n196974922698\t-2\n\nExample 2 (Header line or multi-column):\nBarcode\tQuantity\n196606817132\t-1\n196974922698\t-2`}
                                            value={pasteContent}
                                            onChange={(e) => setPasteContent(e.target.value)}
                                            rows={6}
                                            className="font-mono text-sm"
                                            disabled={!warehouseId}
                                        />
                                    </div>

                                    <Button
                                        type="button"
                                        onClick={handleProcessPaste}
                                        disabled={!warehouseId || isResolvingPaste}
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

                            {/* Adjusted Items Table */}
                            {selectedItems.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border-2 border-dashed border-muted rounded-md bg-slate-50/50 dark:bg-slate-900/10">
                                    <AlertCircle className="h-10 w-10 text-muted-foreground/60 mb-2" />
                                    <p className="text-sm font-medium">No items added to adjustment list</p>
                                    <p className="text-xs mt-1">Use the search bar above or paste SKUs to add items.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto border border-muted rounded-md">
                                    <table className="w-full text-sm text-left border-collapse">
                                        <thead className="bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold border-b border-muted">
                                            <tr>
                                                <th className="p-3 font-medium">Item Info</th>
                                                <th className="p-3 font-medium text-right">System Qty</th>
                                                <th className="p-3 font-medium text-right w-32">Physical Qty</th>
                                                <th className="p-3 font-medium text-right">Discrepancy</th>
                                                <th className="p-3 font-medium text-right w-32">Unit Cost (PKR)</th>
                                                <th className="p-3 font-medium text-right">Total (PKR)</th>
                                                <th className="p-3 font-medium text-center w-12"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-muted">
                                            {selectedItems.map((item, index) => {
                                                const discrepancy = item.physicalQty - item.currentQty;
                                                const lineCost = discrepancy * item.rate;

                                                return (
                                                    <tr key={`${item.id}-${item.locationId}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
                                                        <td className="p-3">
                                                            <div className="flex flex-col">
                                                                <span className="font-mono font-bold text-sm">{item.sku}</span>
                                                                <span className="text-xs text-muted-foreground truncate max-w-40" title={item.description || ""}>
                                                                    {item.description || "—"}
                                                                </span>
                                                                <div className="flex gap-2 text-[10px] text-slate-500 font-semibold mt-0.5">
                                                                    {item.color && <span>Color: {item.color}</span>}
                                                                    {item.size && <span>Size: {item.size}</span>}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-3 text-right tabular-nums font-medium text-slate-500">
                                                            {item.currentQty.toFixed(2)}
                                                        </td>
                                                        <td className="p-3 text-right">
                                                            <Input
                                                                type="number"
                                                                step="0.0001"
                                                                min="0"
                                                                value={item.physicalQty}
                                                                onChange={(e) => handleUpdateItem(index, { physicalQty: Number(e.target.value) })}
                                                                className="h-8 text-right px-2 font-semibold font-mono"
                                                            />
                                                        </td>
                                                        <td className="p-3 text-right font-bold tabular-nums">
                                                            {discrepancy === 0 ? (
                                                                <span className="text-slate-400">0.00</span>
                                                            ) : discrepancy > 0 ? (
                                                                <span className="text-emerald-600">+{discrepancy.toFixed(2)}</span>
                                                            ) : (
                                                                <span className="text-red-600">{discrepancy.toFixed(2)}</span>
                                                            )}
                                                        </td>
                                                        <td className="p-3 text-right">
                                                            <Input
                                                                type="number"
                                                                step="0.01"
                                                                min="0"
                                                                value={item.rate}
                                                                onChange={(e) => handleUpdateItem(index, { rate: Number(e.target.value) })}
                                                                className="h-8 text-right px-2 font-mono"
                                                            />
                                                        </td>
                                                        <td className={cn(
                                                            "p-3 text-right tabular-nums font-semibold",
                                                            lineCost === 0 ? "text-slate-400" : lineCost > 0 ? "text-emerald-600" : "text-red-600"
                                                        )}>
                                                            {lineCost === 0 ? "" : lineCost > 0 ? "+" : ""}
                                                            {lineCost.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </td>
                                                        <td className="p-3 text-center">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleRemoveItem(index)}
                                                                className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                                                            >
                                                                <Trash className="h-4 w-4" />
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Summary Calculation Card */}
                    <Card className="shadow-sm border-muted h-fit">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-lg">Adjustment Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center py-2 border-b border-muted">
                                <span className="text-sm text-muted-foreground">Total Items</span>
                                <span className="text-sm font-semibold">{totalItems}</span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-muted">
                                <span className="text-sm text-muted-foreground">Value Increase</span>
                                <span className="text-sm font-semibold text-emerald-600">
                                    +{valueIncrease.toLocaleString("en-PK", { minimumFractionDigits: 2 })} PKR
                                </span>
                            </div>
                            <div className="flex justify-between items-center py-2 border-b border-muted">
                                <span className="text-sm text-muted-foreground">Value Decrease</span>
                                <span className="text-sm font-semibold text-red-600">
                                    -{valueDecrease.toLocaleString("en-PK", { minimumFractionDigits: 2 })} PKR
                                </span>
                            </div>
                            <div className="flex justify-between items-center py-3 border-t-2 border-muted">
                                <span className="text-base font-bold">Net Change Value</span>
                                <span className={cn(
                                    "text-base font-bold",
                                    netChange >= 0 ? "text-emerald-600" : "text-red-600"
                                )}>
                                    {netChange >= 0 ? "+" : ""}
                                    {netChange.toLocaleString("en-PK", { minimumFractionDigits: 2 })} PKR
                                </span>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
