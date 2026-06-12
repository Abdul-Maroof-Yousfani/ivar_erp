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
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
    createStockAdjustment,
    searchInventoryItems,
} from "@/lib/actions/stock-adjustment";
import { bulkSearchItems } from "@/lib/actions/items";
import { toast } from "sonner"; // Using standard system toast if available, fallback to console or local alert if needed

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
    locationId: string | null;
}

export function NewStockAdjustmentForm({ warehouses, locations }: NewStockAdjustmentFormProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const [warehouseId, setWarehouseId] = useState<string>("");
    const [locationId, setLocationId] = useState<string>("none");
    const [reason, setReason] = useState<string>("");
    const [notes, setNotes] = useState<string>("");

    // Search state
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState<boolean>(false);
    const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);

    // Quick Paste state
    const [inputMode, setInputMode] = useState<"search" | "paste">("search");
    const [pasteContent, setPasteContent] = useState<string>("");
    const [isResolvingPaste, setIsResolvingPaste] = useState<boolean>(false);

    // Automatically trigger search when query changes
    useEffect(() => {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            return;
        }

        const delayDebounceFn = setTimeout(async () => {
            setIsSearching(true);
            try {
                const whId = warehouseId ? warehouseId : undefined;
                const locId = locationId !== "none" ? locationId : undefined;
                const result = await searchInventoryItems(searchQuery, whId, locId);
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

    // Handle adding item
    const handleAddItem = (item: any) => {
        // Avoid duplicates
        const existing = selectedItems.find((i) => i.id === item.id && i.locationId === (locationId !== "none" ? locationId : null));
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
            locationId: locationId !== "none" ? locationId : null,
        };

        setSelectedItems((prev) => [...prev, newItem]);
        setSearchQuery("");
        setSearchResults([]);
    };

    // Update quantities or rate in selected items list
    const handleUpdateItem = (index: number, fields: Partial<SelectedItem>) => {
        setSelectedItems((prev) => {
            const updated = [...prev];
            updated[index] = { ...updated[index], ...fields };
            return updated;
        });
    };

    // Remove item
    const handleRemoveItem = (index: number) => {
        setSelectedItems((prev) => prev.filter((_, i) => i !== index));
    };

    // Process Quick Paste from Excel
    const handleProcessPaste = async () => {
        if (!pasteContent.trim()) {
            toast.error("Please paste some content first");
            return;
        }

        setIsResolvingPaste(true);
        try {
            const lines = pasteContent.split("\n");
            const parsedLines: { barcode: string; qty?: number }[] = [];

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed) continue;

                // Split by tab, comma, or spaces
                const tokens = trimmed.split(/[\t,]+/);
                const firstToken = tokens[0]?.trim();
                if (!firstToken) continue;

                let barcode = firstToken;
                let qty: number | undefined = undefined;

                if (tokens.length > 1) {
                    const secondToken = tokens[1]?.trim();
                    const num = Number(secondToken);
                    if (!isNaN(num)) {
                        qty = num;
                    }
                } else {
                    const spaceTokens = trimmed.split(/\s+/);
                    if (spaceTokens.length > 1) {
                        barcode = spaceTokens[0].trim();
                        const num = Number(spaceTokens[1].trim());
                        if (!isNaN(num)) {
                            qty = num;
                        }
                    }
                }

                parsedLines.push({ barcode, qty });
            }

            if (parsedLines.length === 0) {
                toast.error("No valid lines found to process");
                setIsResolvingPaste(false);
                return;
            }

            const barcodesToSearch = parsedLines.map((pl) => pl.barcode);
            const searchResult = await bulkSearchItems(barcodesToSearch);
            if (!searchResult.status || !Array.isArray(searchResult.data)) {
                toast.error(searchResult.message || "Failed to search pasted items");
                setIsResolvingPaste(false);
                return;
            }

            const foundItems = searchResult.data;
            if (foundItems.length === 0) {
                toast.error("No matching items found for the pasted barcodes");
                setIsResolvingPaste(false);
                return;
            }

            const resolvedWithStock = await Promise.all(
                foundItems.map(async (item: any) => {
                    const whId = warehouseId ? warehouseId : undefined;
                    const locId = locationId !== "none" ? locationId : undefined;
                    const result = await searchInventoryItems(item.sku, whId, locId);
                    const matching = result.status && result.data?.find((i: any) => i.id === item.id);
                    return {
                        ...item,
                        totalQuantity: matching ? Number(matching.totalQuantity || 0) : 0,
                    };
                })
            );

            let addedCount = 0;
            let skippedCount = 0;

            setSelectedItems((prev) => {
                const updated = [...prev];

                for (const item of resolvedWithStock) {
                    const matchedPaste = parsedLines.find(
                        (pl) =>
                            pl.barcode.toLowerCase() === item.sku.toLowerCase() ||
                            (item.barCode && pl.barcode.toLowerCase() === item.barCode.toLowerCase()) ||
                            pl.barcode.toLowerCase() === item.itemId.toLowerCase()
                    );

                    const targetLoc = locationId !== "none" ? locationId : null;
                    const exists = updated.find((ui) => ui.id === item.id && ui.locationId === targetLoc);

                    if (exists) {
                        skippedCount++;
                        continue;
                    }

                    const currentQty = Number(item.totalQuantity || 0);
                    const physicalQty = matchedPaste && matchedPaste.qty !== undefined ? matchedPaste.qty : currentQty;

                    updated.push({
                        id: item.id,
                        sku: item.sku,
                        description: item.description,
                        currentQty,
                        physicalQty,
                        rate: Number(item.unitCost || item.unitPrice || 0),
                        locationId: targetLoc,
                    });
                    addedCount++;
                }

                return updated;
            });

            if (addedCount > 0) {
                toast.success(`Successfully added ${addedCount} items.`);
            }
            if (skippedCount > 0) {
                toast.warning(`${skippedCount} duplicate items were skipped.`);
            }

            setPasteContent("");
            setInputMode("search");
        } catch (error: any) {
            console.error("Paste processing failed:", error);
            toast.error("Failed to process paste data");
        } finally {
            setIsResolvingPaste(false);
        }
    };

    // Submit form (create Draft)
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!warehouseId) {
            toast.error("Please select a warehouse");
            return;
        }

        if (selectedItems.length === 0) {
            toast.error("Please add at least one item to adjust");
            return;
        }

        startTransition(async () => {
            try {
                const payload = {
                    warehouseId,
                    reason: reason || undefined,
                    notes: notes || undefined,
                    items: selectedItems.map((item) => ({
                        itemId: item.id,
                        locationId: item.locationId || undefined,
                        physicalQty: item.physicalQty,
                        rate: item.rate,
                    })),
                };

                const result = await createStockAdjustment(payload);

                if (result.status !== false) {
                    toast.success("Stock adjustment created as DRAFT");
                    router.push("/erp/inventory/transactions/stock-adjustment");
                } else {
                    toast.error(result.message || "Failed to create stock adjustment");
                }
            } catch (error: any) {
                toast.error(error.message || "Something went wrong");
            }
        });
    };

    // Calculated totals
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

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">New Stock Adjustment</h2>
                    <p className="text-muted-foreground text-sm mt-1">
                        Create a draft stock adjustment. Adjustments do not affect active stock until posted/submitted.
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
                    <Button type="submit" disabled={isPending}>
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Save as Draft
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Header Information */}
                <Card className="lg:col-span-2 shadow-sm border-muted">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg">Header Information</CardTitle>
                        <CardDescription>Select the warehouse, location, and reason for adjustment</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="warehouse">Warehouse <span className="text-red-500">*</span></Label>
                                <Select
                                    value={warehouseId}
                                    onValueChange={(val) => {
                                        setWarehouseId(val);
                                        setSelectedItems([]); // Clear selected items on warehouse change
                                    }}
                                    required
                                >
                                    <SelectTrigger id="warehouse" className="w-full">
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

                            <div className="space-y-2">
                                <Label htmlFor="location">Default Location / Outlet</Label>
                                <Select
                                    value={locationId}
                                    onValueChange={(val) => {
                                        setLocationId(val);
                                        // Update all items that don't have override location
                                        setSelectedItems((prev) =>
                                            prev.map((item) => ({
                                                ...item,
                                                locationId: val === "none" ? null : val,
                                            }))
                                        );
                                    }}
                                >
                                    <SelectTrigger id="location" className="w-full">
                                        <SelectValue placeholder="Warehouse Stock (Default)" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="none">Warehouse Stock (No Location)</SelectItem>
                                        {locations.map((l) => (
                                            <SelectItem key={l.id} value={l.id}>
                                                {l.name} ({l.code})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="reason">Reason for Adjustment</Label>
                            <Input
                                id="reason"
                                placeholder="e.g. Annual Stock Audit, Damaged Items, Found Stock"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="notes">Internal Notes</Label>
                            <Textarea
                                id="notes"
                                placeholder="Add optional reference details or internal remarks here"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={3}
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Adjustments Summary Card */}
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

            {/* Items to Adjust Section */}
            <Card className="shadow-sm border-muted">
                <CardHeader>
                    <CardTitle className="text-lg">Items to Adjust</CardTitle>
                    <CardDescription>Search for active SKU or barcode to add them, then edit physical count.</CardDescription>
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
                                            : "⚠️ Select warehouse first to search items"
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
                                                    Cost: {Number(item.unitCost || 0).toFixed(2)} PKR
                                                </span>
                                                <Button size="xs" variant="ghost" className="h-7 w-7 p-0 rounded-full bg-primary/10 text-primary hover:bg-primary/20">
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
                        <div className="space-y-3">
                            <Label htmlFor="quick-paste-box" className="text-xs text-muted-foreground">
                                Paste list of Barcodes/SKUs and optional Quantities (separated by Tab, Comma, or Space) directly from Excel.
                            </Label>
                            <Textarea
                                id="quick-paste-box"
                                placeholder={`Example:\nSKU-001\t10\nSKU-002\t25\nSKU-003`}
                                value={pasteContent}
                                onChange={(e) => setPasteContent(e.target.value)}
                                rows={6}
                                className="font-mono text-sm"
                                disabled={!warehouseId}
                            />
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
                                Add Pasted Items
                            </Button>
                        </div>
                    )}

                    {/* Adjusted Items Table */}
                    {selectedItems.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border-2 border-dashed border-muted rounded-md bg-slate-50/50 dark:bg-slate-900/10">
                            <AlertCircle className="h-10 w-10 text-muted-foreground/60 mb-2" />
                            <p className="text-sm font-medium">No items added to adjustment list</p>
                            <p className="text-xs mt-1">Use the search bar above to select items.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto border border-muted rounded-md">
                            <table className="w-full text-sm text-left border-collapse">
                                <thead className="bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-semibold border-b border-muted">
                                    <tr>
                                        <th className="p-3 font-medium">Item Info</th>
                                        <th className="p-3 font-medium">Location</th>
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
                                                    </div>
                                                </td>
                                                <td className="p-3">
                                                    <Select
                                                        value={item.locationId || "none"}
                                                        onValueChange={async (val) => {
                                                            const locId = val === "none" ? null : val;
                                                            // Reload stock for this specific location
                                                            try {
                                                                const result = await searchInventoryItems(item.sku, warehouseId, locId || undefined);
                                                                const matchingItem = result.status && result.data?.find((i: any) => i.id === item.id);
                                                                const newCurrent = matchingItem ? Number(matchingItem.totalQuantity || 0) : 0;
                                                                handleUpdateItem(index, {
                                                                    locationId: locId,
                                                                    currentQty: newCurrent,
                                                                    physicalQty: newCurrent, // Reset physical quantity
                                                                });
                                                            } catch (error) {
                                                                console.error("Failed to update item location details", error);
                                                            }
                                                        }}
                                                    >
                                                        <SelectTrigger className="h-8 py-0 min-w-32 text-xs">
                                                            <SelectValue placeholder="Warehouse Stock" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="none">Warehouse Stock</SelectItem>
                                                            {locations.map((l) => (
                                                                <SelectItem key={l.id} value={l.id}>
                                                                    {l.name}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
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
        </form>
    );
}
