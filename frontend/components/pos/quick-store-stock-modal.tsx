"use client";

import React, { useState, useEffect, useRef } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
    Search,
    Store,
    Phone,
    MapPin,
    AlertCircle,
    CheckCircle2,
    Loader2,
    Layers,
    X,
    ExternalLink,
    Copy,
    Check,
} from "lucide-react";
import { getPosQuickStock } from "@/lib/actions/stock-ledger";
import { useAuth } from "@/components/providers/auth-provider";
import { formatCurrency, cn } from "@/lib/utils";
import Link from "next/link";
import { toast } from "sonner";

interface QuickStoreStockModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialQuery?: string;
}

interface ItemStockResult {
    id: string;
    sku: string;
    barcode: string;
    articleName: string;
    brand: string;
    size: string;
    color: string;
    unitPrice: number;
    currentStoreQty: number;
    totalAvailable: number;
    warehouseStock: number;
    storesWithStock: Array<{
        locationId: string;
        locationName: string;
        shortCode?: string;
        phone?: string;
        address?: string;
        qty: number;
        isCurrent: boolean;
    }>;
}

export function QuickStoreStockModal({
    isOpen,
    onClose,
    initialQuery = "",
}: QuickStoreStockModalProps) {
    const { user } = useAuth();
    const currentLocationId = (user as any)?.terminal?.location?.id || (user as any)?.locationId;
    const currentLocationName = (user as any)?.terminal?.location?.name || "Current Store";

    const [query, setQuery] = useState(initialQuery);
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<ItemStockResult[]>([]);
    const [copiedStore, setCopiedStore] = useState<string | null>(null);

    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setQuery(initialQuery);
            if (initialQuery.trim()) {
                handleSearch(initialQuery);
            }
            setTimeout(() => inputRef.current?.focus(), 100);
        } else {
            setResults([]);
        }
    }, [isOpen, initialQuery]);

    const handleSearch = async (searchTerm: string) => {
        if (!searchTerm || !searchTerm.trim()) return;

        setIsLoading(true);
        try {
            const res = await getPosQuickStock(searchTerm.trim(), currentLocationId);
            if (res && res.status && res.data?.items) {
                setResults(res.data.items);
                if (res.data.items.length === 0) {
                    toast.info("No items found matching this barcode or SKU.");
                }
            } else {
                setResults([]);
            }
        } catch (err) {
            console.error("Quick stock search error:", err);
            toast.error("Failed to check inter-store stock.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleSearch(query);
        }
    };

    const copyStoreInfo = (store: { locationName: string; phone?: string; address?: string; qty: number }) => {
        const text = `${store.locationName}${store.phone ? ` | Ph: ${store.phone}` : ""}${store.address ? ` | ${store.address}` : ""} (Qty: ${store.qty})`;
        navigator.clipboard.writeText(text);
        setCopiedStore(store.locationName);
        toast.success(`Copied store details for ${store.locationName}`);
        setTimeout(() => setCopiedStore(null), 2000);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent noScroll className="max-w-3xl h-[85vh] max-h-[85vh] flex flex-col p-0 overflow-hidden sm:rounded-2xl border shadow-2xl">
                <DialogHeader className="shrink-0 p-4 sm:p-5 border-b border-border bg-slate-50 dark:bg-slate-900/50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                <Store className="h-5 w-5" />
                            </div>
                            <div>
                                <DialogTitle className="text-lg font-bold flex items-center gap-2">
                                    Check Other Stores Stock
                                    <Badge variant="outline" className="text-[10px] font-normal border-primary/30 text-primary">
                                        Inter-Branch Lookup
                                    </Badge>
                                </DialogTitle>
                                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                    Current Store: <span className="font-semibold text-foreground">{currentLocationName}</span>
                                </DialogDescription>
                            </div>
                        </div>
                    </div>

                    {/* Search Input */}
                    <div className="relative mt-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            ref={inputRef}
                            placeholder="Scan barcode or enter SKU / Article Name and press Enter..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="pl-9 pr-20 h-10 text-xs sm:text-sm font-medium"
                        />
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            {query && (
                                <button
                                    onClick={() => {
                                        setQuery("");
                                        setResults([]);
                                        inputRef.current?.focus();
                                    }}
                                    className="p-1 text-muted-foreground hover:text-foreground"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                            <Button
                                size="sm"
                                onClick={() => handleSearch(query)}
                                disabled={isLoading || !query.trim()}
                                className="h-7 px-2.5 text-xs font-semibold"
                            >
                                {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Search"}
                            </Button>
                        </div>
                    </div>
                </DialogHeader>

                {/* Results Section with Native Styled Scrollable Area */}
                <ScrollArea className="flex-1 min-h-0 w-full" showShadows={true}>
                    <div className="p-4 sm:p-5 space-y-4">
                        {isLoading ? (
                            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                                <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                                <p className="text-xs font-medium">Checking stock across all branches...</p>
                            </div>
                        ) : results.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                                <AlertCircle className="h-9 w-9 text-muted-foreground/40 mb-2" />
                                <p className="text-sm font-medium">No stock inquiry results</p>
                                <p className="text-xs text-muted-foreground/80 mt-1 max-w-sm">
                                    Scan an item barcode or type its SKU / Article name above to see which outlets have it in stock.
                                </p>
                            </div>
                        ) : (
                            results.map((item) => {
                                const isOutOfStockHere = item.currentStoreQty <= 0;
                                const otherStoresWithStock = item.storesWithStock.filter((s) => !s.isCurrent);

                                return (
                                    <div
                                        key={item.id}
                                        className="border border-border rounded-xl p-4 bg-card hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-xs"
                                    >
                                        {/* Item Header */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <Badge variant="secondary" className="text-[10px] uppercase font-bold">
                                                        {item.brand}
                                                    </Badge>
                                                    <h3 className="text-sm font-bold text-foreground">
                                                        {item.articleName}
                                                    </h3>
                                                </div>
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
                                                    <span>SKU: <strong className="text-foreground font-mono">{item.sku}</strong></span>
                                                    <span>•</span>
                                                    <span>Size: <strong className="text-foreground">{item.size}</strong></span>
                                                    <span>•</span>
                                                    <span>Color: <strong className="text-foreground">{item.color}</strong></span>
                                                    <span>•</span>
                                                    <span>Barcode: <strong className="text-foreground font-mono">{item.barcode}</strong></span>
                                                </div>
                                            </div>

                                            <div className="flex sm:flex-col items-end justify-between sm:justify-center">
                                                <span className="text-sm font-black text-foreground">
                                                    {formatCurrency(item.unitPrice)}
                                                </span>
                                                <span className="text-[11px] text-muted-foreground">
                                                    Total Network Stock: <strong className={cn(
                                                        "font-bold",
                                                        item.totalAvailable > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-500"
                                                    )}>{item.totalAvailable}</strong>
                                                </span>
                                            </div>
                                        </div>

                                        {/* Current Branch Status */}
                                        <div className="mt-3 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-900/40 flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-xs">
                                                <Store className="h-4 w-4 text-slate-500" />
                                                <span>This Outlet (<strong>{currentLocationName}</strong>):</span>
                                            </div>
                                            <div>
                                                {isOutOfStockHere ? (
                                                    <Badge variant="destructive" className="text-[10px] font-bold">
                                                        Out of Stock (0)
                                                    </Badge>
                                                ) : (
                                                    <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold">
                                                        In Stock ({item.currentStoreQty} Available)
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>

                                        {/* Other Outlets Availability */}
                                        <div className="mt-3">
                                            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                                Availability at Other Outlets & Warehouses:
                                            </p>

                                            {otherStoresWithStock.length === 0 ? (
                                                <p className="text-xs text-rose-500 font-medium py-2">
                                                    Not available at any other retail outlet.
                                                </p>
                                            ) : (
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {otherStoresWithStock.map((store) => (
                                                        <div
                                                            key={store.locationId}
                                                            className="flex items-center justify-between p-2.5 rounded-lg border border-border/80 bg-slate-50/50 dark:bg-slate-900/30 hover:bg-slate-100/60 dark:hover:bg-slate-800/40 transition-colors"
                                                        >
                                                            <div className="flex flex-col min-w-0 pr-2">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="text-xs font-bold text-foreground truncate">
                                                                        {store.locationName}
                                                                    </span>
                                                                    {store.shortCode && (
                                                                        <span className="text-[9px] px-1 py-0.2 rounded bg-muted text-muted-foreground font-mono">
                                                                            {store.shortCode}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {store.phone && (
                                                                    <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                                                        <Phone className="h-3 w-3 text-muted-foreground/70" />
                                                                        {store.phone}
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <div className="flex items-center gap-2 shrink-0">
                                                                <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                                                    {store.qty} pcs
                                                                </span>

                                                                <button
                                                                    onClick={() => copyStoreInfo(store)}
                                                                    className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
                                                                    title="Copy Store Contact"
                                                                >
                                                                    {copiedStore === store.locationName ? (
                                                                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                                                                    ) : (
                                                                        <Copy className="h-3.5 w-3.5" />
                                                                    )}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {item.warehouseStock > 0 && (
                                                <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-2 flex items-center gap-1">
                                                    <span>Central Warehouse Stock:</span>
                                                    <strong className="font-semibold">{item.warehouseStock} pcs</strong>
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </ScrollArea>

                {/* Footer link to full matrix report */}
                <div className="shrink-0 p-3 border-t border-border bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between text-xs text-muted-foreground">
                    <span>Press <kbd className="px-1 py-0.5 rounded bg-muted border border-border text-[10px] font-mono">Esc</kbd> to close</span>

                    <Link
                        href="/pos/reports/overall-stock-matrix"
                        onClick={onClose}
                        className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
                    >
                        <Layers className="h-3.5 w-3.5" />
                        Open Full Overall Stock Matrix Report
                        <ExternalLink className="h-3 w-3" />
                    </Link>
                </div>
            </DialogContent>
        </Dialog>
    );
}

