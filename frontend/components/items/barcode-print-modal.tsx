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
    size?: { name: string } | null;
    color?: { name: string } | null;
}

type LabelSize = "small" | "compact" | "medium" | "standard" | "large";
type BarcodeType = "barcode" | "qr";

interface LabelConfig {
    name: string;
    width: number;   // mm
    height: number;  // mm
    titleSize: number; // px
    subSize: number;   // px
    barcodeHeight: number; // px
    barWidth: number;
    codeSize: number;  // px
    priceSize: number; // px
    cols: number;
}

const LABEL_CONFIGS: Record<LabelSize, LabelConfig> = {
    small: {
        name: "Zebra 2-Up Roll (35×25mm)",
        width: 35,
        height: 24,
        titleSize: 8,
        subSize: 7.5,
        barcodeHeight: 26,
        barWidth: 1.8,
        codeSize: 8.5,
        priceSize: 10.5,
        cols: 2,
    },
    compact: {
        name: "Compact (50×25mm)",
        width: 50,
        height: 24,
        titleSize: 8.5,
        subSize: 7.5,
        barcodeHeight: 24,
        barWidth: 1.5,
        codeSize: 8.5,
        priceSize: 11,
        cols: 2,
    },
    medium: {
        name: "Medium (50×30mm)",
        width: 50,
        height: 29,
        titleSize: 9.5,
        subSize: 8,
        barcodeHeight: 32,
        barWidth: 1.6,
        codeSize: 9.5,
        priceSize: 12.5,
        cols: 2,
    },
    standard: {
        name: "Standard (58×40mm)",
        width: 58,
        height: 39,
        titleSize: 11,
        subSize: 9,
        barcodeHeight: 44,
        barWidth: 1.8,
        codeSize: 10.5,
        priceSize: 14,
        cols: 1,
    },
    large: {
        name: "Large (100×60mm)",
        width: 100,
        height: 59,
        titleSize: 13,
        subSize: 10.5,
        barcodeHeight: 60,
        barWidth: 2.0,
        codeSize: 12,
        priceSize: 16.5,
        cols: 1,
    },
};

// ─── SVG Barcode renderer ─────────────────────────────────────────────────────

interface SvgBarcodeProps {
    value: string;
    height?: number;
    barWidth?: number;
    className?: string;
}

function SvgBarcode({ value, height = 22, barWidth = 1.2, className }: SvgBarcodeProps) {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (svgRef.current && value) {
            try {
                JsBarcode(svgRef.current, value, {
                    format: "CODE128",
                    width: barWidth,
                    height: height,
                    displayValue: false,
                    margin: 0,
                    marginTop: 0,
                    marginBottom: 0,
                    marginLeft: 1,
                    marginRight: 1,
                    background: "transparent",
                    lineColor: "#000000",
                });
            } catch (e) {
                console.error("Barcode generation error:", e);
            }
        }
    }, [value, height, barWidth]);

    return (
        <svg
            ref={svgRef}
            className={className}
            style={{
                display: "block",
                maxWidth: "88%",
                width: "auto",
                height: "100%",
                maxHeight: `${height}px`,
                margin: "0 auto",
            }}
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
    // Sanitize barcodeValue: printable ASCII only, no special symbols or replacement chars
    const rawBarcode = (item.barCode?.trim() || item.sku?.trim() || "").toUpperCase();
    const barcodeValue = rawBarcode.replace(/[^\x20-\x7E]/g, "");

    const price = Number(item.unitPrice).toLocaleString("en-US", {
        style: "currency", currency: "PKR", minimumFractionDigits: 0,
    });

    // Clean up description: replace corrupt unicode replacement chars / stray question marks
    const cleanDescription = (item.description || "")
        .replace(/\uFFFD/g, " - ")
        .replace(/([A-Za-z0-9])\?([A-Za-z0-9])/g, "$1 - $2")
        .replace(/([A-Za-z0-9])\s*\?\s*([A-Za-z0-9])/g, "$1 - $2")
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\u2013\u2014]/g, "-")
        .replace(/\s+/g, " ")
        .trim();

    return (
        <div
            className="label-cell flex flex-col items-center justify-between bg-white border border-gray-300 overflow-hidden text-center"
            style={{
                width: `${cfg.width}mm`,
                height: `${cfg.height}mm`,
                padding: "1mm 1.5mm",
                boxSizing: "border-box",
                pageBreakInside: "avoid",
                breakInside: "avoid",
                color: "#000000",
            }}
        >
            {/* Description + Brand/Size/Color */}
            <div style={{ width: "100%", textAlign: "center", lineHeight: 1.1 }}>
                {cleanDescription && (
                    <div style={{
                        fontSize: `${cfg.titleSize}px`,
                        fontWeight: 900,
                        lineHeight: 1.1,
                        letterSpacing: "-0.01em",
                        color: "#000000",
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        textTransform: "uppercase",
                    }}>
                        {cleanDescription}
                    </div>
                )}
                {(item.brand?.name || item.size?.name || item.color?.name) && (
                    <div style={{
                        fontSize: `${cfg.subSize}px`,
                        color: "#000000",
                        fontWeight: 900,
                        lineHeight: 1.1,
                        marginTop: "0.3mm",
                        letterSpacing: "0.01em",
                    }}>
                        {[
                            item.size?.name ?? null,
                            item.color?.name ?? null,
                        ].filter(Boolean).join(" • ")}
                    </div>
                )}
            </div>

            {/* Barcode / QR */}
            <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: 1,
                width: "100%",
                minHeight: 0,
                padding: "0.2mm 0",
            }}>
                {barcodeValue ? (
                    type === "qr" ? (
                        <QRCodeSVG
                            value={barcodeValue}
                            size={Math.min(cfg.barcodeHeight, 45)}
                            level="M"
                            style={{ display: "block", maxHeight: "100%" }}
                        />
                    ) : (
                        <SvgBarcode
                            value={barcodeValue}
                            height={cfg.barcodeHeight}
                            barWidth={cfg.barWidth}
                        />
                    )
                ) : (
                    <div style={{ fontSize: `${cfg.subSize}px`, color: "#000000", fontStyle: "italic" }}>
                        No barcode
                    </div>
                )}
            </div>

            {/* Barcode value text + Price */}
            <div style={{ width: "100%", textAlign: "center", lineHeight: 1.1 }}>
                <div style={{
                    fontSize: `${cfg.codeSize}px`,
                    color: "#000000",
                    fontWeight: 900,
                    lineHeight: 1.1,
                    fontFamily: "monospace",
                    letterSpacing: "0.08em",
                }}>
                    {barcodeValue || item.sku}
                </div>
                <div style={{
                    fontSize: `${cfg.priceSize}px`,
                    fontWeight: 900,
                    color: "#000000",
                    lineHeight: 1.1,
                    marginTop: "0.3mm",
                }}>
                    {price}
                </div>
            </div>
        </div>
    );
}

// ─── Dynamic Print Styles ──────────────────────────────────────────────────────

function getPrintStyles(columns: number, labelWidthMm: number, hGapMm: number, vGapMm: number) {
    return `
@media print {
    * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
    }
    html, body {
        overflow: visible !important;
        height: auto !important;
        min-height: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        background: white !important;
    }
    body > *:not(#barcode-print-root) {
        display: none !important;
    }
    #barcode-print-root {
        display: block !important;
        position: static !important;
        width: 100% !important;
        height: auto !important;
        min-height: auto !important;
        overflow: visible !important;
        background: white !important;
        padding: 0 !important;
        margin: 0 !important;
    }
    #barcode-print-root .print-grid {
        ${columns > 0
            ? `display: grid !important;
               grid-template-columns: repeat(${columns}, ${labelWidthMm}mm) !important;
               justify-content: start !important;
               column-gap: ${hGapMm}mm !important;
               row-gap: ${vGapMm}mm !important;
               padding-left: 2.5mm !important;
               padding-top: 1mm !important;`
            : `display: flex !important;
               flex-wrap: wrap !important;
               column-gap: ${hGapMm}mm !important;
               row-gap: ${vGapMm}mm !important;
               align-content: flex-start !important;
               padding-left: 2.5mm !important;
               padding-top: 1mm !important;`
        }
        height: auto !important;
        overflow: visible !important;
    }
    #barcode-print-root .label-cell {
        border: none !important;
        break-inside: avoid !important;
        page-break-inside: avoid !important;
    }
    @page {
        margin: 0;
        size: auto;
    }
}
`;
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

interface BarcodePrintModalProps {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    items: BarcodeItem[];
}

export function BarcodePrintModal({ open, onOpenChange, items }: BarcodePrintModalProps) {
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [quantities, setQuantities] = useState<Record<string, number>>({});
    const [labelSize, setLabelSize] = useState<LabelSize>("small");
    const [columns, setColumns] = useState<number>(2);
    const [hGap, setHGap] = useState<number>(2); // 2mm horizontal gap between 2-up stickers
    const [vGap, setVGap] = useState<number>(3); // 3mm vertical die-cut gap between rows
    const [barcodeType, setBarcodeType] = useState<BarcodeType>("barcode");
    const [showCustomSettings, setShowCustomSettings] = useState(false);
    const [search, setSearch] = useState("");
    const printRootRef = useRef<HTMLDivElement>(null);

    // Pre-select all items and ALWAYS reset to user's exact Zebra 2-up default when modal opens
    useEffect(() => {
        if (open) {
            setSelected(new Set(items.map((i) => i.id)));
            setQuantities({});
            setSearch("");
            setLabelSize("small");
            setColumns(2);
            setHGap(2);
            setVGap(3);
            setBarcodeType("barcode");
            setShowCustomSettings(false);
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
            (i.brand?.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
            (i.size?.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
            (i.color?.name ?? "").toLowerCase().includes(search.toLowerCase()),
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

        const cfg = LABEL_CONFIGS[labelSize];
        // Inject or update print styles with current column configuration & gaps
        const styleId = "barcode-print-styles";
        let style = document.getElementById(styleId) as HTMLStyleElement | null;
        if (!style) {
            style = document.createElement("style");
            style.id = styleId;
            document.head.appendChild(style);
        }
        style.textContent = getPrintStyles(columns, cfg.width, hGap, vGap);

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
    }, [labelList, printRootRef, columns, labelSize, hGap, vGap]);

    const allFilteredSelected = filteredItems.length > 0 && filteredItems.every((i) => selected.has(i.id));

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-7xl! w-full h-[90vh] flex flex-col p-0 gap-0">
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
                    <div className="shrink-0 border-r flex flex-col" style={{ width: '400px' }}>
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
                                                    <div className="text-[12px] text-muted-foreground font-mono truncate">
                                                        {item.barCode ?? item.sku}
                                                    </div>
                                                    {(item.brand?.name || item.size?.name || item.color?.name) && (
                                                        <div className="text-[12px] text-muted-foreground truncate">
                                                            {[
                                                                item.size?.name ? `${item.size.name}` : null,
                                                                item.color?.name ? `${item.color.name}` : null,
                                                            ].filter(Boolean).join(" • ")}
                                                        </div>
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
                        <div className="px-4 py-2.5 border-b flex items-center justify-between shrink-0 bg-background gap-3">
                            <div className="flex items-center gap-2.5 flex-wrap">
                                {/* Default Status Badge */}
                                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 border border-primary/20 rounded-md text-xs font-medium text-primary">
                                    <ScanBarcode className="h-3.5 w-3.5" />
                                    <span>Zebra GK420t: 2-Up Roll (38×25mm)</span>
                                </div>

                                <div className="flex items-center gap-1.5">
                                    <div className="flex rounded-md border overflow-hidden">
                                        <button
                                            type="button"
                                            onClick={() => setBarcodeType("barcode")}
                                            className={cn(
                                                "px-2.5 py-1 text-xs flex items-center gap-1 transition-colors",
                                                barcodeType === "barcode" ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                                            )}
                                        >
                                            Barcode
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setBarcodeType("qr")}
                                            className={cn(
                                                "px-2.5 py-1 text-xs flex items-center gap-1 transition-colors border-l",
                                                barcodeType === "qr" ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                                            )}
                                        >
                                            QR
                                        </button>
                                    </div>
                                </div>

                                {/* Custom settings toggle */}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setShowCustomSettings(!showCustomSettings)}
                                    className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1 px-2"
                                >
                                    {showCustomSettings ? "Hide Options" : "Adjust Size/Spacing"}
                                </Button>
                            </div>

                            <div className="text-xs text-muted-foreground whitespace-nowrap">
                                {selectedItems.length} items · {totalLabels} stickers
                            </div>
                        </div>

                        {/* Collapsible custom settings */}
                        {showCustomSettings && (
                            <div className="px-4 py-2 border-b bg-muted/20 flex items-center gap-3 shrink-0 flex-wrap text-xs">
                                <div className="flex items-center gap-1.5">
                                    <Label className="text-xs text-muted-foreground">Size</Label>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 capitalize">
                                                {LABEL_CONFIGS[labelSize]?.name ?? labelSize} <ChevronDown className="h-3 w-3" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="start">
                                            {(Object.keys(LABEL_CONFIGS) as LabelSize[]).map((s) => (
                                                <DropdownMenuItem
                                                    key={s}
                                                    onClick={() => {
                                                        setLabelSize(s);
                                                        setColumns(LABEL_CONFIGS[s].cols);
                                                    }}
                                                >
                                                    {LABEL_CONFIGS[s].name}
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                <div className="flex items-center gap-1.5">
                                    <Label className="text-xs text-muted-foreground">Columns</Label>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 min-w-[70px] justify-between">
                                                <span>{columns === 0 ? "Auto" : `${columns} Col${columns > 1 ? "s" : ""}`}</span>
                                                <ChevronDown className="h-3 w-3 opacity-60" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="start">
                                            <DropdownMenuItem onClick={() => setColumns(0)}>
                                                Auto (Fit page width)
                                            </DropdownMenuItem>
                                            {[1, 2, 3, 4, 5, 6].map((c) => (
                                                <DropdownMenuItem key={c} onClick={() => setColumns(c)}>
                                                    {c} {c === 1 ? "Column (1-up roll)" : c === 2 ? "Columns (2-up roll)" : c === 3 ? "Columns (3-up roll)" : "Columns (Sheet / A4)"}
                                                </DropdownMenuItem>
                                            ))}
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>

                                <div className="flex items-center gap-1">
                                    <Label className="text-xs text-muted-foreground" title="Horizontal space between sticker columns">Col Gap</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        max={20}
                                        step={0.5}
                                        value={hGap}
                                        onChange={(e) => setHGap(Math.max(0, parseFloat(e.target.value) || 0))}
                                        className="h-7 w-12 px-1 text-xs text-center font-mono"
                                    />
                                    <span className="text-[10px] text-muted-foreground">mm</span>
                                </div>

                                <div className="flex items-center gap-1">
                                    <Label className="text-xs text-muted-foreground" title="Vertical space between sticker rows (Zebra web gap)">Row Gap</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        max={20}
                                        step={0.5}
                                        value={vGap}
                                        onChange={(e) => setVGap(Math.max(0, parseFloat(e.target.value) || 0))}
                                        className="h-7 w-12 px-1 text-xs text-center font-mono"
                                    />
                                    <span className="text-[10px] text-muted-foreground">mm</span>
                                </div>

                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setLabelSize("small");
                                        setColumns(2);
                                        setHGap(2);
                                        setVGap(3);
                                    }}
                                    className="h-7 text-xs text-primary hover:underline ml-auto"
                                >
                                    Reset to Zebra Default
                                </Button>
                            </div>
                        )}

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
                                        <div
                                            className="print-grid"
                                            style={
                                                columns > 0
                                                    ? {
                                                        display: "grid",
                                                        gridTemplateColumns: `repeat(${columns}, ${LABEL_CONFIGS[labelSize].width}mm)`,
                                                        justifyContent: "start",
                                                        columnGap: `${hGap}mm`,
                                                        rowGap: `${vGap}mm`,
                                                        paddingLeft: "2.5mm",
                                                        paddingTop: "1mm",
                                                    }
                                                    : {
                                                        display: "flex",
                                                        flexWrap: "wrap",
                                                        columnGap: `${hGap}mm`,
                                                        rowGap: `${vGap}mm`,
                                                        alignContent: "flex-start",
                                                        paddingLeft: "2.5mm",
                                                        paddingTop: "1mm",
                                                    }
                                            }
                                        >
                                            {labelList.map(({ item, key }) => (
                                                <ItemLabel key={key} item={item} size={labelSize} type={barcodeType} />
                                            ))}
                                        </div>
                                    </div>

                                    {/* Visible preview */}
                                    <div
                                        className="p-4"
                                        style={{
                                            display: columns > 0 ? "grid" : "flex",
                                            gridTemplateColumns: columns > 0 ? `repeat(${columns}, ${LABEL_CONFIGS[labelSize].width}mm)` : undefined,
                                            flexWrap: columns === 0 ? "wrap" : undefined,
                                            columnGap: `${Math.max(hGap * 3.78, 6)}px`,
                                            rowGap: `${Math.max(vGap * 3.78, 6)}px`,
                                            maxWidth: "100%",
                                            overflowX: "auto",
                                            alignItems: "start",
                                        }}
                                    >
                                        {labelList.slice(0, 50).map(({ item, key }) => (
                                            <div key={key} className="shadow-sm rounded overflow-hidden">
                                                <ItemLabel item={item} size={labelSize} type={barcodeType} />
                                            </div>
                                        ))}
                                        {labelList.length > 50 && (
                                            <div className="flex items-center justify-center w-full py-3 text-xs text-muted-foreground col-span-full">
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
                        <span className="font-medium text-foreground">Zebra GK420t:</span> Set Margins to <span className="font-semibold text-foreground">None</span> in browser print dialog and match label roll size.
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
