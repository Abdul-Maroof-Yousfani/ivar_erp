"use client";

import React, { useEffect, useState, useTransition, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import {
    getStockTransactionDetailReport,
    queueStockTransactionDetailReportExport,
    getStockTransactionDetailReportExportStatus
} from "@/lib/actions/stock-ledger";
import { getLocations, Location } from "@/lib/actions/location";
import { getWarehouses, Warehouse } from "@/lib/actions/warehouse";
import { MultiSelect, MultiSelectOption } from "@/components/ui/multi-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DateRangePicker, DateRange } from "@/components/ui/date-range-picker";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
    Download,
    Printer,
    Loader2,
    Calendar,
    ArrowUpRight,
    TrendingUp,
    Store,
    Layers,
    ShoppingCart,
    Inbox,
    Folder,
    Settings,
    Clock,
    Link as LinkIcon
} from "lucide-react";
import { toast } from "sonner";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { cn, COMPANY_NAME, getApiBaseUrl } from "@/lib/utils";
import Link from "next/link";

// ─── Highlight helper ──────────────────────────────────────────────────────────
function highlight(text: string, query: string) {
    if (!query.trim()) return <>{text}</>;
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return <>{text}</>;
    return (
        <>
            {text.slice(0, idx)}
            <mark className="bg-amber-200 dark:bg-amber-700/60 text-inherit rounded-sm px-0.5">{text.slice(idx, idx + query.length)}</mark>
            {text.slice(idx + query.length)}
        </>
    );
}

// ─── Autocomplete multi-select ─────────────────────────────────────────────────
function AutocompleteMultiSelect({
    label, options, selected, onToggle, searchable = true,
}: {
    label: string;
    options: string[];
    selected: Set<string>;
    onToggle: (val: string) => void;
    searchable?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const filtered = useMemo(() =>
        options.filter(o => o.toLowerCase().includes(search.toLowerCase())),
        [options, search]
    );

    const selectedCount = selected.size;

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={() => setOpen(o => !o)}
                className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all",
                    selectedCount > 0
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                )}
            >
                <span>{label}</span>
                {selectedCount > 0 && (
                    <span className="bg-white/20 text-inherit px-1.5 py-0.5 rounded-full text-[10px] font-bold leading-none">{selectedCount}</span>
                )}
                <svg className={cn("h-3 w-3 transition-transform", open && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {open && (
                <div className="absolute z-50 top-full mt-1.5 left-0 min-w-[200px] max-w-[280px] bg-background border border-border rounded-xl shadow-xl overflow-hidden">
                    {searchable && (
                        <div className="p-2 border-b border-border">
                            <input
                                autoFocus
                                type="text"
                                placeholder={`Search ${label}...`}
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-border bg-muted/40 outline-none focus:border-primary"
                            />
                        </div>
                    )}
                    <div className="max-h-56 overflow-y-auto py-1">
                        {filtered.length === 0 && (
                            <p className="text-xs text-muted-foreground px-3 py-2 text-center">No results</p>
                        )}
                        {filtered.map(opt => (
                            <label
                                key={opt}
                                className="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer hover:bg-muted/60 transition-colors"
                            >
                                <input
                                    type="checkbox"
                                    checked={selected.has(opt)}
                                    onChange={() => onToggle(opt)}
                                    className="h-3.5 w-3.5 accent-primary cursor-pointer"
                                />
                                <span className="text-xs font-medium text-foreground">
                                    {highlight(opt, search)}
                                </span>
                            </label>
                        ))}
                    </div>
                    {selectedCount > 0 && (
                        <div className="px-3 py-2 border-t border-border">
                            <button
                                type="button"
                                onClick={() => filtered.forEach(o => selected.has(o) && onToggle(o))}
                                className="text-[11px] text-muted-foreground hover:text-destructive font-semibold transition-colors"
                            >
                                Clear all
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function ErpStockTransactionDetailReportPage() {
    const { user } = useAuth();

    // Outlets & Warehouses lists & selected states
    const [locations, setLocations] = useState<Location[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
    const [selectedWarehouseIds, setSelectedWarehouseIds] = useState<string[]>([]);

    const [dateRange, setDateRange] = useState<DateRange>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
    });

    const [groupingLevels, setGroupingLevels] = useState({
        brand: true,
        division: true,
        category: true,
        gender: true,
        silhouette: true,
        article: true,
        variant: false,
    });

    const [reportData, setReportData] = useState<any[]>([]);
    const [grandTotals, setGrandTotals] = useState({ openingBalance: 0, closingBalance: 0, inTransitQty: 0 });
    const [isPending, startTransition] = useTransition();

    // Excel Export Queue States
    const [exportJobId, setExportJobId] = useState<string | null>(null);
    const [exportState, setExportState] = useState<"idle" | "queueing" | "processing" | "completed" | "failed">("idle");
    const [exportProgress, setExportProgress] = useState<number>(0);

    // PDF Export Queue States
    const [pdfJobId, setPdfJobId] = useState<string | null>(null);
    const [pdfExportState, setPdfExportState] = useState<"idle" | "queueing" | "processing" | "completed" | "failed">("idle");
    const [pdfExportProgress, setPdfExportProgress] = useState<number>(0);

    const showVariant = groupingLevels.variant;

    // Frontend filters
    const [searchText, setSearchText] = useState("");
    const [filterBrands, setFilterBrands] = useState<Set<string>>(new Set());
    const [filterDivisions, setFilterDivisions] = useState<Set<string>>(new Set());
    const [filterGenders, setFilterGenders] = useState<Set<string>>(new Set());
    const [filterSilhouettes, setFilterSilhouettes] = useState<Set<string>>(new Set());
    const [filterCategories, setFilterCategories] = useState<Set<string>>(new Set());

    // Load locations and warehouses lists
    useEffect(() => {
        async function fetchLocationsList() {
            try {
                const data = await getLocations();
                if (Array.isArray(data)) {
                    setLocations(data);
                }
            } catch (err) {
                console.error("Error fetching locations:", err);
            }
        }
        fetchLocationsList();
    }, []);

    useEffect(() => {
        async function fetchWarehousesList() {
            try {
                const data = await getWarehouses();
                if (Array.isArray(data)) {
                    setWarehouses(data);
                }
            } catch (err) {
                console.error("Error fetching warehouses:", err);
            }
        }
        fetchWarehousesList();
    }, []);

    const toggleFilter = (setter: React.Dispatch<React.SetStateAction<Set<string>>>, val: string) => {
        setter(prev => {
            const next = new Set(prev);
            if (next.has(val)) next.delete(val); else next.add(val);
            return next;
        });
    };

    const hasActiveFilters =
        searchText.trim() !== "" ||
        filterBrands.size > 0 ||
        filterDivisions.size > 0 ||
        filterGenders.size > 0 ||
        filterSilhouettes.size > 0 ||
        filterCategories.size > 0;

    const clearAllFilters = () => {
        setSearchText("");
        setFilterBrands(new Set());
        setFilterDivisions(new Set());
        setFilterGenders(new Set());
        setFilterSilhouettes(new Set());
        setFilterCategories(new Set());
    };

    // Format options for MultiSelect
    const locationOptions: MultiSelectOption[] = useMemo(() => {
        return locations.map((loc) => ({
            value: loc.id,
            label: loc.name,
            description: loc.code ? `Code: ${loc.code}` : undefined,
        }));
    }, [locations]);

    const warehouseOptions: MultiSelectOption[] = useMemo(() => {
        return warehouses.map((wh) => ({
            value: wh.id,
            label: wh.name,
            description: wh.code ? `Code: ${wh.code}` : undefined,
        }));
    }, [warehouses]);

    const locationParam = useMemo(() => {
        return selectedLocationIds.length > 0 ? selectedLocationIds.join(",") : undefined;
    }, [selectedLocationIds]);

    const warehouseParam = useMemo(() => {
        return selectedWarehouseIds.length > 0 ? selectedWarehouseIds.join(",") : undefined;
    }, [selectedWarehouseIds]);

    const fetchReport = useCallback(() => {
        if (!dateRange.from || !dateRange.to) return;
        startTransition(async () => {
            const result = await getStockTransactionDetailReport({
                locationId: locationParam,
                warehouseId: warehouseParam,
                startDate: dateRange.from?.toISOString(),
                endDate: dateRange.to?.toISOString(),
                showBrand: groupingLevels.brand,
                showDivision: groupingLevels.division,
                showCategory: groupingLevels.category,
                showGender: groupingLevels.gender,
                showSilhouette: groupingLevels.silhouette,
                showArticle: groupingLevels.article,
                showVariant: groupingLevels.variant,
            });
            if (result && result.status !== false) {
                setReportData(result.data?.root || []);
                setGrandTotals(result.data?.grandTotals || { openingBalance: 0, closingBalance: 0, inTransitQty: 0 });
            } else {
                toast.error("Failed to load report data");
            }
        });
    }, [locationParam, warehouseParam, dateRange, groupingLevels]);

    useEffect(() => {
        fetchReport();
    }, [locationParam, warehouseParam, groupingLevels]);

    // Poll Excel Job Status
    useEffect(() => {
        if (exportState !== "queueing" && exportState !== "processing") return;
        if (!exportJobId) return;

        const interval = setInterval(async () => {
            try {
                const res = await getStockTransactionDetailReportExportStatus(exportJobId);
                if (res && res.status) {
                    const { state, progress } = res.data || {};
                    setExportProgress(progress || 0);

                    if (state === "completed") {
                        setExportState("completed");
                        toast.success("Excel Export processed successfully! Ready to download.");
                        clearInterval(interval);
                    } else if (state === "failed") {
                        setExportState("failed");
                        toast.error("Background Excel export processing failed.");
                        clearInterval(interval);
                    } else {
                        setExportState("processing");
                    }
                }
            } catch (err) {
                console.error("Error polling job status:", err);
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [exportState, exportJobId]);

    // Poll PDF Job Status
    useEffect(() => {
        if (pdfExportState !== "queueing" && pdfExportState !== "processing") return;
        if (!pdfJobId) return;

        const interval = setInterval(async () => {
            try {
                const res = await getStockTransactionDetailReportExportStatus(pdfJobId);
                if (res && res.status) {
                    const { state, progress } = res.data || {};
                    setPdfExportProgress(progress || 0);

                    if (state === "completed") {
                        setPdfExportState("completed");
                        toast.success("PDF Report generated successfully! Ready to download.");
                        clearInterval(interval);
                    } else if (state === "failed") {
                        setPdfExportState("failed");
                        toast.error("Background PDF generation failed.");
                        clearInterval(interval);
                    } else {
                        setPdfExportState("processing");
                    }
                }
            } catch (err) {
                console.error("Error polling PDF job status:", err);
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [pdfExportState, pdfJobId]);

    const handleExportExcelClick = async () => {
        if (!dateRange.from || !dateRange.to) return;

        if (exportState === "completed" && exportJobId) {
            const base = getApiBaseUrl();
            const url = `${base}/stock-ledger/transaction-detail-report/export/${exportJobId}/download`;
            window.open(url, "_blank");
            
            // Reset
            setExportState("idle");
            setExportJobId(null);
            setExportProgress(0);
            return;
        }

        setExportState("queueing");
        try {
            const res = await queueStockTransactionDetailReportExport({
                locationId: locationParam,
                warehouseId: warehouseParam,
                startDate: dateRange.from.toISOString(),
                endDate: dateRange.to.toISOString(),
                format: "xlsx",
                showBrand: groupingLevels.brand,
                showDivision: groupingLevels.division,
                showCategory: groupingLevels.category,
                showGender: groupingLevels.gender,
                showSilhouette: groupingLevels.silhouette,
                showArticle: groupingLevels.article,
                showVariant: groupingLevels.variant,
            });

            if (res && res.status && res.data?.jobId) {
                setExportJobId(res.data.jobId);
                setExportState("processing");
                setExportProgress(5);
                toast.info("Background Excel generation queued.");
            } else {
                setExportState("failed");
                toast.error(res.message || "Failed to queue export job.");
            }
        } catch (err) {
            setExportState("failed");
            console.error(err);
            toast.error("Failed to queue export job.");
        }
    };

    const handleExportPdfClick = async () => {
        if (!dateRange.from || !dateRange.to) return;

        if (pdfExportState === "completed" && pdfJobId) {
            const base = getApiBaseUrl();
            const url = `${base}/stock-ledger/transaction-detail-report/export/${pdfJobId}/download`;
            window.open(url, "_blank");
            
            // Reset
            setPdfExportState("idle");
            setPdfJobId(null);
            setPdfExportProgress(0);
            return;
        }

        setPdfExportState("queueing");
        try {
            const res = await queueStockTransactionDetailReportExport({
                locationId: locationParam,
                warehouseId: warehouseParam,
                startDate: dateRange.from.toISOString(),
                endDate: dateRange.to.toISOString(),
                format: "pdf",
                showBrand: groupingLevels.brand,
                showDivision: groupingLevels.division,
                showCategory: groupingLevels.category,
                showGender: groupingLevels.gender,
                showSilhouette: groupingLevels.silhouette,
                showArticle: groupingLevels.article,
                showVariant: groupingLevels.variant,
            });

            if (res && res.status && res.data?.jobId) {
                setPdfJobId(res.data.jobId);
                setPdfExportState("processing");
                setPdfExportProgress(5);
                toast.info("Background PDF generation queued.");
            } else {
                setPdfExportState("failed");
                toast.error(res.message || "Failed to queue export job.");
            }
        } catch (err) {
            setPdfExportState("failed");
            console.error(err);
            toast.error("Failed to queue export job.");
        }
    };

    // Extract unique filters
    const filterOptions = useMemo(() => {
        const brands = new Set<string>();
        const divisions = new Set<string>();
        const genders = new Set<string>();
        const silhouettes = new Set<string>();
        const categories = new Set<string>();

        const walk = (node: any) => {
            if (!node) return;
            if (node.level === 'brand') brands.add(node.value);
            if (node.level === 'division') divisions.add(node.value);
            if (node.level === 'gender') genders.add(node.value);
            if (node.level === 'silhouette') silhouettes.add(node.value);
            if (node.level === 'category') categories.add(node.value);
            if (node.children) node.children.forEach(walk);
        };
        reportData.forEach(walk);

        return {
            brands: [...brands].sort(),
            divisions: [...divisions].sort(),
            genders: [...genders].sort(),
            silhouettes: [...silhouettes].sort(),
            categories: [...categories].sort(),
        };
    }, [reportData]);

    // Flatten nested tree for virtualization
    const flatRows = useMemo(() => {
        const rows: any[] = [];
        
        const visit = (
            node: any, 
            path: string = "", 
            ancestorBrand = "", 
            ancestorDivision = "", 
            ancestorGender = "", 
            ancestorSilhouette = "", 
            ancestorCategory = "",
            ancestorSku = "",
            ancestorArticleName = ""
        ) => {
            if (!node) return;
            const currentPath = path ? `${path}-${node.level}-${node.value}` : `${node.level}-${node.value}`;
            
            const brand = node.level === 'brand' ? node.value : ancestorBrand;
            const division = node.level === 'division' ? node.value : ancestorDivision;
            const gender = node.level === 'gender' ? node.value : ancestorGender;
            const silhouette = node.level === 'silhouette' ? node.value : ancestorSilhouette;
            const category = node.level === 'category' ? node.value : ancestorCategory;
            const sku = node.level === 'article' ? node.sku : ancestorSku;
            const articleName = node.level === 'article' ? node.articleName : ancestorArticleName;

            const isLeaf = !node.children || node.children.length === 0;

            if (!isLeaf) {
                rows.push({
                    id: `${node.level}-${currentPath}`,
                    type: node.level,
                    label: node.level === 'article' ? node.articleName : node.value.toUpperCase(),
                    sku: node.sku,
                    color: node.color,
                    size: node.size,
                    totals: node.totals,
                    brand, division, gender, silhouette, category,
                });
            }

            if (node.transactions) {
                // 1. Product header row (GPC, Category, SKU, Product Name, Size, Color)
                rows.push({
                    id: `ph-${currentPath}`,
                    type: 'product-header',
                    sku: sku,
                    brand, division, gender, silhouette, category,
                });

                // 2. Product data values row
                rows.push({
                    id: `pd-${currentPath}`,
                    type: 'product-data',
                    label: articleName,
                    sku: sku,
                    color: node.color,
                    size: node.size,
                    brand, division, gender, silhouette, category,
                });

                // 3. Ledger columns header
                rows.push({
                    id: `hdr-${currentPath}`,
                    type: 'ledger-header',
                    sku: sku,
                    brand, division, gender, silhouette, category,
                });

                // 4. Opening balance row
                rows.push({
                    id: `op-${currentPath}`,
                    type: 'opening-balance',
                    date: dateRange.from,
                    balance: node.openingBalance,
                    sku: sku,
                    brand, division, gender, silhouette, category,
                });

                // 5. Ledger transactions
                for (const t of node.transactions) {
                    rows.push({
                        id: `tx-${t.id}`,
                        type: 'transaction',
                        txId: t.id,
                        date: t.date,
                        docType: t.docType,
                        docRef: t.docRef,
                        docRefId: t.docRefId,
                        remarks: t.remarks,
                        inQty: t.inQty,
                        outQty: t.outQty,
                        balance: t.balance,
                        isInTransit: t.isInTransit,
                        sku: sku,
                        brand, division, gender, silhouette, category,
                    });
                }

                // 6. Closing balance row
                rows.push({
                    id: `cl-${currentPath}`,
                    type: 'closing-balance',
                    date: dateRange.to,
                    balance: node.closingBalance,
                    sku: sku,
                    brand, division, gender, silhouette, category,
                });

                // 7. Divider/Spacer row
                rows.push({
                    id: `div-${currentPath}`,
                    type: 'divider',
                    sku: sku,
                    brand, division, gender, silhouette, category,
                });
            }
            
            if (node.children && node.children.length > 0) {
                for (const child of node.children) {
                    visit(child, currentPath, brand, division, gender, silhouette, category, sku, articleName);
                }
            }
        };

        for (const rootNode of reportData) {
            visit(rootNode);
        }
        
        return rows;
    }, [reportData, dateRange]);

    // Apply frontend filters
    const filteredRows = useMemo(() => {
        if (!hasActiveFilters) return flatRows;

        const q = searchText.trim().toLowerCase();

        // 1. Gather all matching SKUs
        const matchingSkus = new Set<string>();
        for (const row of flatRows) {
            if (row.type !== 'product-data') continue;
            const textMatch = !q || (row.label || "").toLowerCase().includes(q) || (row.sku || "").toLowerCase().includes(q);
            const brandMatch = filterBrands.size === 0 || filterBrands.has(row.brand);
            const divMatch = filterDivisions.size === 0 || filterDivisions.has(row.division);
            const genderMatch = filterGenders.size === 0 || filterGenders.has(row.gender);
            const silMatch = filterSilhouettes.size === 0 || filterSilhouettes.has(row.silhouette);
            const catMatch = filterCategories.size === 0 || filterCategories.has(row.category);
            if (textMatch && brandMatch && divMatch && genderMatch && silMatch && catMatch) {
                matchingSkus.add(row.sku);
            }
        }

        // 2. Filter rows, retaining group and detail rows matching these SKUs
        const result: any[] = [];
        for (const row of flatRows) {
            if (row.sku) {
                if (matchingSkus.has(row.sku)) {
                    result.push(row);
                }
            } else {
                result.push({ ...row, _pendingGroup: true });
            }
        }

        // 3. Strip structural group headers that don't precede any matching article
        const final: any[] = [];
        for (let i = 0; i < result.length; i++) {
            if (!result[i]._pendingGroup) { final.push(result[i]); continue; }
            let hasDescendants = false;
            for (let j = i + 1; j < result.length; j++) {
                if (!result[j]._pendingGroup) { hasDescendants = true; break; }
            }
            if (hasDescendants) final.push(result[i]);
        }

        return final;
    }, [flatRows, hasActiveFilters, searchText, filterBrands, filterDivisions, filterGenders, filterSilhouettes, filterCategories]);

    const handleToggleLevel = (level: keyof typeof groupingLevels, checked: boolean) => {
        setGroupingLevels(prev => {
            const next = { ...prev, [level]: checked };
            if (level === 'division' && checked) next.brand = true;
            if (level === 'brand' && !checked) next.division = false;
            return next;
        });
    };

    // TanStack Virtualizer
    const parentRef = useRef<HTMLDivElement>(null);
    const rowVirtualizer = useVirtualizer({
        count: filteredRows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 40,
        overscan: 12,
    });

    const virtualItems = rowVirtualizer.getVirtualItems();
    const totalSize = rowVirtualizer.getTotalSize();
    const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
    const paddingBottom = virtualItems.length > 0 ? totalSize - virtualItems[virtualItems.length - 1].end : 0;

    const getExportButtonText = () => {
        switch (exportState) {
            case "queueing": return "Queueing...";
            case "processing": return `Generating ${exportProgress}%`;
            case "completed": return "Download Excel";
            case "failed": return "Retry Excel Export";
            case "idle":
            default: return "Export Excel";
        }
    };

    const getPdfButtonText = () => {
        switch (pdfExportState) {
            case "queueing": return "Queueing...";
            case "processing": return `Generating ${pdfExportProgress}%`;
            case "completed": return "Download PDF";
            case "failed": return "Retry PDF Export";
            case "idle":
            default: return "Export PDF";
        }
    };

    const formatQty = (val: number) => val === 0 ? "-" : val.toLocaleString();

    // Helper to generate routing links based on transaction type
    const getDocLink = (type: string, refId: string) => {
        if (!refId) return null;
        if (['Transfer In', 'Transfer Out', 'Transfer In (Transit)'].includes(type)) {
            return `/pos/inventory/ledger?id=${refId}`;
        }
        if (['Sale Retail', 'Sale exchanges', 'Sale Void'].includes(type)) {
            return `/pos/sales?id=${refId}`;
        }
        if (type === 'Claims') {
            return `/pos/claims?id=${refId}`;
        }
        if (type === 'Adjustment') {
            return `/pos/inventory/adjustments?id=${refId}`;
        }
        return null;
    };

    // Get selected location names for display
    const activeSelectionNames = useMemo(() => {
        const list: string[] = [];
        if (selectedWarehouseIds.length > 0) {
            const names = warehouses.filter(w => selectedWarehouseIds.includes(w.id)).map(w => w.name);
            list.push(`Warehouses: ${names.join(", ")}`);
        }
        if (selectedLocationIds.length > 0) {
            const names = locations.filter(l => selectedLocationIds.includes(l.id)).map(l => l.name);
            list.push(`Outlets: ${names.join(", ")}`);
        }
        return list.length > 0 ? list.join(" | ") : "All Warehouses & Outlets";
    }, [selectedLocationIds, selectedWarehouseIds, locations, warehouses]);

    return (
        <div className="p-6 space-y-6 max-w-[1800px] mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5 no-print">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2 text-slate-850 dark:text-slate-100">
                        <Clock className="h-8 w-8 text-primary" />
                        Stock Transaction Details (ERP)
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5 font-medium">
                        <Store className="h-4 w-4 text-primary/70" />
                        ERP historical card ledger for: <span className="text-foreground font-semibold">{activeSelectionNames}</span>
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button
                        variant={pdfExportState === "completed" ? "default" : "outline"}
                        onClick={handleExportPdfClick}
                        disabled={(pdfExportState === "queueing" || pdfExportState === "processing") || reportData.length === 0}
                        className={cn(
                            "gap-2 font-semibold transition-all",
                            pdfExportState === "completed"
                                ? "bg-red-650 text-white hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 border-none"
                                : "border-red-500/40 text-red-750 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                        )}
                    >
                        {pdfExportState === "queueing" || pdfExportState === "processing" ? (
                            <Loader2 className="h-4 w-4 animate-spin text-red-600" />
                        ) : (
                            <Printer className="h-4 w-4" />
                        )}
                        {getPdfButtonText()}
                    </Button>
                    <Button
                        variant={exportState === "completed" ? "default" : "outline"}
                        onClick={handleExportExcelClick}
                        disabled={(exportState === "queueing" || exportState === "processing") || reportData.length === 0}
                        className={cn(
                            "gap-2 font-semibold transition-all",
                            exportState === "completed"
                                ? "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 border-none"
                                : "border-emerald-500/40 text-emerald-750 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                        )}
                    >
                        {exportState === "queueing" || exportState === "processing" ? (
                            <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                        ) : (
                            <Download className="h-4 w-4" />
                        )}
                        {getExportButtonText()}
                    </Button>
                </div>
            </div>

            {/* Print Header */}
            <div className="hidden print:block mb-6 border-b pb-4">
                <h1 className="text-2xl font-bold text-center text-slate-900">Stock Transaction Detail Report</h1>
                <p className="text-sm text-center text-slate-600 mt-1">Filters: {activeSelectionNames}</p>
                <p className="text-xs text-center text-slate-500">
                    Period: {dateRange.from ? format(dateRange.from, "dd MMM yyyy") : ""} to{" "}
                    {dateRange.to ? format(dateRange.to, "dd MMM yyyy") : ""}
                </p>
            </div>

            {/* Filters Row */}
            <div className="flex flex-col gap-4 bg-slate-50 dark:bg-slate-900/40 border p-5 rounded-xl shadow-sm no-print">
                <div className="flex flex-wrap items-end gap-4">
                    {/* Warehouse Selector */}
                    <div className="flex flex-col gap-1.5 min-w-[240px]">
                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 leading-none">
                            <Layers className="h-3.5 w-3.5 text-primary" />
                            Select Warehouses
                        </span>
                        <MultiSelect
                            options={warehouseOptions}
                            value={selectedWarehouseIds}
                            onValueChange={setSelectedWarehouseIds}
                            placeholder="All Warehouses"
                            className="bg-background"
                        />
                    </div>

                    {/* Location selector */}
                    <div className="flex flex-col gap-1.5 min-w-[240px]">
                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 leading-none">
                            <Store className="h-3.5 w-3.5 text-primary" />
                            Select Outlets / Stores
                        </span>
                        <MultiSelect
                            options={locationOptions}
                            value={selectedLocationIds}
                            onValueChange={setSelectedLocationIds}
                            placeholder="All Outlets"
                            className="bg-background"
                        />
                    </div>

                    {/* Date period picker */}
                    <div className="flex flex-col gap-1.5">
                        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 leading-none">
                            <Calendar className="h-3.5 w-3.5 text-primary" />
                            Date Period
                        </span>
                        <DateRangePicker
                            initialDateFrom={dateRange.from}
                            initialDateTo={dateRange.to}
                            onUpdate={({ range }: { range: DateRange }) => {
                                if (range) setDateRange(range);
                            }}
                        />
                    </div>

                    <Button
                        onClick={fetchReport}
                        disabled={isPending}
                        className="font-bold h-10 px-5"
                    >
                        {isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                        ) : null}
                        Apply / Refresh
                    </Button>
                </div>
            </div>

            {/* Search & Autocomplete panel */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs space-y-3 no-print">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative flex-1 min-w-[200px] max-w-xs">
                        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"/></svg>
                        <input
                            type="text"
                            placeholder="Search article name or SKU..."
                            value={searchText}
                            onChange={e => setSearchText(e.target.value)}
                            className="w-full text-xs pl-7 pr-3 py-1.5 rounded-lg border border-border bg-muted/30 outline-none focus:border-primary transition-colors"
                        />
                        {searchText && (
                            <button onClick={() => setSearchText("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                            </button>
                        )}
                    </div>

                    <div className="h-5 w-px bg-border hidden sm:block" />

                    {filterOptions.brands.length > 0 && (
                        <AutocompleteMultiSelect
                            label="Brand"
                            options={filterOptions.brands}
                            selected={filterBrands}
                            onToggle={v => toggleFilter(setFilterBrands, v)}
                        />
                    )}
                    {filterOptions.divisions.length > 0 && (
                        <AutocompleteMultiSelect
                            label="Division"
                            options={filterOptions.divisions}
                            selected={filterDivisions}
                            onToggle={v => toggleFilter(setFilterDivisions, v)}
                        />
                    )}
                    {filterOptions.genders.length > 0 && (
                        <AutocompleteMultiSelect
                            label="Gender"
                            options={filterOptions.genders}
                            selected={filterGenders}
                            onToggle={v => toggleFilter(setFilterGenders, v)}
                        />
                    )}
                    {filterOptions.silhouettes.length > 0 && (
                        <AutocompleteMultiSelect
                            label="Silhouette"
                            options={filterOptions.silhouettes}
                            selected={filterSilhouettes}
                            onToggle={v => toggleFilter(setFilterSilhouettes, v)}
                        />
                    )}
                    {filterOptions.categories.length > 0 && (
                        <AutocompleteMultiSelect
                            label="Category"
                            options={filterOptions.categories}
                            selected={filterCategories}
                            onToggle={v => toggleFilter(setFilterCategories, v)}
                        />
                    )}

                    {hasActiveFilters && (
                        <button
                            onClick={clearAllFilters}
                            className="flex items-center gap-1 text-[11px] font-bold text-destructive hover:text-destructive/80 transition-colors"
                        >
                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                            Clear Filters
                        </button>
                    )}

                    <div className="ml-auto text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                        {hasActiveFilters ? (
                            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                {filteredRows.filter(r => r.type === 'article').length} articles filtered
                            </span>
                        ) : (
                            <span>{flatRows.filter(r => r.type === 'article').length} articles loaded</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Hierarchy configuration */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4 no-print">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <Settings className="h-4 w-4 text-primary" />
                            Report Hierarchy Configuration
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Check the levels you report by. Tick **Variant (Sizes)** to see ledger records broken down by specific size/color.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-4 pt-2">
                    <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <input
                            type="checkbox"
                            id="group-brand"
                            checked={groupingLevels.brand}
                            onChange={(e) => handleToggleLevel('brand', e.target.checked)}
                            disabled={groupingLevels.division}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer disabled:opacity-50"
                        />
                        <label htmlFor="group-brand" className={cn("text-xs font-bold text-slate-700 dark:text-slate-350 cursor-pointer select-none flex items-center gap-1.5", groupingLevels.division && "opacity-60 cursor-not-allowed")}>
                            <Layers className="h-3.5 w-3.5 text-indigo-500" /> Brand
                        </label>
                    </div>
                    <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <input
                            type="checkbox"
                            id="group-division"
                            checked={groupingLevels.division}
                            onChange={(e) => handleToggleLevel('division', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer"
                        />
                        <label htmlFor="group-division" className="text-xs font-bold text-slate-700 dark:text-slate-350 cursor-pointer select-none flex items-center gap-1.5">
                            <Folder className="h-3.5 w-3.5 text-blue-500" /> Division
                        </label>
                    </div>
                    <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <input
                            type="checkbox"
                            id="group-category"
                            checked={groupingLevels.category}
                            onChange={(e) => handleToggleLevel('category', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer"
                        />
                        <label htmlFor="group-category" className="text-xs font-bold text-slate-700 dark:text-slate-350 cursor-pointer select-none flex items-center gap-1.5">
                            <ShoppingCart className="h-3.5 w-3.5 text-emerald-500" /> Category
                        </label>
                    </div>
                    <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <input
                            type="checkbox"
                            id="group-gender"
                            checked={groupingLevels.gender}
                            onChange={(e) => handleToggleLevel('gender', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer"
                        />
                        <label htmlFor="group-gender" className="text-xs font-bold text-slate-700 dark:text-slate-350 cursor-pointer select-none flex items-center gap-1.5">
                            <Store className="h-3.5 w-3.5 text-rose-500" /> Gender
                        </label>
                    </div>
                    <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <input
                            type="checkbox"
                            id="group-silhouette"
                            checked={groupingLevels.silhouette}
                            onChange={(e) => handleToggleLevel('silhouette', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer"
                        />
                        <label htmlFor="group-silhouette" className="text-xs font-bold text-slate-750 dark:text-slate-350 cursor-pointer select-none flex items-center gap-1.5">
                            <TrendingUp className="h-3.5 w-3.5 text-amber-500" /> Silhouette
                        </label>
                    </div>
                    <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <input
                            type="checkbox"
                            id="group-article"
                            checked={groupingLevels.article}
                            onChange={(e) => handleToggleLevel('article', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer"
                        />
                        <label htmlFor="group-article" className="text-xs font-bold text-slate-700 dark:text-slate-350 cursor-pointer select-none flex items-center gap-1.5">
                            <Inbox className="h-3.5 w-3.5 text-cyan-500" /> Article
                        </label>
                    </div>
                    <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <input
                            type="checkbox"
                            id="group-variant"
                            checked={groupingLevels.variant}
                            onChange={(e) => handleToggleLevel('variant', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer"
                        />
                        <label htmlFor="group-variant" className="text-xs font-bold text-slate-755 dark:text-slate-350 cursor-pointer select-none flex items-center gap-1.5">
                            <Printer className="h-3.5 w-3.5 text-fuchsia-500" /> Variant (Sizes)
                        </label>
                    </div>
                </div>
            </div>

            {/* Warning banner for large data sets */}
            {flatRows.filter(r => r.type === 'article').length > 400 && !showVariant && (
                <div className="bg-amber-50 dark:bg-amber-955/20 border border-amber-500/30 text-amber-800 dark:text-amber-300 p-4 rounded-xl flex items-start gap-3 no-print">
                    <span className="text-lg">⚠️</span>
                    <div className="space-y-1">
                        <h4 className="font-bold text-xs">Large Report Detected ({flatRows.filter(r => r.type === 'article').length} Articles)</h4>
                        <p className="text-[11px] leading-relaxed opacity-90">
                            Exporting this volume as a detailed PDF (with all sizes/colors) requires rendering hundreds of pages, which puts heavy load on the server and may take a few minutes. 
                            We **highly recommend** downloading as **Excel (XLSX)** (which downloads instantly) or checking the **"Summary Only (Hide Sizes)"** filter before exporting to PDF.
                        </p>
                    </div>
                </div>
            )}

            {/* KPI overview */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 no-print">
                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Opening Balance</p>
                            <h3 className="text-2xl font-bold mt-1 text-slate-800 dark:text-slate-100">{formatQty(grandTotals.openingBalance)} Units</h3>
                        </div>
                        <div className="rounded-lg p-2 bg-slate-100 dark:bg-slate-800 text-slate-650">
                            <Inbox className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">In-Transit Qty</p>
                            <h3 className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">{formatQty(grandTotals.inTransitQty)} Units</h3>
                        </div>
                        <div className="rounded-lg p-2 bg-amber-50 dark:bg-amber-955/20 text-amber-600">
                            <ArrowUpRight className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Closing Balance</p>
                            <h3 className="text-2xl font-bold mt-1 text-primary">{formatQty(grandTotals.closingBalance)} Units</h3>
                        </div>
                        <div className="rounded-lg p-2 bg-blue-50 dark:bg-blue-955/20 text-primary">
                            <Layers className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* virtualized table */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-md">
                {isPending ? (
                    <div className="flex flex-col items-center justify-center py-24 gap-3">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        <p className="text-sm font-semibold text-muted-foreground">Calculating running ledger details...</p>
                    </div>
                ) : filteredRows.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <Inbox className="h-16 w-16 text-slate-300 dark:text-slate-700 mb-4" />
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">No Transactions Found</h3>
                        <p className="text-sm text-muted-foreground max-w-sm mt-1">
                            No ledger details matched your chosen period, location or hierarchy filters.
                        </p>
                    </div>
                ) : (
                    <div ref={parentRef} className="overflow-auto max-h-[750px] min-h-[500px]">
                        <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
                            <colgroup>
                                <col style={{ width: "12%" }} />
                                <col style={{ width: "15%" }} />
                                <col style={{ width: "12%" }} />
                                <col style={{ width: "33%" }} />
                                <col style={{ width: "9%" }} />
                                <col style={{ width: "9%" }} />
                                <col style={{ width: "10%" }} />
                            </colgroup>
                            <tbody>
                                {paddingTop > 0 && (
                                    <tr>
                                        <td colSpan={7} style={{ height: `${paddingTop}px` }} />
                                    </tr>
                                )}
                                {virtualItems.map((virtualRow) => {
                                    const row = filteredRows[virtualRow.index];
                                    if (!row) return null;
                                    const isGroup = ['brand', 'division', 'category', 'gender', 'silhouette', 'article', 'variant'].includes(row.type);

                                    if (isGroup) {
                                        const levelColors: Record<string, string> = {
                                            brand: "bg-slate-100 dark:bg-slate-950 font-black text-[12px] text-slate-800 dark:text-slate-200 border-t-2 border-slate-200 dark:border-slate-800",
                                            division: "bg-slate-50/80 dark:bg-slate-900/60 font-extrabold text-[11.5px] text-slate-750 dark:text-slate-300 border-t border-slate-200/50",
                                            category: "bg-slate-100/50 dark:bg-slate-950/40 font-bold text-[11px] text-slate-700 dark:text-slate-350",
                                            gender: "bg-slate-50/50 dark:bg-slate-900/30 font-bold text-[10.5px] text-slate-700 dark:text-slate-400",
                                            silhouette: "bg-slate-100/30 dark:bg-slate-950/20 font-bold text-[10px] text-slate-655 dark:text-slate-450",
                                            article: "bg-indigo-50/30 dark:bg-indigo-950/10 font-bold text-[11px] text-indigo-950 dark:text-indigo-300 border-t border-indigo-100 dark:border-indigo-950/40",
                                            variant: "bg-violet-50/20 dark:bg-violet-950/5 font-bold text-[10.5px] text-violet-900 dark:text-violet-300 border-t border-violet-100/50",
                                        };

                                        const labelText = row.type === 'article'
                                            ? `${row.sku} — ${row.label}`
                                            : row.type === 'variant'
                                                ? `Color: ${row.color}  |  Size: ${row.size}`
                                                : `${row.type.toUpperCase()}: ${row.label}`;

                                        return (
                                            <tr key={virtualRow.key} ref={rowVirtualizer.measureElement} data-index={virtualRow.index} className={cn("h-9 select-none", levelColors[row.type])}>
                                                <td colSpan={5} className="pl-4 font-semibold">
                                                    {row._highlight ? highlight(labelText, row._highlight) : labelText}
                                                </td>
                                                <td colSpan={2} className="pr-4 text-right text-[10px] font-bold text-muted-foreground">
                                                    Open: {row.totals?.openingBalance ?? 0} &bull; Close: {row.totals?.closingBalance ?? 0} &bull; Transit: {row.totals?.inTransitQty ?? 0}
                                                </td>
                                            </tr>
                                        );
                                    }

                                    if (row.type === 'product-header') {
                                        return (
                                            <tr key={virtualRow.key} ref={rowVirtualizer.measureElement} data-index={virtualRow.index} className="bg-slate-50 dark:bg-slate-900 border-t border-b border-slate-350 dark:border-slate-800 text-[10px] uppercase font-bold h-7.5 text-left select-none">
                                                <th className="border-r border-slate-200 dark:border-slate-800 pl-4 text-slate-700 dark:text-slate-300">GPC</th>
                                                <th className="border-r border-slate-200 dark:border-slate-800 pl-2 text-slate-700 dark:text-slate-300">Category</th>
                                                <th className="border-r border-slate-200 dark:border-slate-800 pl-2 text-slate-700 dark:text-slate-300">SKU</th>
                                                <th className="border-r border-slate-200 dark:border-slate-800 pl-2 text-slate-700 dark:text-slate-300">Product Name</th>
                                                <th className="border-r border-slate-200 dark:border-slate-800 pl-2 text-slate-700 dark:text-slate-300">Size</th>
                                                <th colSpan={2} className="pl-2 text-slate-700 dark:text-slate-300">Color</th>
                                            </tr>
                                        );
                                    }

                                    if (row.type === 'product-data') {
                                        return (
                                            <tr key={virtualRow.key} ref={rowVirtualizer.measureElement} data-index={virtualRow.index} className="bg-white dark:bg-slate-955 border-b border-slate-300 dark:border-slate-800 text-[11px] h-8.5 text-left font-bold select-none text-blue-800 dark:text-blue-450">
                                                <td className="border-r border-slate-200 dark:border-slate-800 pl-4">{row.division || "-"}</td>
                                                <td className="border-r border-slate-200 dark:border-slate-800 pl-2">{row.category || "-"}</td>
                                                <td className="border-r border-slate-200 dark:border-slate-800 pl-2">{row.sku || "-"}</td>
                                                <td className="border-r border-slate-200 dark:border-slate-800 pl-2 truncate max-w-[300px]">{row.label || "-"}</td>
                                                <td className="border-r border-slate-200 dark:border-slate-800 pl-2">
                                                    {showVariant ? (row.size || "Default") : "All Sizes"}
                                                </td>
                                                <td colSpan={2} className="pl-2">
                                                    {showVariant ? (row.color || "Default") : "All Colors"}
                                                </td>
                                            </tr>
                                        );
                                    }

                                    if (row.type === 'ledger-header') {
                                        return (
                                            <tr key={virtualRow.key} ref={rowVirtualizer.measureElement} data-index={virtualRow.index} className="bg-slate-800 text-slate-100 text-[10px] font-bold h-7.5 uppercase tracking-wider select-none">
                                                <th className="text-left pl-4 border-b border-slate-650">Doc Type</th>
                                                <th className="text-left pl-2 border-b border-slate-655">Doc Ref</th>
                                                <th className="text-left pl-2 border-b border-slate-655">Date</th>
                                                <th className="text-left pl-2 border-b border-slate-655">Remarks</th>
                                                <th className="text-right pr-4 border-b border-slate-655">In</th>
                                                <th className="text-right pr-4 border-b border-slate-655">Out</th>
                                                <th className="text-right pr-4 border-b border-slate-655">Balance</th>
                                            </tr>
                                        );
                                    }

                                    if (row.type === 'opening-balance') {
                                        return (
                                            <tr key={virtualRow.key} ref={rowVirtualizer.measureElement} data-index={virtualRow.index} className="bg-slate-50/40 dark:bg-slate-900/10 text-slate-500 text-[11px] h-8 border-b border-border/40 select-none">
                                                <td className="pl-4 font-semibold text-slate-700 dark:text-slate-400">Opening Balance</td>
                                                <td className="pl-2">-</td>
                                                <td className="pl-2">{row.date ? format(new Date(row.date), "dd/MM/yyyy") : "-"}</td>
                                                <td className="pl-2">Opening Balance B/F</td>
                                                <td className="text-right pr-4">-</td>
                                                <td className="text-right pr-4">-</td>
                                                <td className="text-right pr-4 font-bold text-slate-950 dark:text-slate-100">{row.balance}</td>
                                            </tr>
                                        );
                                    }

                                    if (row.type === 'closing-balance') {
                                        return (
                                            <tr key={virtualRow.key} ref={rowVirtualizer.measureElement} data-index={virtualRow.index} className="bg-slate-50/80 dark:bg-slate-900/20 text-slate-800 dark:text-slate-200 text-[11px] font-bold h-8 border-b border-border/80 border-t border-border/50 select-none">
                                                <td className="pl-4 uppercase">Closing Balance</td>
                                                <td className="pl-2">-</td>
                                                <td className="pl-2">{row.date ? format(new Date(row.date), "dd/MM/yyyy") : "-"}</td>
                                                <td className="pl-2">Closing Balance C/F</td>
                                                <td className="text-right pr-4">-</td>
                                                <td className="text-right pr-4">-</td>
                                                <td className="text-right pr-4 text-primary font-black">{row.balance}</td>
                                            </tr>
                                        );
                                    }

                                    if (row.type === 'divider') {
                                        return (
                                            <tr key={virtualRow.key} ref={rowVirtualizer.measureElement} data-index={virtualRow.index} className="h-6 bg-slate-50/30 dark:bg-slate-900/5 select-none no-print">
                                                <td colSpan={7} className="border-b border-slate-200 dark:border-slate-800" />
                                            </tr>
                                        );
                                    }

                                    // Transaction row
                                    const docUrl = getDocLink(row.docType, row.docRefId);

                                    return (
                                        <tr
                                            key={virtualRow.key}
                                            ref={rowVirtualizer.measureElement}
                                            data-index={virtualRow.index}
                                            className={cn(
                                                "text-[11.5px] border-b border-border hover:bg-slate-50/30 dark:hover:bg-slate-900/10 h-8.5 transition-colors",
                                                row.isInTransit && "bg-amber-500/5 hover:bg-amber-500/10 text-amber-850 dark:text-amber-400 font-medium"
                                            )}
                                        >
                                            <td className="pl-4 font-semibold">
                                                {row.docType}
                                                {row.isInTransit && <span className="ml-1 text-[9px] bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 px-1 py-0.2 rounded-full font-bold uppercase">Transit</span>}
                                            </td>
                                            <td className="pl-2">
                                                {docUrl ? (
                                                    <Link href={docUrl} className="text-primary hover:underline font-semibold flex items-center gap-0.5">
                                                        {row.docRef}
                                                        <LinkIcon className="h-2.5 w-2.5" />
                                                    </Link>
                                                ) : (
                                                    <span className="font-semibold">{row.docRef}</span>
                                                )}
                                            </td>
                                            <td className="pl-2 text-slate-550 dark:text-slate-450">
                                                {row.date ? format(new Date(row.date), "dd/MM/yyyy") : "-"}
                                            </td>
                                            <td className="pl-2 text-muted-foreground truncate" title={row.remarks}>{row.remarks}</td>
                                            <td className="text-right pr-4 text-emerald-655 dark:text-emerald-450 font-bold">{formatQty(row.inQty)}</td>
                                            <td className="text-right pr-4 text-rose-655 dark:text-rose-450 font-bold">{formatQty(row.outQty)}</td>
                                            <td className="text-right pr-4 font-black">{row.isInTransit ? "-" : row.balance}</td>
                                        </tr>
                                    );
                                })}
                                {paddingBottom > 0 && (
                                    <tr>
                                        <td colSpan={7} style={{ height: `${paddingBottom}px` }} />
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
