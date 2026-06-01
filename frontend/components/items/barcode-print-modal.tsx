"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
Printer, X, Plus, Minus, CheckSquare, Square, Search,
LayoutGrid, ScanBarcode, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import JsBarcode from "jsbarcode";
import {
DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BarcodeItem {
id: string;
sku: string;
barCode: string | null;
description: string | null;
unitPrice: number;
brand?: { name: string } | null;
category?: { name: string } | null;
}

type LabelSize = "small" | "medium" | "large";
type BarcodeType = "barcode" | "qr";

interface LabelConfig {
width: number;   // mm
height: number;  // mm
fontSize: number;
barcodeHeight: number;
cols: number;
}

const LABEL_CONFIGS: Record<LabelSize, LabelConfig> = {
small:  { width: 38,  height: 25,  fontSize: 6,  barcodeHeight: 28, cols: 4 },
medium: { width: 58,  height: 40,  fontSize: 7,  barcodeHeight: 44, cols: 3 },
large:  { width: 100, height: 60,  fontSize: 8,  barcodeHeight: 60, cols: 2 },
};

// ─── SVG Barcode renderer ─────────────────────────────────────────────────────

interface SvgBarcodeProps {
value: string;
height?: number;
className?: string;
}

function SvgBarcode({ value, height = 40, className }: SvgBarcodeProps) {
const svgRef = useRef<SVGSVGElement>(null);

useEffect(() => {
    if (svgRef.current) {
        try {
            JsBarcode(svgRef.current, value, {
                format: "CODE128",
                width: 1.5,
                height: height,
                displayValue: false,
                margin: 8, // Generates clean quiet zone (margin of 8 modules)
                background: "#ffffff",
                lineColor: "#000000",
            });
        } catch (e) {
            console.error("Barcode generation error:", e);
        }
    }
}, [value, height]);

return (
    <svg
        ref={svgRef}
        className={className}
        style={{ display: "block", maxWidth: "100%", height: "auto" }}
    />
);
}

// ─── Single Label ─────────────────────────────────────────────────────────────

interface LabelProps {
item: BarcodeItem;
qty: number;
size: LabelSize;
type: BarcodeType;
}

function ItemLabel({ item, size, type }: Omit<LabelProps, "qty">) {
const cfg = LABEL_CONFIGS[size];
// Prefer the dedicated barCode field; fall back to SKU so labels are never blank
const barcodeValue = (item.barCode?.trim() || item.sku || "").toUpperCase();
const price = Number(item.unitPrice).toLocaleString("en-US", {
    style: "currency", currency: "PKR", minimumFractionDigits: 0,
});

return (
    <div
        className="label-cell flex flex-col items-center justify-between bg-white border border-gray-300 overflow-hidden"
        style={{
            width: `${cfg.width}mm`,
            height: `${cfg.height}mm`,
            padding: "1.5mm",
            boxSizing: "border-box",
            pageBreakInside: "avoid",
            breakInside: "avoid",
        }}
    >
        {/* Description + Brand */}
        <div style={{ width: "100%", textAlign: "center" }}>
            {item.description && (
                <div style={{
                    fontSize: `${cfg.fontSize + 1}px`,
                    fontWeight: 700,
                    lineHeight: 1.15,
                    letterSpacing: "0.01em",
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                }}>
                    {item.description}
                </div>
            )}
            {item.brand?.name && (
                <div style={{ fontSize: `${cfg.fontSize - 1}px`, color: "#666", lineHeight: 1.1, marginTop: "0.5mm" }}>
                    {item.brand.name}
                </div>
            )}
        </div>

        {/* Barcode / QR */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flex: 1, width: "100%", padding: "0.5mm 0" }}>
            {barcodeValue ? (
                type === "qr" ? (
                    <QRCodeSVG
                        value={barcodeValue}
                        size={cfg.barcodeHeight * 0.7}
                        level="M"
                        style={{ display: "block" }}
                    />
                ) : (
                    <SvgBarcode value={barcodeValue} height={cfg.barcodeHeight * 0.55} />
                )
            ) : (
                <div style={{ fontSize: `${cfg.fontSize - 1}px`, color: "#999", fontStyle: "italic" }}>
                    No barcode
                </div>
            )}
        </div>

        {/* Barcode value text + Price */}
        <div style={{ width: "100%", textAlign: "center" }}>
            <div style={{ fontSize: `${cfg.fontSize - 1}px`, color: "#333", lineHeight: 1.1, fontFamily: "monospace", letterSpacing: "0.05em" }}>
                {barcodeValue || item.sku}
            </div>
            <div style={{ fontSize: `${cfg.fontSize + 2}px`, fontWeight: 700, lineHeight: 1.2, marginTop: "0.5mm" }}>
                {price}
            </div>
        </div>
    </div>
);
}

// ─── Print Styles ─────────────────────────────────────────────────────────────

const PRINT_STYLES = `
@media print {
body > *:not(#barcode-print-root) { display: none !important; }
#barcode-print-root {
    display: block !important;
    position: fixed;
    inset: 0;
    background: white;
    z-index: 99999;
    padding: 4mm;
}
#barcode-print-root .print-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 1mm;
    align-content: flex-start;
}
#barcode-print-root .label-cell {
    border: 0.3mm solid #ccc !important;
}
@page { margin: 4mm; }
}
`;

// ─── Main Modal ───────────────────────────────────────────────────────────────

interface BarcodePrintModalProps {
open: boolean;
onOpenChange: (v: boolean) => void;
items: BarcodeItem[];
}

export function BarcodePrintModal({ open, onOpenChange, items }: BarcodePrintModalProps) {
const [selected, setSelected] = useState<Set<string>>(new Set());
const [quantities, setQuantities] = useState<Record<string, number>>({});
const [labelSize, setLabelSize] = useState<LabelSize>("medium");
const [barcodeType, setBarcodeType] = useState<BarcodeType>("barcode");
const [search, setSearch] = useState("");
const printRootRef = useRef<HTMLDivElement>(null);

// Pre-select all items when modal opens
useEffect(() => {
    if (open) {
        setSelected(new Set(items.map((i) => i.id)));
        setQuantities({});
        setSearch("");
    }
}, [open, items]);

const getQty = (id: string) => quantities[id] ?? 1;

const setQty = (id: string, val: number) => {
    setQuantities((prev) => ({ ...prev, [id]: Math.max(1, Math.min(99, val)) }));
};

const toggleItem = (id: string) => {
    setSelected((prev) => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });
};

const toggleAll = () => {
    const filtered = filteredItems.map((i) => i.id);
    const allSelected = filtered.every((id) => selected.has(id));
    setSelected((prev) => {
        const next = new Set(prev);
        if (allSelected) filtered.forEach((id) => next.delete(id));
        else filtered.forEach((id) => next.add(id));
        return next;
    });
};

const filteredItems = search.trim()
    ? items.filter((i) =>
        (i.barCode ?? "").toLowerCase().includes(search.toLowerCase()) ||
        i.sku.toLowerCase().includes(search.toLowerCase()) ||
        (i.description ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (i.brand?.name ?? "").toLowerCase().includes(search.toLowerCase()),
    )
    : items;

const selectedItems = items.filter((i) => selected.has(i.id));
const totalLabels = selectedItems.reduce((s, i) => s + getQty(i.id), 0);

// Build the flat label list for printing
const labelList = selectedItems.flatMap((item) =>
    Array.from({ length: getQty(item.id) }, (_, idx) => ({ item, key: `${item.id}-${idx}` })),
);

const handlePrint = useCallback(() => {
    if (labelList.length === 0) return;

    // Inject print styles once
    const styleId = "barcode-print-styles";
    if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = PRINT_STYLES;
        document.head.appendChild(style);
    }

    // Build off-screen print root
    let root = document.getElementById("barcode-print-root");
    if (!root) {
        root = document.createElement("div");
        root.id = "barcode-print-root";
        document.body.appendChild(root);
    }

    // Render labels into the print root via innerHTML (SVG-safe)
    // We use the React-rendered preview DOM instead — clone it
    if (printRootRef.current) {
        root.innerHTML = printRootRef.current.innerHTML;
    }

    window.print();

    // Cleanup after print dialog closes
    setTimeout(() => {
        if (root) root.innerHTML = "";
    }, 1000);
}, [labelList, printRootRef]);

const allFilteredSelected = filteredItems.length > 0 && filteredItems.every((i) => selected.has(i.id));

return (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl! w-full h-[90vh] flex flex-col p-0 gap-0">
            <DialogHeader className="px-6 pt-5 pb-4 border-b shrink-0">
                <DialogTitle className="flex items-center gap-2 text-lg">
                    <ScanBarcode className="h-5 w-5 text-primary" />
                    Print Barcodes
                    {totalLabels > 0 && (
                        <Badge className="ml-1 bg-primary text-primary-foreground">
                            {totalLabels} label{totalLabels !== 1 ? "s" : ""}
                        </Badge>
                    )}
                </DialogTitle>
            </DialogHeader>

            <div className="flex flex-1 min-h-0">
                {/* ── Left panel: item selection ── */}
                <div className="w-72 shrink-0 border-r flex flex-col">
                    <div className="px-4 py-3 border-b space-y-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                placeholder="Search items..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9 h-8 text-sm"
                            />
                            {search && (
                                <button type="button" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                                    <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                                </button>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={toggleAll}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                            {allFilteredSelected
                                ? <CheckSquare className="h-3.5 w-3.5 text-primary" />
                                : <Square className="h-3.5 w-3.5" />}
                            {allFilteredSelected ? "Deselect all" : "Select all"}
                            <span className="text-muted-foreground">({filteredItems.length})</span>
                        </button>
                    </div>

                    <ScrollArea className="flex-1">
                        <div className="p-2 space-y-1">
                            {filteredItems.map((item) => {
                                const isSelected = selected.has(item.id);
                                const qty = getQty(item.id);
                                return (
                                    <div
                                        key={item.id}
                                        className={cn(
                                            "rounded-md border p-2 cursor-pointer transition-all",
                                            isSelected
                                                ? "border-primary/50 bg-primary/5"
                                                : "border-transparent hover:border-border hover:bg-muted/40",
                                        )}
                                        onClick={() => toggleItem(item.id)}
                                    >
                                        <div className="flex items-start gap-2">
                                            <div className="mt-0.5 shrink-0">
                                                {isSelected
                                                    ? <CheckSquare className="h-4 w-4 text-primary" />
                                                    : <Square className="h-4 w-4 text-muted-foreground" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs font-semibold truncate leading-tight">
                                                    {item.description ?? item.sku}
                                                </div>
                                                <div className="text-[10px] text-muted-foreground font-mono truncate">
                                                    {item.barCode ?? item.sku}
                                                </div>
                                                {item.brand?.name && (
                                                    <div className="text-[10px] text-muted-foreground truncate">{item.brand.name}</div>
                                                )}
                                            </div>
                                            {/* Qty stepper */}
                                            {isSelected && (
                                                <div
                                                    className="flex items-center gap-1 shrink-0"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <button
                                                        type="button"
                                                        className="h-5 w-5 rounded border flex items-center justify-center hover:bg-muted transition-colors"
                                                        onClick={() => setQty(item.id, qty - 1)}
                                                    >
                                                        <Minus className="h-2.5 w-2.5" />
                                                    </button>
                                                    <span className="text-xs font-mono w-5 text-center">{qty}</span>
                                                    <button
                                                        type="button"
                                                        className="h-5 w-5 rounded border flex items-center justify-center hover:bg-muted transition-colors"
                                                        onClick={() => setQty(item.id, qty + 1)}
                                                    >
                                                        <Plus className="h-2.5 w-2.5" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                            {filteredItems.length === 0 && (
                                <p className="text-xs text-muted-foreground text-center py-6">No items match your search</p>
                            )}
                        </div>
                    </ScrollArea>
                </div>

                {/* ── Right panel: preview ── */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Toolbar */}
                    <div className="px-4 py-3 border-b flex items-center gap-3 shrink-0 flex-wrap">
                        <div className="flex items-center gap-2">
                            <Label className="text-xs text-muted-foreground whitespace-nowrap">Label size</Label>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="h-8 gap-1.5 capitalize">
                                        {labelSize} <ChevronDown className="h-3.5 w-3.5" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                    {(["small", "medium", "large"] as LabelSize[]).map((s) => (
                                        <DropdownMenuItem key={s} onClick={() => setLabelSize(s)} className="capitalize">
                                            {s} — {LABEL_CONFIGS[s].width}×{LABEL_CONFIGS[s].height}mm
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>

                        <Separator orientation="vertical" className="h-5" />

                        <div className="flex items-center gap-2">
                            <Label className="text-xs text-muted-foreground whitespace-nowrap">Type</Label>
                            <div className="flex rounded-md border overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setBarcodeType("barcode")}
                                    className={cn(
                                        "px-3 py-1 text-xs flex items-center gap-1.5 transition-colors",
                                        barcodeType === "barcode" ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                                    )}
                                >
                                    <ScanBarcode className="h-3.5 w-3.5" /> Barcode
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setBarcodeType("qr")}
                                    className={cn(
                                        "px-3 py-1 text-xs flex items-center gap-1.5 transition-colors border-l",
                                        barcodeType === "qr" ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                                    )}
                                >
                                    <LayoutGrid className="h-3.5 w-3.5" /> QR Code
                                </button>
                            </div>
                        </div>

                        <div className="ml-auto text-xs text-muted-foreground">
                            {selectedItems.length} item{selectedItems.length !== 1 ? "s" : ""} · {totalLabels} label{totalLabels !== 1 ? "s" : ""}
                        </div>
                    </div>

                    {/* Preview area */}
                    <ScrollArea className="flex-1 bg-muted/30">
                        {labelList.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full min-h-64 gap-3 text-muted-foreground">
                                <ScanBarcode className="h-10 w-10 opacity-20" />
                                <p className="text-sm">Select items from the left to preview labels</p>
                            </div>
                        ) : (
                            <div className="p-4">
                                {/* Hidden print-ready DOM */}
                                <div ref={printRootRef} style={{ display: "none" }}>
                                    <div className="print-grid" style={{ display: "flex", flexWrap: "wrap", gap: "1mm" }}>
                                        {labelList.map(({ item, key }) => (
                                            <ItemLabel key={key} item={item} size={labelSize} type={barcodeType} />
                                        ))}
                                    </div>
                                </div>

                                {/* Visible preview */}
                                <div
                                    className="flex flex-wrap gap-3 justify-start"
                                    style={{ maxWidth: "100%" }}
                                >
                                    {labelList.slice(0, 50).map(({ item, key }) => (
                                        <div key={key} className="shadow-sm rounded overflow-hidden">
                                            <ItemLabel item={item} size={labelSize} type={barcodeType} />
                                        </div>
                                    ))}
                                    {labelList.length > 50 && (
                                        <div className="flex items-center justify-center w-full py-3 text-xs text-muted-foreground">
                                            + {labelList.length - 50} more labels (all will be printed)
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </ScrollArea>
                </div>
            </div>

            <DialogFooter className="px-6 py-4 border-t shrink-0 flex-row gap-2 justify-between">
                <div className="text-xs text-muted-foreground self-center">
                    Labels encode the barcode field as {barcodeType === "qr" ? "QR code" : "CODE128 barcode"}
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button
                        onClick={handlePrint}
                        disabled={totalLabels === 0}
                        className="gap-2"
                    >
                        <Printer className="h-4 w-4" />
                        Print {totalLabels > 0 ? `${totalLabels} Label${totalLabels !== 1 ? "s" : ""}` : ""}
                    </Button>
                </div>
            </DialogFooter>
        </DialogContent>
    </Dialog>
);
}
