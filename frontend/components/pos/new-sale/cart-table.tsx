"use client";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Minus, Plus, Trash2, CircleDot, Truck } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export interface CartItem {
    id: string;
    upc: string;
    sku: string;
    name: string;
    brand: string;
    size: string;
    color: string;
    quantity: number;
    price: number;
    discountPercent: number;
    discountAmount: number;
    taxPercent: number;
    taxAmount: number;
    total: number;
    inStock: boolean;
    stockQty: number;
    isStockInTransit?: boolean;
}

interface CartTableProps {
    items: CartItem[];
    onQuantityChange: (id: string, quantity: number) => void;
    onDiscountChange?: (id: string, discountPercent: number) => void;
    onRemoveItem: (id: string) => void;
    onToggleTransit?: (id: string) => void;
}

export function CartTable({
    items,
    onQuantityChange,
    onDiscountChange,
    onRemoveItem,
    onToggleTransit,
}: CartTableProps) {
    return (
        <div className="rounded-xl border bg-card shadow-sm overflow-x-auto flex-1 min-w-0">
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableHead className="w-[50px] text-center font-semibold text-xs uppercase tracking-wider">
                            #
                        </TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider min-w-[150px]">
                            UPC / SKU
                        </TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider min-w-[180px]">
                            Item Description
                        </TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">
                            Size/Color
                        </TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-center">
                            Stock
                        </TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-center min-w-[120px]">
                            Quantity
                        </TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-right">
                            Price
                        </TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-center min-w-[100px]">
                            Disc %
                        </TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-right">
                            Disc Amt
                        </TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-right">
                            Tax
                        </TableHead>
                        <TableHead className="font-semibold text-xs uppercase tracking-wider text-right">
                            Total
                        </TableHead>
                        <TableHead className="w-[50px]" />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.length === 0 ? (
                        <TableRow>
                            <TableCell
                                colSpan={12}
                                className="h-[300px] text-center"
                            >
                                <div className="flex flex-col items-center justify-center gap-3 text-muted-foreground">
                                    <div className="rounded-full bg-muted p-4">
                                        <Minus className="h-8 w-8 opacity-30" />
                                    </div>
                                    <p className="text-sm font-medium">
                                        No items in cart
                                    </p>
                                    <p className="text-xs">
                                        Scan a barcode or search for a product
                                        to get started
                                    </p>
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : (
                        items.map((item, index) => (
                            <TableRow
                                key={item.id}
                                className="group transition-colors"
                            >
                                {/* Row number */}
                                <TableCell className="text-center text-muted-foreground font-medium">
                                    {index + 1}
                                </TableCell>

                                {/* UPC / SKU */}
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-mono text-sm font-medium">
                                            {item.upc}
                                        </span>
                                        <span className="text-[11px] text-muted-foreground font-mono">
                                            {item.sku}
                                        </span>
                                    </div>
                                </TableCell>

                                {/* Item Description */}
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className="font-medium text-sm">
                                            {item.name}
                                        </span>
                                        <span className="text-[11px] text-muted-foreground">
                                            {item.brand}
                                        </span>
                                    </div>
                                </TableCell>

                                {/* Size / Color */}
                                <TableCell className="text-center">
                                    <div className="flex items-center justify-center gap-1.5">
                                        <Badge
                                            variant="secondary"
                                            className="text-[11px] px-2 py-0.5 rounded-md"
                                        >
                                            {item.size}
                                        </Badge>
                                        <span className="text-sm text-muted-foreground">
                                            {item.color}
                                        </span>
                                    </div>
                                </TableCell>

                                {/* Stock status */}
                                <TableCell className="text-center">
                                    <div className="flex flex-col items-center gap-1">
                                        <div className="flex items-center gap-1">
                                            <CircleDot
                                                className={`h-3 w-3 ${item.isStockInTransit
                                                    ? "text-amber-500"
                                                    : item.stockQty > 0
                                                        ? "text-emerald-500"
                                                        : "text-red-500"
                                                    }`}
                                            />
                                            <span
                                                className={`text-[11px] font-medium ${item.isStockInTransit
                                                    ? "text-amber-600 dark:text-amber-400"
                                                    : item.stockQty > 0
                                                        ? "text-emerald-600 dark:text-emerald-400"
                                                        : "text-red-600 dark:text-red-400"
                                                    }`}
                                            >
                                                {item.isStockInTransit
                                                    ? "In Transit"
                                                    : item.stockQty > 0
                                                        ? `Qty: ${item.stockQty}`
                                                        : "Out of Stock"}
                                            </span>
                                        </div>
                                        {onToggleTransit && (
                                            <button
                                                onClick={() => onToggleTransit(item.id)}
                                                title={item.isStockInTransit ? "Remove transit flag" : "Mark as stock in transit"}
                                                className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded transition-colors ${item.isStockInTransit
                                                    ? "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400"
                                                    : "bg-muted text-muted-foreground hover:bg-amber-100 hover:text-amber-700"
                                                    }`}
                                            >
                                                <Truck className="h-2.5 w-2.5" />
                                                Transit
                                            </button>
                                        )}
                                    </div>
                                </TableCell>

                                {/* Quantity */}
                                <TableCell>
                                    <div className="flex items-center justify-center gap-1">
                                        <Button
                                            variant="outline"
                                            size="icon-sm"
                                            onClick={() =>
                                                onQuantityChange(
                                                    item.id,
                                                    Math.max(
                                                        1,
                                                        item.quantity - 1
                                                    )
                                                )
                                            }
                                            className="h-7 w-7 rounded-md"
                                        >
                                            <Minus className="h-3 w-3" />
                                        </Button>
                                        <span className="w-8 text-center font-semibold text-sm tabular-nums">
                                            {item.quantity}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="icon-sm"
                                            onClick={() =>
                                                onQuantityChange(
                                                    item.id,
                                                    item.quantity + 1
                                                )
                                            }
                                            className="h-7 w-7 rounded-md"
                                        >
                                            <Plus className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </TableCell>

                                {/* Price */}
                                <TableCell className="text-right font-medium tabular-nums">
                                    {formatCurrency(item.price)}
                                </TableCell>

                                {/* Discount % */}
                                <TableCell>
                                    <div className="flex items-center justify-center gap-1">
                                        <Input
                                            type="number"
                                            min={0}
                                            max={100}
                                            value={item.discountPercent}
                                            disabled={!onDiscountChange}
                                            onChange={(e) =>
                                                onDiscountChange?.(
                                                    item.id,
                                                    Number(e.target.value)
                                                )
                                            }
                                            className="w-14 h-7 text-center text-sm p-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-40 disabled:cursor-not-allowed"
                                        />
                                        <span className="text-xs text-muted-foreground">
                                            %
                                        </span>
                                    </div>
                                </TableCell>

                                {/* Disc Amount */}
                                <TableCell className="text-right">
                                    <span
                                        className={`tabular-nums text-sm font-medium ${item.discountAmount > 0
                                            ? "text-destructive"
                                            : "text-muted-foreground"
                                            }`}
                                    >
                                        {item.discountAmount > 0
                                            ? `-${formatCurrency(item.discountAmount)}`
                                            : formatCurrency(0)}
                                    </span>
                                </TableCell>

                                {/* Tax */}
                                <TableCell className="text-right">
                                    <div className="flex flex-col items-end">
                                        <span className="text-[11px] text-muted-foreground">
                                            {item.taxPercent}%
                                        </span>
                                        <span className="text-sm tabular-nums font-medium">
                                            {formatCurrency(item.taxAmount)}
                                        </span>
                                    </div>
                                </TableCell>

                                {/* Total */}
                                <TableCell className="text-right font-bold text-base tabular-nums">
                                    {formatCurrency(item.total)}
                                </TableCell>

                                {/* Remove */}
                                <TableCell>
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={() => onRemoveItem(item.id)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
