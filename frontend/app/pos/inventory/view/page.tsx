"use client";

import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, PackageOpen, RefreshCcw, ChevronRight, TrendingDown, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StockLocationDrawer } from "@/components/pos/inventory/stock-location-drawer";
import { useDebounce } from "@/hooks/use-debounce";
import { posSalesApi } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/providers/auth-provider";
import { PermissionGuard } from "@/components/auth/permission-guard";

interface InventoryItem {
    id: string;
    sku: string;
    description: string;
    imageUrl?: string;
    stockQty: number;
    unitPrice?: number;
    brand?: string;
}

function StockBadge({ qty }: { qty: number }) {
    if (qty <= 0)
        return (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-destructive">
                <AlertTriangle className="h-3 w-3" /> Out of Stock
            </span>
        );
    if (qty <= 5)
        return (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600">
                <TrendingDown className="h-3 w-3" /> Low — {qty}
            </span>
        );
    return <span className="text-xs font-bold text-emerald-600">{qty} units</span>;
}

export default function InventoryViewPage() {
    const [searchQuery, setSearchQuery] = useState("");
    const debouncedSearch = useDebounce(searchQuery, 300);
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    async function fetchInventory(query = debouncedSearch) {        setIsLoading(true);
        try {
            const res = await posSalesApi.lookup(query);
            setItems(res.status && res.data ? res.data : []);
        } catch {
            setItems([]);
        } finally {
            setIsLoading(false);
        }
    }

    useEffect(() => { fetchInventory(); }, [debouncedSearch]);

    const handleItemClick = (item: InventoryItem) => {
        setSelectedItem(item);
        setIsDrawerOpen(true);
    };

    return (
        <PermissionGuard permissions="pos.inventory.view">
        <div className="flex flex-col h-full -m-4 sm:-m-6 lg:-m-8">
            {/* Header */}
            <div
                className="flex-none p-4 md:p-6 pb-4 border-b bg-muted/20 backdrop-blur-xl border-border/50 sticky z-10"
                style={{ top: "calc(var(--banner-height) + 4rem)" }}
            >
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Stock View</h1>
                        <p className="text-sm text-muted-foreground font-medium mt-0.5">
                            {items.length > 0 ? `${items.length} items found` : "Search to check stock levels"}
                        </p>
                    </div>
                    <Button variant="outline" size="icon" onClick={() => fetchInventory()} disabled={isLoading}>
                        <RefreshCcw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                    </Button>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 pointer-events-none" />
                    <Input
                        placeholder="Search by SKU, item name, or description…"
                        className="pl-9 h-11 bg-muted/30 border-border/50"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                    />
                </div>
            </div>

            {/* Table Header */}
            {!isLoading && items.length > 0 && (
                <div className="flex-none px-4 md:px-6 py-2 border-b bg-muted/10">
                    <div className="grid grid-cols-[1fr_auto_auto] gap-4 items-center">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Item</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-right w-24">Stock</span>
                        <span className="w-5" />
                    </div>
                </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-auto divide-y divide-border/50 mt-4">
                {isLoading ? (
                    <div className="p-4 space-y-2">
                        {[...Array(8)].map((_, i) => (
                            <Skeleton key={i} className="h-16 w-full rounded-lg" />
                        ))}
                    </div>
                ) : items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[50vh] text-center p-8">
                        <PackageOpen className="w-14 h-14 text-muted-foreground/20 mb-3" />
                        <p className="font-semibold text-muted-foreground">
                            {searchQuery ? `No results for "${searchQuery}"` : "Start searching to view stock"}
                        </p>
                        <p className="text-sm text-muted-foreground/60 mt-1">Try SKU, brand, or item name</p>
                    </div>
                ) : (
                    items.map((item) => (
                        <button
                            key={item.id}
                            className="w-full flex items-center gap-4 px-4 md:px-6 py-3.5 hover:bg-muted/30 transition-colors text-left group"
                            onClick={() => handleItemClick(item)}
                        >
                            {/* SKU + Name */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="font-mono text-[10px] font-bold tracking-widest text-muted-foreground uppercase bg-muted/60 px-1.5 py-0.5 rounded">
                                        {item.sku}
                                    </span>
                                    {item.brand && (
                                        <span className="text-[10px] text-muted-foreground/70 font-medium">{item.brand}</span>
                                    )}
                                </div>
                                <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                                    {item.description}
                                </p>
                            </div>

                            {/* Stock qty */}
                            <div className="flex-none w-24 text-right">
                                <StockBadge qty={item.stockQty} />
                            </div>

                            {/* Arrow */}
                            <ChevronRight className="h-4 w-4 text-muted-foreground/40 flex-none group-hover:text-primary transition-colors" />
                        </button>
                    ))
                )}
            </div>

            {/* Details Side Drawer */}
            <StockLocationDrawer
                item={selectedItem ? {
                    id: selectedItem.id,
                    sku: selectedItem.sku,
                    description: selectedItem.description,
                    totalQuantity: selectedItem.stockQty,
                } : null}
                isOpen={isDrawerOpen}
                onClose={() => setIsDrawerOpen(false)}
            />
        </div>
        </PermissionGuard>
    );
}
