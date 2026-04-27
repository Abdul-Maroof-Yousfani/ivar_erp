"use client";

import { Input } from "@/components/ui/input";
import {
    ScanBarcode,
    ShoppingCart,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface TopBarProps {
    itemCount: number;
    searchQuery: string;
    onSearchChange: (value: string) => void;
    onSearchSubmit: () => void;
    searchResults: any[];
    isSearching: boolean;
    onSelectProduct: (product: any) => void;
    searchInputRef?: React.RefObject<HTMLInputElement | null>;
}

export function NewSaleTopBar({
    itemCount,
    searchQuery,
    onSearchChange,
    onSearchSubmit,
    searchResults,
    isSearching,
    onSelectProduct,
    searchInputRef,
}: TopBarProps) {
    return (
        <div className="rounded-xl border-2 border-primary/30 bg-card p-4 shadow-sm relative z-50">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                {/* Left section: Label + Search + Actions */}
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-3 flex-1">
                    {/* PRODUCT ENTRY label */}
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        Product Entry
                    </span>

                    {/* Search Input with Autocomplete */}
                    <div className="relative flex-1 max-w-lg">
                        <ScanBarcode className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            ref={searchInputRef}
                            placeholder="Scan Barcode / Search Product by Name or SKU..."
                            value={searchQuery}
                            onChange={(e) => onSearchChange(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    onSearchSubmit();
                                }
                            }}
                            className="pl-9 bg-muted/50 border-input h-10 w-full"
                        />

                        {/* Autocomplete Dropdown */}
                        {searchQuery.trim().length > 0 && (searchResults.length > 0 || isSearching) && (
                            <div className="absolute left-0 right-0 top-12 bg-popover border border-border shadow-md rounded-md overflow-hidden z-[500] max-h-64 overflow-y-auto">
                                {isSearching ? (
                                    <div className="p-3 text-sm text-muted-foreground flex items-center justify-center">
                                        Searching...
                                    </div>
                                ) : (
                                    <ul className="flex flex-col">
                                        {searchResults.map((product) => (
                                            <li
                                                key={product.id}
                                                className="px-4 py-2 hover:bg-muted cursor-pointer flex items-center justify-between border-b border-border/50 last:border-0"
                                                onClick={() => onSelectProduct(product)}
                                            >
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-semibold">{product.description || 'Unknown Product'}</span>
                                                    <span className="text-xs text-muted-foreground">SKU: {product.sku || product.barCode || '-'}</span>
                                                </div>
                                                <div className="flex flex-col items-end gap-1">
                                                    <span className="text-sm font-bold">{formatCurrency(product.unitPrice || 0)}</span>
                                                    <div className="flex items-center gap-2">
                                                        {product.stockQty !== undefined && (
                                                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${product.stockQty <= 0 ? 'bg-orange-100 text-orange-700' : 'bg-muted text-muted-foreground'}`}>
                                                                Qty: {product.stockQty}
                                                            </span>
                                                        )}
                                                        {product.inStock === false && (
                                                            <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter">Out of Stock</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Right section: Items Count (Stock Status and Tender Button removed) */}
                <div className="flex items-center gap-6">
                    {/* Items in Cart */}
                    <div className="flex flex-col items-center gap-0.5 ml-auto">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            Items in Cart
                        </span>
                        <div className="flex items-center gap-1.5">
                            <ShoppingCart className="h-4 w-4 text-foreground" />
                            <span className="text-2xl font-bold leading-none">
                                {itemCount}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
