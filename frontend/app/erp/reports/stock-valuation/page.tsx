"use client";

import React, { useEffect, useState, useTransition, useCallback, useMemo, useRef } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import {
    getStockValuationReport,
    queueStockValuationReportExport,
    getStockValuationReportExportStatus
} from "@/lib/actions/stock-ledger";
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
    ArrowDownRight,
    TrendingUp,
    Store,
    Layers,
    ShoppingCart,
    Inbox,
    RefreshCw,
    Folder,
    Settings,
    Coins
} from "lucide-react";
import { toast } from "sonner";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { cn, COMPANY_NAME, getApiBaseUrl } from "@/lib/utils";

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

export default function PosStockValuationReportPage() {
    const { user } = useAuth();

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
    const [isPending, startTransition] = useTransition();
    const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

    // Excel Export Background Queue States
    const [exportJobId, setExportJobId] = useState<string | null>(null);
    const [exportState, setExportState] = useState<"idle" | "queueing" | "processing" | "completed" | "failed">("idle");
    const [exportProgress, setExportProgress] = useState<number>(0);

    // PDF Export Background Queue States
    const [pdfJobId, setPdfJobId] = useState<string | null>(null);
    const [pdfExportState, setPdfExportState] = useState<"idle" | "queueing" | "processing" | "completed" | "failed">("idle");
    const [pdfExportProgress, setPdfExportProgress] = useState<number>(0);

    const summaryOnly = !groupingLevels.variant;

    // ─── Frontend Filter State ───────────────────────────────────────────────────
    const [searchText, setSearchText] = useState("");
    const [filterBrands, setFilterBrands] = useState<Set<string>>(new Set());
    const [filterDivisions, setFilterDivisions] = useState<Set<string>>(new Set());
    const [filterGenders, setFilterGenders] = useState<Set<string>>(new Set());
    const [filterSilhouettes, setFilterSilhouettes] = useState<Set<string>>(new Set());
    const [filterCategories, setFilterCategories] = useState<Set<string>>(new Set());

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

    const fetchReport = useCallback(() => {
        if (!dateRange.from || !dateRange.to) return;
        startTransition(async () => {
            const result = await getStockValuationReport({
                startDate: dateRange.from?.toISOString(),
                endDate: dateRange.to?.toISOString(),
                summaryOnly,
                showBrand: groupingLevels.brand,
                showDivision: groupingLevels.division,
                showCategory: groupingLevels.category,
                showGender: groupingLevels.gender,
                showSilhouette: groupingLevels.silhouette,
                showArticle: groupingLevels.article,
                showVariant: groupingLevels.variant,
            });
            if (result && result.status !== false) {
                setReportData(result.data?.root || (Array.isArray(result.data) ? result.data : []));
            } else {
                toast.error("Failed to load valuation report data");
            }
        });
    }, [dateRange, groupingLevels, summaryOnly]);

    useEffect(() => {
        fetchReport();
    }, [groupingLevels]);

    // Poll Excel Export Job Status
    useEffect(() => {
        if (exportState !== "queueing" && exportState !== "processing") return;
        if (!exportJobId) return;

        const interval = setInterval(async () => {
            try {
                const res = await getStockValuationReportExportStatus(exportJobId);
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

    // Poll PDF Export Job Status
    useEffect(() => {
        if (pdfExportState !== "queueing" && pdfExportState !== "processing") return;
        if (!pdfJobId) return;

        const interval = setInterval(async () => {
            try {
                const res = await getStockValuationReportExportStatus(pdfJobId);
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

    const handleExportExcelClick = async (exportType: "hierarchical" | "flat" = "hierarchical") => {
        if (!dateRange.from || !dateRange.to) return;

        // If completed, trigger download
        if (exportState === "completed" && exportJobId) {
            const base = getApiBaseUrl();
            const url = `${base}/stock-ledger/valuation-report/export/${exportJobId}/download`;
            window.open(url, "_blank");
            
            // Reset
            setExportState("idle");
            setExportJobId(null);
            setExportProgress(0);
            return;
        }

        // Queue Excel job
        setExportState("queueing");
        try {
            const res = await queueStockValuationReportExport({
                startDate: dateRange.from.toISOString(),
                endDate: dateRange.to.toISOString(),
                format: "xlsx",
                exportType,
                filterBrands: [...filterBrands],
                filterDivisions: [...filterDivisions],
                filterCategories: [...filterCategories],
                filterGenders: [...filterGenders],
                filterSilhouettes: [...filterSilhouettes],
                searchText: searchText.trim(),
                summaryOnly,
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
                toast.info(`Background ${exportType === "flat" ? "Flat Data" : "Hierarchical"} Excel export queued.`);
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

        // If completed, trigger download
        if (pdfExportState === "completed" && pdfJobId) {
            const base = getApiBaseUrl();
            const url = `${base}/stock-ledger/valuation-report/export/${pdfJobId}/download`;
            window.open(url, "_blank");
            
            // Reset
            setPdfExportState("idle");
            setPdfJobId(null);
            setPdfExportProgress(0);
            return;
        }

        // Queue PDF job
        setPdfExportState("queueing");
        try {
            const res = await queueStockValuationReportExport({
                startDate: dateRange.from.toISOString(),
                endDate: dateRange.to.toISOString(),
                format: "pdf",
                filterBrands: [...filterBrands],
                filterDivisions: [...filterDivisions],
                filterCategories: [...filterCategories],
                filterGenders: [...filterGenders],
                filterSilhouettes: [...filterSilhouettes],
                searchText: searchText.trim(),
                summaryOnly,
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

    // Calculate High Level & Grand Totals Metrics
    const grandTotals = useMemo(() => {
        const t = {
            totalArticles: 0,
            openingQty: 0,
            openingValue: 0,
            purchaseQty: 0,
            purchaseValue: 0,
            purchaseRetQty: 0,
            purchaseRetValue: 0,
            availableQty: 0,
            availableValue: 0,
            salesQty: 0,
            salesValue: 0,
            adjQty: 0,
            adjValue: 0,
            closingQty: 0,
            closingValue: 0,
        };

        for (const node of reportData) {
            if (!node || !node.totals) continue;
            t.openingQty += node.totals.openingQty;
            t.openingValue += node.totals.openingValue;
            
            t.purchaseQty += node.totals.purchaseQty;
            t.purchaseValue += node.totals.purchaseValue;
            
            t.purchaseRetQty += node.totals.purchaseRetQty;
            t.purchaseRetValue += node.totals.purchaseRetValue;
            
            t.availableQty += node.totals.availableQty;
            t.availableValue += node.totals.availableValue;
            
            t.salesQty += node.totals.salesQty;
            t.salesValue += node.totals.salesValue;
            
            t.adjQty += node.totals.adjQty;
            t.adjValue += node.totals.adjValue;
            
            t.closingQty += node.totals.closingQty;
            t.closingValue += node.totals.closingValue;
        }

        const countArticles = (node: any) => {
            if (!node) return;
            if (node.level === 'article') {
                t.totalArticles += 1;
            }
            if (node.children && node.children.length > 0) {
                for (const child of node.children) {
                    countArticles(child);
                }
            }
        };

        for (const node of reportData) {
            countArticles(node);
        }

        return t;
    }, [reportData]);

    // ─── Extract unique filter options from loaded data ────────────────────────
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

    // Flatten nested tree for TanStack Virtual list virtualization
    const flatRows = useMemo(() => {
        const rows: any[] = [];
        
        const visit = (node: any, path: string = "", ancestorBrand = "", ancestorDivision = "", ancestorGender = "", ancestorSilhouette = "", ancestorCategory = "") => {
            if (!node) return;
            const currentPath = path ? `${path}-${node.level}-${node.value}` : `${node.level}-${node.value}`;
            
            const brand = node.level === 'brand' ? node.value : ancestorBrand;
            const division = node.level === 'division' ? node.value : ancestorDivision;
            const gender = node.level === 'gender' ? node.value : ancestorGender;
            const silhouette = node.level === 'silhouette' ? node.value : ancestorSilhouette;
            const category = node.level === 'category' ? node.value : ancestorCategory;

            if (node.level === 'article') {
                rows.push({
                    id: `art-${node.sku}`,
                    type: 'article',
                    label: node.articleName,
                    sku: node.sku,
                    totals: node.totals,
                    brand, division, gender, silhouette, category,
                });
            } else if (node.level === 'variant') {
                rows.push({
                    id: `var-${currentPath}`,
                    type: 'variant',
                    color: node.color,
                    size: node.size,
                    barCode: node.barCode,
                    sku: node.sku,
                    totals: node.totals,
                    brand, division, gender, silhouette, category,
                });
            } else {
                rows.push({
                    id: `${node.level}-${currentPath}`,
                    type: node.level,
                    label: `${node.value.toUpperCase()}`,
                    totals: node.totals,
                    brand, division, gender, silhouette, category,
                });
            }
            
            if (node.children && node.children.length > 0) {
                for (const child of node.children) {
                    visit(child, currentPath, brand, division, gender, silhouette, category);
                }
            }
        };

        for (const rootNode of reportData) {
            visit(rootNode);
        }
        
        return rows;
    }, [reportData]);

    const createEmptyValuationTotals = () => ({
        openingQty: 0, openingCost: 0, openingValue: 0,
        purchaseQty: 0, purchaseCost: 0, purchaseValue: 0,
        purchaseRetQty: 0, purchaseRetCost: 0, purchaseRetValue: 0,
        availableQty: 0, availableCost: 0, availableValue: 0,
        salesQty: 0, salesCost: 0, salesValue: 0,
        adjQty: 0, adjCost: 0, adjValue: 0,
        closingQty: 0, closingCost: 0, closingValue: 0,
    });

    // ─── Apply frontend filters cleanly via recursive tree filtering ───────────
    const filteredRows = useMemo(() => {
        if (!hasActiveFilters) return flatRows;

        const q = searchText.trim().toLowerCase();

        const filterNode = (node: any, ancestorBrand = "", ancestorDivision = "", ancestorGender = "", ancestorSilhouette = "", ancestorCategory = ""): any | null => {
            if (!node) return null;

            const brand = node.level === 'brand' ? node.value : ancestorBrand;
            const division = node.level === 'division' ? node.value : ancestorDivision;
            const gender = node.level === 'gender' ? node.value : ancestorGender;
            const silhouette = node.level === 'silhouette' ? node.value : ancestorSilhouette;
            const category = node.level === 'category' ? node.value : ancestorCategory;

            const brandMatch = filterBrands.size === 0 || filterBrands.has(brand);
            const divMatch = filterDivisions.size === 0 || filterDivisions.has(division);
            const genderMatch = filterGenders.size === 0 || filterGenders.has(gender);
            const silMatch = filterSilhouettes.size === 0 || filterSilhouettes.has(silhouette);
            const catMatch = filterCategories.size === 0 || filterCategories.has(category);

            if (!brandMatch || !divMatch || !genderMatch || !silMatch || !catMatch) {
                return null;
            }

            if (node.level === 'variant') {
                const textMatch = !q ||
                    (node.barCode || "").toLowerCase().includes(q) ||
                    (node.sku || "").toLowerCase().includes(q) ||
                    (node.color || "").toLowerCase().includes(q) ||
                    (node.size || "").toLowerCase().includes(q);
                return textMatch ? node : null;
            }

            if (node.level === 'article') {
                const articleSelfMatch = !q ||
                    (node.articleName || "").toLowerCase().includes(q) ||
                    (node.sku || "").toLowerCase().includes(q);

                let filteredChildren: any[] = [];
                if (node.children && node.children.length > 0) {
                    for (const child of node.children) {
                        const res = filterNode(child, brand, division, gender, silhouette, category);
                        if (res) filteredChildren.push(res);
                    }
                }

                if (articleSelfMatch || filteredChildren.length > 0) {
                    return {
                        ...node,
                        children: filteredChildren,
                    };
                }
                return null;
            }

            // Group nodes (brand, division, category, gender, silhouette)
            let filteredChildren: any[] = [];
            if (node.children && node.children.length > 0) {
                for (const child of node.children) {
                    const res = filterNode(child, brand, division, gender, silhouette, category);
                    if (res) filteredChildren.push(res);
                }
            }

            const groupSelfMatch = !q || (node.value || "").toLowerCase().includes(q);

            if (filteredChildren.length > 0) {
                const newTotals = createEmptyValuationTotals();
                const addValuationTotals = (target: any, source: any) => {
                    target.openingQty += source.openingQty;
                    target.openingValue += source.openingValue;
                    target.openingCost = target.openingQty > 0 ? target.openingValue / target.openingQty : 0;

                    target.purchaseQty += source.purchaseQty;
                    target.purchaseValue += source.purchaseValue;
                    target.purchaseCost = target.purchaseQty > 0 ? target.purchaseValue / target.purchaseQty : 0;

                    target.purchaseRetQty += source.purchaseRetQty;
                    target.purchaseRetValue += source.purchaseRetValue;
                    target.purchaseRetCost = target.purchaseRetQty > 0 ? target.purchaseRetValue / target.purchaseRetQty : 0;

                    target.availableQty += source.availableQty;
                    target.availableValue += source.availableValue;
                    target.availableCost = target.availableQty > 0 ? target.availableValue / target.availableQty : 0;

                    target.salesQty += source.salesQty;
                    target.salesValue += source.salesValue;
                    target.salesCost = target.salesQty > 0 ? target.salesValue / target.salesQty : 0;

                    target.adjQty += source.adjQty;
                    target.adjValue += source.adjValue;
                    target.adjCost = target.adjQty !== 0 ? target.adjValue / target.adjQty : 0;

                    target.closingQty += source.closingQty;
                    target.closingValue += source.closingValue;
                    target.closingCost = target.closingQty > 0 ? target.closingValue / target.closingQty : 0;
                };

                for (const child of filteredChildren) {
                    addValuationTotals(newTotals, child.totals);
                }

                return {
                    ...node,
                    totals: newTotals,
                    children: filteredChildren,
                };
            } else if (groupSelfMatch && q) {
                return node;
            }

            return null;
        };

        const filteredTree: any[] = [];
        for (const rootNode of reportData) {
            const res = filterNode(rootNode);
            if (res) filteredTree.push(res);
        }

        const rows: any[] = [];
        const visit = (node: any, path: string = "", ancestorBrand = "", ancestorDivision = "", ancestorGender = "", ancestorSilhouette = "", ancestorCategory = "") => {
            if (!node) return;
            const currentPath = path ? `${path}-${node.level}-${node.value}` : `${node.level}-${node.value}`;
            
            const brand = node.level === 'brand' ? node.value : ancestorBrand;
            const division = node.level === 'division' ? node.value : ancestorDivision;
            const gender = node.level === 'gender' ? node.value : ancestorGender;
            const silhouette = node.level === 'silhouette' ? node.value : ancestorSilhouette;
            const category = node.level === 'category' ? node.value : ancestorCategory;

            if (node.level === 'article') {
                rows.push({
                    id: `art-${node.sku}`,
                    type: 'article',
                    label: node.articleName,
                    sku: node.sku,
                    totals: node.totals,
                    brand, division, gender, silhouette, category,
                    _highlight: q,
                });
            } else if (node.level === 'variant') {
                rows.push({
                    id: `var-${currentPath}`,
                    type: 'variant',
                    color: node.color,
                    size: node.size,
                    barCode: node.barCode,
                    sku: node.sku,
                    totals: node.totals,
                    brand, division, gender, silhouette, category,
                    _highlight: q,
                });
            } else {
                rows.push({
                    id: `${node.level}-${currentPath}`,
                    type: node.level,
                    label: `${node.value.toUpperCase()}`,
                    totals: node.totals,
                    brand, division, gender, silhouette, category,
                });
            }
            
            if (node.children && node.children.length > 0) {
                for (const child of node.children) {
                    visit(child, currentPath, brand, division, gender, silhouette, category);
                }
            }
        };

        for (const rootNode of filteredTree) {
            visit(rootNode);
        }

        return rows;
    }, [reportData, flatRows, hasActiveFilters, searchText, filterBrands, filterDivisions, filterGenders, filterSilhouettes, filterCategories]);

    const handleToggleLevel = (level: keyof typeof groupingLevels, checked: boolean) => {
        setGroupingLevels(prev => {
            const next = { ...prev, [level]: checked };
            if (level === 'division' && checked) {
                next.brand = true;
            }
            if (level === 'brand' && !checked) {
                next.division = false;
            }
            return next;
        });
    };

    // Setup TanStack Virtualizer
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
            case "queueing":
                return "Queueing...";
            case "processing":
                return `Generating ${exportProgress}%`;
            case "completed":
                return "Download Excel";
            case "failed":
                return "Retry Excel Export";
            case "idle":
            default:
                return "Export Excel";
        }
    };

    const getPdfButtonText = () => {
        switch (pdfExportState) {
            case "queueing":
                return "Queueing...";
            case "processing":
                return `Generating ${pdfExportProgress}%`;
            case "completed":
                return "Download PDF";
            case "failed":
                return "Retry PDF Export";
            case "idle":
            default:
                return "Export PDF";
        }
    };

    const formatQty = (val: number) => val === 0 ? "-" : val.toLocaleString();
    const formatCost = (val: number) => val === 0 ? "-" : val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formatValue = (val: number) => val === 0 ? "-" : val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    return (
        <div className="p-6 space-y-6 max-w-[1800px] mx-auto">
            {/* Header Block */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5 no-print">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2 text-slate-850 dark:text-slate-100">
                        <Coins className="h-8 w-8 text-primary" />
                        Stock Valuation Report
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5 font-medium">
                        <Layers className="h-4 w-4 text-primary/70" />
                        Company-Wide Stock Valuation & Cost Analysis — All Locations
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
                        onClick={() => handleExportExcelClick("flat")}
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
                        {exportState === "idle" ? "Excel (Flat Data)" : getExportButtonText()}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={() => handleExportExcelClick("hierarchical")}
                        disabled={(exportState === "queueing" || exportState === "processing") || reportData.length === 0}
                        className="gap-2 font-semibold border-emerald-500/40 text-emerald-750 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                    >
                        <Download className="h-4 w-4" />
                        Excel (Hierarchy)
                    </Button>
                </div>
            </div>

            {/* Print Header (Visible only when printed) */}
            <div className="hidden print:block mb-6 border-b pb-4">
                <h1 className="text-2xl font-bold text-center text-slate-900">Stock Valuation Report</h1>
                <p className="text-sm text-center text-slate-600 mt-1">Company-Wide Stock Valuation</p>
                <p className="text-xs text-center text-slate-500">
                    Period: {dateRange.from ? format(dateRange.from, "dd MMM yyyy") : "Start"} to{" "}
                    {dateRange.to ? format(dateRange.to, "dd MMM yyyy") : "End"}
                </p>
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-50 dark:bg-slate-900/40 border p-4 rounded-xl shadow-sm no-print">
                <div className="flex flex-wrap items-center gap-3">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        Date Period:
                    </span>
                    <DateRangePicker
                        initialDateFrom={dateRange.from}
                        initialDateTo={dateRange.to}
                        onUpdate={({ range }: { range: DateRange }) => {
                            if (range) {
                                setDateRange(range);
                            }
                        }}
                    />
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={fetchReport}
                        disabled={isPending}
                        className="text-primary hover:text-primary/95 text-xs font-bold"
                    >
                        Apply / Refresh
                    </Button>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-semibold">
                    <Folder className="h-4 w-4 text-primary" />
                    <span>{COMPANY_NAME} &bull; Virtualized High-Performance Scroll</span>
                </div>
            </div>

            {/* ── Frontend Search & Filter Panel ── */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-xs space-y-3 no-print">
                <div className="flex flex-wrap items-center gap-3">
                    {/* Text search */}
                    <div className="relative flex-1 min-w-[200px] max-w-xs">
                        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"/></svg>
                        <input
                            type="text"
                            placeholder="Search article name, SKU, or Barcode..."
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

                    {/* Autocomplete dropdowns */}
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
                        <>
                            <div className="h-5 w-px bg-border hidden sm:block" />
                            <button
                                onClick={clearAllFilters}
                                className="flex items-center gap-1 text-[11px] font-bold text-destructive hover:text-destructive/80 transition-colors"
                            >
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                                Clear Filters
                            </button>
                        </>
                    )}

                    <div className="ml-auto text-[11px] font-semibold text-muted-foreground flex items-center gap-1.5">
                        {hasActiveFilters ? (
                            <span className="bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                {filteredRows.filter(r => r.type === 'article').length} / {flatRows.filter(r => r.type === 'article').length} articles
                            </span>
                        ) : (
                            <span>{flatRows.filter(r => r.type === 'article').length} articles loaded</span>
                        )}
                    </div>
                </div>

                {/* Active filter chips */}
                {hasActiveFilters && (
                    <div className="flex flex-wrap gap-1.5 pt-1 border-t border-border">
                        {searchText.trim() && (
                            <span className="inline-flex items-center gap-1 text-[11px] bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full font-semibold">
                                Search: &ldquo;{searchText}&rdquo;
                                <button onClick={() => setSearchText("")} className="hover:text-amber-600"><svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
                            </span>
                        )}
                        {[...filterBrands].map(v => (
                            <span key={v} className="inline-flex items-center gap-1 text-[11px] bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300 px-2 py-0.5 rounded-full font-semibold">
                                Brand: {v}
                                <button onClick={() => toggleFilter(setFilterBrands, v)} className="hover:text-indigo-600"><svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
                            </span>
                        ))}
                        {[...filterDivisions].map(v => (
                            <span key={v} className="inline-flex items-center gap-1 text-[11px] bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-2 py-0.5 rounded-full font-semibold">
                                Division: {v}
                                <button onClick={() => toggleFilter(setFilterDivisions, v)} className="hover:text-blue-600"><svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
                            </span>
                        ))}
                        {[...filterGenders].map(v => (
                            <span key={v} className="inline-flex items-center gap-1 text-[11px] bg-rose-100 dark:bg-rose-900/30 text-rose-800 dark:text-rose-300 px-2 py-0.5 rounded-full font-semibold">
                                Gender: {v}
                                <button onClick={() => toggleFilter(setFilterGenders, v)} className="hover:text-rose-600"><svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
                            </span>
                        ))}
                        {[...filterSilhouettes].map(v => (
                            <span key={v} className="inline-flex items-center gap-1 text-[11px] bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full font-semibold">
                                Silhouette: {v}
                                <button onClick={() => toggleFilter(setFilterSilhouettes, v)} className="hover:text-amber-600"><svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
                            </span>
                        ))}
                        {[...filterCategories].map(v => (
                            <span key={v} className="inline-flex items-center gap-1 text-[11px] bg-emerald-100 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full font-semibold">
                                Category: {v}
                                <button onClick={() => toggleFilter(setFilterCategories, v)} className="hover:text-emerald-600"><svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Report Hierarchy Configuration */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-xs space-y-4 no-print">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                            <Settings className="h-4 w-4 text-primary" />
                            Report Hierarchy Configuration
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Customize the nesting structure. Check the levels you report by (Brand/Concept and Division are root levels).
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-4 pt-2">
                    {/* Brand Checkbox */}
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
                            <Layers className="h-3.5 w-3.5 text-indigo-500" />
                            Brand
                        </label>
                    </div>

                    {/* Division Checkbox */}
                    <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <input
                            type="checkbox"
                            id="group-division"
                            checked={groupingLevels.division}
                            onChange={(e) => handleToggleLevel('division', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer"
                        />
                        <label htmlFor="group-division" className="text-xs font-bold text-slate-700 dark:text-slate-350 cursor-pointer select-none flex items-center gap-1.5">
                            <Folder className="h-3.5 w-3.5 text-blue-500" />
                            Division
                        </label>
                    </div>

                    {/* Category Checkbox */}
                    <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <input
                            type="checkbox"
                            id="group-category"
                            checked={groupingLevels.category}
                            onChange={(e) => handleToggleLevel('category', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer"
                        />
                        <label htmlFor="group-category" className="text-xs font-bold text-slate-700 dark:text-slate-350 cursor-pointer select-none flex items-center gap-1.5">
                            <ShoppingCart className="h-3.5 w-3.5 text-emerald-500" />
                            Category
                        </label>
                    </div>

                    {/* Gender Checkbox */}
                    <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <input
                            type="checkbox"
                            id="group-gender"
                            checked={groupingLevels.gender}
                            onChange={(e) => handleToggleLevel('gender', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer"
                        />
                        <label htmlFor="group-gender" className="text-xs font-bold text-slate-700 dark:text-slate-350 cursor-pointer select-none flex items-center gap-1.5">
                            <Store className="h-3.5 w-3.5 text-rose-500" />
                            Gender
                        </label>
                    </div>

                    {/* Silhouette Checkbox */}
                    <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <input
                            type="checkbox"
                            id="group-silhouette"
                            checked={groupingLevels.silhouette}
                            onChange={(e) => handleToggleLevel('silhouette', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer"
                        />
                        <label htmlFor="group-silhouette" className="text-xs font-bold text-slate-750 dark:text-slate-350 cursor-pointer select-none flex items-center gap-1.5">
                            <TrendingUp className="h-3.5 w-3.5 text-amber-500" />
                            Silhouette
                        </label>
                    </div>

                    {/* Article Checkbox */}
                    <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <input
                            type="checkbox"
                            id="group-article"
                            checked={groupingLevels.article}
                            onChange={(e) => handleToggleLevel('article', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer"
                        />
                        <label htmlFor="group-article" className="text-xs font-bold text-slate-700 dark:text-slate-350 cursor-pointer select-none flex items-center gap-1.5">
                            <Inbox className="h-3.5 w-3.5 text-cyan-500" />
                            Article
                        </label>
                    </div>

                    {/* Variant Checkbox */}
                    <div className="flex items-center gap-2.5 p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                        <input
                            type="checkbox"
                            id="group-variant"
                            checked={groupingLevels.variant}
                            onChange={(e) => handleToggleLevel('variant', e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary cursor-pointer"
                        />
                        <label htmlFor="group-variant" className="text-xs font-bold text-slate-750 dark:text-slate-350 cursor-pointer select-none flex items-center gap-1.5">
                            <Printer className="h-3.5 w-3.5 text-fuchsia-500" />
                            Variant (Sizes)
                        </label>
                    </div>
                </div>
            </div>

            {/* Warning banner for large data sets */}
            {grandTotals.totalArticles > 500 && !summaryOnly && (
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-500/30 text-amber-800 dark:text-amber-300 p-4 rounded-xl flex items-start gap-3 no-print">
                    <span className="text-lg">⚠️</span>
                    <div className="space-y-1">
                        <h4 className="font-bold text-xs">Large Report Detected ({grandTotals.totalArticles} Articles)</h4>
                        <p className="text-[11px] leading-relaxed opacity-90">
                            Exporting this volume as a detailed PDF (with all sizes/colors) requires rendering hundreds of pages. 
                            We **highly recommend** downloading as **Excel (XLSX)** (which downloads instantly) or checking the **"Summary Only"** hierarchy level (uncheck Variant) before exporting to PDF.
                        </p>
                    </div>
                </div>
            )}

            {/* KPI Overview Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 no-print">
                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Opening Value</p>
                            <h3 className="text-lg font-bold mt-1 text-slate-800 dark:text-slate-100">Rs. {formatValue(grandTotals.openingValue)}</h3>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{formatQty(grandTotals.openingQty)} Units</p>
                        </div>
                        <div className="rounded-lg p-2 bg-slate-100 dark:bg-slate-800 text-slate-650">
                            <Inbox className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Net Purchases Value</p>
                            <h3 className="text-lg font-bold mt-1 text-emerald-650 dark:text-emerald-400">Rs. {formatValue(grandTotals.purchaseValue - grandTotals.purchaseRetValue)}</h3>
                            <p className="text-[10px] text-muted-foreground mt-0.5">+{formatQty(grandTotals.purchaseQty)} Rec / -{formatQty(grandTotals.purchaseRetQty)} Ret</p>
                        </div>
                        <div className="rounded-lg p-2 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600">
                            <ArrowUpRight className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Sales Value (COGS)</p>
                            <h3 className="text-lg font-bold mt-1 text-rose-650 dark:text-rose-400">Rs. {formatValue(grandTotals.salesValue)}</h3>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{formatQty(grandTotals.salesQty)} Units Sold</p>
                        </div>
                        <div className="rounded-lg p-2 bg-rose-50 dark:bg-rose-950/20 text-rose-600">
                            <ArrowDownRight className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Adjustments Value</p>
                            <h3 className="text-lg font-bold mt-1 text-indigo-650 dark:text-indigo-400">Rs. {formatValue(grandTotals.adjValue)}</h3>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{formatQty(grandTotals.adjQty)} Units Adj</p>
                        </div>
                        <div className="rounded-lg p-2 bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400">
                            <Settings className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-xs border-slate-100">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">Closing Balance Value</p>
                            <h3 className="text-lg font-bold mt-1 text-primary">Rs. {formatValue(grandTotals.closingValue)}</h3>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{formatQty(grandTotals.closingQty)} Units Closing</p>
                        </div>
                        <div className="rounded-lg p-2 bg-blue-50 dark:bg-blue-950/20 text-primary">
                            <Layers className="h-5 w-5" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Tree-structured Scrolling Table with react-virtual virtualization */}
            <div ref={parentRef} className="overflow-auto max-h-[700px] border rounded-xl shadow-sm bg-background no-print">
                <table className="w-full text-left border-collapse min-w-[1600px]">
                    <thead>
                        {/* FIRST ROW: GROUP HEADERS */}
                        <tr className="bg-slate-900 text-slate-100 text-[10px] uppercase font-bold sticky top-0 z-20 shadow-xs border-b border-slate-950">
                            <th colSpan={5} className="p-3 text-center border-r border-slate-800 bg-slate-900">General Info</th>
                            <th colSpan={3} className="p-3 text-center border-r border-slate-800 bg-slate-800">Opening Stock</th>
                            <th colSpan={3} className="p-3 text-center border-r border-slate-800 bg-emerald-950/40 text-emerald-300">Purchases</th>
                            <th colSpan={3} className="p-3 text-center border-r border-slate-800 bg-rose-950/40 text-rose-300">Purchases Return</th>
                            <th colSpan={3} className="p-3 text-center border-r border-slate-800 bg-blue-950/40 text-blue-300">Available</th>
                            <th colSpan={3} className="p-3 text-center border-r border-slate-800 bg-violet-950/40 text-violet-300">Net Sale (COGS)</th>
                            <th colSpan={3} className="p-3 text-center border-r border-slate-800 bg-slate-800">Adjustment</th>
                            <th colSpan={3} className="p-3 text-center bg-slate-900">Closing balance</th>
                        </tr>
                        {/* SECOND ROW: DETAILED COLUMN HEADERS */}
                        <tr className="bg-slate-800 text-slate-100 text-[9px] uppercase font-bold sticky top-[37px] z-20 border-b border-border shadow-sm">
                            <th className="p-2 border-r bg-slate-800">Concept</th>
                            <th className="p-2 border-r bg-slate-800">Division</th>
                            <th className="p-2 border-r bg-slate-800">ItemName</th>
                            <th className="p-2 border-r bg-slate-800">SKU</th>
                            <th className="p-2 border-r text-center bg-slate-800">Size</th>
                            
                            <th className="p-2 text-right bg-slate-700/20">Qty</th>
                            <th className="p-2 text-right bg-slate-700/20">Cost</th>
                            <th className="p-2 border-r text-right bg-slate-700/20">Value</th>
                            
                            <th className="p-2 text-right bg-emerald-900/10">Qty</th>
                            <th className="p-2 text-right bg-emerald-900/10">Cost</th>
                            <th className="p-2 border-r text-right bg-emerald-900/10">Value</th>
                            
                            <th className="p-2 text-right bg-rose-900/10">Qty</th>
                            <th className="p-2 text-right bg-rose-900/10">Cost</th>
                            <th className="p-2 border-r text-right bg-rose-900/10">Value</th>
                            
                            <th className="p-2 text-right bg-blue-900/10">Qty</th>
                            <th className="p-2 text-right bg-blue-900/10">Cost</th>
                            <th className="p-2 border-r text-right bg-blue-900/10">Value</th>
                            
                            <th className="p-2 text-right bg-violet-900/10">Qty</th>
                            <th className="p-2 text-right bg-violet-900/10">Cost</th>
                            <th className="p-2 border-r text-right bg-violet-900/10">Value</th>
                            
                            <th className="p-2 text-right bg-slate-700/20">Qty</th>
                            <th className="p-2 text-right bg-slate-700/20">Cost</th>
                            <th className="p-2 border-r text-right bg-slate-700/20">Value</th>
                            
                            <th className="p-2 text-right bg-slate-850">Qty</th>
                            <th className="p-2 text-right bg-slate-850">Cost</th>
                            <th className="p-2 text-right bg-slate-850">Value</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y text-xs">
                        {isPending ? (
                            <tr>
                                <td colSpan={26} className="p-8 text-center text-muted-foreground font-medium">
                                    <div className="flex items-center justify-center gap-2">
                                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                                        Re-calculating running costs and stock valuation balances...
                                    </div>
                                </td>
                            </tr>
                        ) : filteredRows.length === 0 && flatRows.length > 0 ? (
                            <tr>
                                <td colSpan={26} className="p-8 text-center font-medium">
                                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                        <svg className="h-8 w-8 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" /></svg>
                                        <span className="text-sm font-semibold">No results match your filters</span>
                                        <button onClick={clearAllFilters} className="text-xs text-primary underline font-bold mt-1">Clear all filters</button>
                                    </div>
                                </td>
                            </tr>
                        ) : filteredRows.length === 0 ? (
                            <tr>
                                <td colSpan={26} className="p-8 text-center text-muted-foreground font-medium">
                                    No stock valuation data or movements found for this location and period.
                                </td>
                            </tr>
                        ) : (
                            <>
                                {paddingTop > 0 && (
                                    <tr>
                                        <td colSpan={26} style={{ height: `${paddingTop}px` }} />
                                    </tr>
                                )}
                                {virtualItems.map((virtualRow) => {
                                    const row = filteredRows[virtualRow.index];
                                    const hlQuery = row?._highlight || "";
                                    
                                    const LEVEL_UI_STYLES: Record<string, { className: string; indentClass: string }> = {
                                        brand: { className: "bg-slate-900 text-slate-100 font-black border-b h-[40px]", indentClass: "pl-3 text-slate-100" },
                                        division: { className: "bg-slate-800 text-white font-extrabold border-b h-[40px]", indentClass: "pl-6 text-white" },
                                        category: { className: "bg-slate-700 text-white font-bold border-b h-[40px]", indentClass: "pl-9 text-white" },
                                        gender: { className: "bg-slate-600 text-white font-semibold border-b h-[40px]", indentClass: "pl-12 text-white" },
                                        silhouette: { className: "bg-slate-500 text-slate-100 font-medium border-b h-[40px]", indentClass: "pl-16 text-slate-100" },
                                        article: { className: "bg-slate-100/25 dark:bg-slate-900/15 font-semibold text-slate-800 dark:text-slate-200 border-b h-[45px]", indentClass: "pl-20" },
                                        variant: { className: "hover:bg-slate-50 dark:hover:bg-slate-900/35 text-slate-650 dark:text-slate-400 bg-background transition-colors h-[36px]", indentClass: "pl-24" },
                                    };

                                    const style = LEVEL_UI_STYLES[row.type] || LEVEL_UI_STYLES.brand;
                                    
                                    const isBrand = row.type === 'brand';
                                    const isDivision = row.type === 'division';
                                    const isArticle = row.type === 'article';
                                    const isVariant = row.type === 'variant';
                                    const isGroup = !isArticle && !isVariant;

                                    const totals = row.totals || {
                                        openingQty: 0, openingCost: 0, openingValue: 0,
                                        purchaseQty: 0, purchaseCost: 0, purchaseValue: 0,
                                        purchaseRetQty: 0, purchaseRetCost: 0, purchaseRetValue: 0,
                                        availableQty: 0, availableCost: 0, availableValue: 0,
                                        salesQty: 0, salesCost: 0, salesValue: 0,
                                        adjQty: 0, adjCost: 0, adjValue: 0,
                                        closingQty: 0, closingCost: 0, closingValue: 0,
                                    };

                                    return (
                                        <tr key={virtualRow.key} ref={rowVirtualizer.measureElement} data-index={virtualRow.index} className={style.className}>
                                            {!isArticle && !isVariant ? (
                                                <td colSpan={5} className={cn("p-2 border-r font-bold uppercase tracking-wider text-xs align-middle", style.indentClass)}>
                                                    {row.type.toUpperCase()}: {row.label}
                                                </td>
                                            ) : (
                                                <>
                                                    <td className="p-2 border-r"></td>
                                                    <td className="p-2 border-r"></td>
                                                    <td className={cn("p-2 border-r truncate max-w-[240px] align-middle", isArticle ? "flex flex-col font-bold text-slate-700 dark:text-slate-350" : "italic text-muted-foreground")}>
                                                        {isArticle ? (
                                                            <>
                                                                <span className="text-[9px] text-primary">{highlight('SKU: ' + (row.sku || ''), hlQuery)}</span>
                                                                <span>{highlight(row.label || '', hlQuery)}</span>
                                                            </>
                                                        ) : (
                                                            `Variant: ${row.color || 'Default'}${row.barCode ? ` (${row.barCode})` : ''}`
                                                        )}
                                                    </td>
                                                    <td className="p-2 border-r align-middle font-medium text-slate-600 dark:text-slate-400">{isArticle ? row.sku : (row.barCode || row.sku || "")}</td>
                                                    <td className="p-2 border-r align-middle text-center">
                                                        {isArticle ? (
                                                            <span className="text-[9px] text-muted-foreground uppercase font-bold bg-slate-50/20 px-1 py-0.5 rounded">All Sizes</span>
                                                        ) : (
                                                            <span className="font-semibold text-slate-750 dark:text-slate-350">{row.size}</span>
                                                        )}
                                                    </td>
                                                </>
                                            )}

                                            {/* Opening Stock */}
                                            <td className="p-2 text-right">{formatQty(totals.openingQty)}</td>
                                            <td className={cn("p-2 text-right", isGroup ? "text-slate-350" : "text-muted-foreground")}>{formatCost(totals.openingCost)}</td>
                                            <td className={cn("p-2 border-r text-right font-semibold", isGroup ? "text-slate-100" : "")}>{formatValue(totals.openingValue)}</td>

                                            {/* Purchases */}
                                            <td className={cn("p-2 text-right", !isGroup && "bg-emerald-500/5")}>{formatQty(totals.purchaseQty)}</td>
                                            <td className={cn("p-2 text-right", !isGroup && "bg-emerald-500/5", isGroup ? "text-slate-350" : "text-muted-foreground")}>{formatCost(totals.purchaseCost)}</td>
                                            <td className={cn("p-2 border-r text-right font-semibold", !isGroup && "bg-emerald-500/5", isGroup ? "text-emerald-300 font-bold" : "text-emerald-600")}>{formatValue(totals.purchaseValue)}</td>

                                            {/* Purchases Return */}
                                            <td className={cn("p-2 text-right", !isGroup && "bg-rose-500/5")}>{formatQty(totals.purchaseRetQty)}</td>
                                            <td className={cn("p-2 text-right", !isGroup && "bg-rose-500/5", isGroup ? "text-slate-350" : "text-muted-foreground")}>{formatCost(totals.purchaseRetCost)}</td>
                                            <td className={cn("p-2 border-r text-right font-semibold", !isGroup && "bg-rose-500/5", isGroup ? "text-rose-300 font-bold" : "text-rose-600")}>{formatValue(totals.purchaseRetValue)}</td>

                                            {/* Available */}
                                            <td className={cn("p-2 text-right", !isGroup && "bg-blue-500/5")}>{formatQty(totals.availableQty)}</td>
                                            <td className={cn("p-2 text-right", !isGroup && "bg-blue-500/5", isGroup ? "text-slate-350" : "text-muted-foreground")}>{formatCost(totals.availableCost)}</td>
                                            <td className={cn("p-2 border-r text-right font-bold", !isGroup && "bg-blue-500/5", isGroup ? "text-blue-300 font-black" : "text-blue-600")}>{formatValue(totals.availableValue)}</td>

                                            {/* Net Sale (COGS) */}
                                            <td className={cn("p-2 text-right", !isGroup && "bg-violet-500/5")}>{formatQty(totals.salesQty)}</td>
                                            <td className={cn("p-2 text-right", !isGroup && "bg-violet-500/5", isGroup ? "text-slate-350" : "text-muted-foreground")}>{formatCost(totals.salesCost)}</td>
                                            <td className={cn("p-2 border-r text-right font-semibold", !isGroup && "bg-violet-500/5", isGroup ? "text-violet-300 font-bold" : "text-violet-600")}>{formatValue(totals.salesValue)}</td>

                                            {/* Adjustment */}
                                            <td className="p-2 text-right">{formatQty(totals.adjQty)}</td>
                                            <td className={cn("p-2 text-right", isGroup ? "text-slate-350" : "text-muted-foreground")}>{formatCost(totals.adjCost)}</td>
                                            <td className={cn("p-2 border-r text-right font-semibold", isGroup ? "text-slate-100" : "")}>{formatValue(totals.adjValue)}</td>

                                            {/* Closing balance */}
                                            <td className={cn("p-2 text-right font-semibold", !isGroup && "bg-slate-500/5")}>{formatQty(totals.closingQty)}</td>
                                            <td className={cn("p-2 text-right", !isGroup && "bg-slate-500/5", isGroup ? "text-slate-350" : "text-muted-foreground")}>{formatCost(totals.closingCost)}</td>
                                            <td className={cn("p-2 text-right font-bold", !isGroup && "bg-slate-500/5", isGroup ? "text-slate-100" : "text-slate-700 dark:text-slate-300")}>{formatValue(totals.closingValue)}</td>
                                        </tr>

                                    );
                                })}
                                {paddingBottom > 0 && (
                                    <tr>
                                        <td colSpan={26} style={{ height: `${paddingBottom}px` }} />
                                    </tr>
                                )}
                            </>
                        )}
                    </tbody>

                    {/* GRAND TOTALS FOOTER ROW */}
                    {reportData.length > 0 && (
                        <tfoot className="sticky bottom-0 z-20 shadow-md">
                            <tr className="bg-slate-800 text-slate-100 font-extrabold border-t-2 border-slate-900 text-[10px]">
                                <td colSpan={5} className="p-3 border-r text-left uppercase tracking-wider font-black bg-slate-800">
                                    GRAND TOTALS
                                </td>
                                
                                <td className="p-3 text-right font-bold bg-slate-700/30">{formatQty(grandTotals.openingQty)}</td>
                                <td className="p-3 text-right text-slate-350 bg-slate-700/30">{formatCost(grandTotals.openingQty > 0 ? grandTotals.openingValue / grandTotals.openingQty : 0)}</td>
                                <td className="p-3 border-r text-right font-black bg-slate-700/50">{formatValue(grandTotals.openingValue)}</td>
                                
                                <td className="p-3 text-right font-bold bg-emerald-950/20">{formatQty(grandTotals.purchaseQty)}</td>
                                <td className="p-3 text-right text-slate-350 bg-emerald-950/20">{formatCost(grandTotals.purchaseQty > 0 ? grandTotals.purchaseValue / grandTotals.purchaseQty : 0)}</td>
                                <td className="p-3 border-r text-right font-black bg-emerald-950/30 text-emerald-450">{formatValue(grandTotals.purchaseValue)}</td>
                                
                                <td className="p-3 text-right font-bold bg-rose-950/20">{formatQty(grandTotals.purchaseRetQty)}</td>
                                <td className="p-3 text-right text-slate-350 bg-rose-950/20">{formatCost(grandTotals.purchaseRetQty > 0 ? grandTotals.purchaseRetValue / grandTotals.purchaseRetQty : 0)}</td>
                                <td className="p-3 border-r text-right font-black bg-rose-950/30 text-rose-450">{formatValue(grandTotals.purchaseRetValue)}</td>
                                
                                <td className="p-3 text-right font-bold bg-blue-950/20">{formatQty(grandTotals.availableQty)}</td>
                                <td className="p-3 text-right text-slate-350 bg-blue-950/20">{formatCost(grandTotals.availableQty > 0 ? grandTotals.availableValue / grandTotals.availableQty : 0)}</td>
                                <td className="p-3 border-r text-right font-black bg-blue-950/30 text-blue-450">{formatValue(grandTotals.availableValue)}</td>
                                
                                <td className="p-3 text-right font-bold bg-violet-950/20">{formatQty(grandTotals.salesQty)}</td>
                                <td className="p-3 text-right text-slate-350 bg-violet-950/20">{formatCost(grandTotals.salesQty > 0 ? grandTotals.salesValue / grandTotals.salesQty : 0)}</td>
                                <td className="p-3 border-r text-right font-black bg-violet-950/30 text-violet-450">{formatValue(grandTotals.salesValue)}</td>
                                
                                <td className="p-3 text-right font-bold bg-slate-700/30">{formatQty(grandTotals.adjQty)}</td>
                                <td className="p-3 text-right text-slate-350 bg-slate-700/30">{formatCost(grandTotals.adjQty !== 0 ? grandTotals.adjValue / grandTotals.adjQty : 0)}</td>
                                <td className="p-3 border-r text-right font-black bg-slate-700/50">{formatValue(grandTotals.adjValue)}</td>
                                
                                <td className="p-3 text-right font-bold bg-slate-900">{formatQty(grandTotals.closingQty)}</td>
                                <td className="p-3 text-right text-slate-350 bg-slate-900">{formatCost(grandTotals.closingQty > 0 ? grandTotals.closingValue / grandTotals.closingQty : 0)}</td>
                                <td className="p-3 text-right font-black bg-slate-950 text-white">{formatValue(grandTotals.closingValue)}</td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>

            {/* Downloader Fixed Overlay Screen */}
            {downloadingFile && (
                <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center pointer-events-auto">
                    <div className="bg-background border rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl flex flex-col items-center gap-4 text-center">
                        <div className="relative h-12 w-12 flex items-center justify-center">
                            <Loader2 className="h-8 w-8 text-primary animate-spin" />
                        </div>
                        <div className="space-y-1">
                            <h4 className="font-bold text-sm text-foreground">Preparing Download</h4>
                            <p className="text-xs text-muted-foreground break-all max-w-[280px]">
                                Downloading {downloadingFile}... Please wait.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* CSS Print Styles */}
            <style jsx global>{`
                @media print {
                    body {
                        background-color: white !important;
                        color: black !important;
                        font-size: 8px !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                    }
                    th, td {
                        border: 1px solid #cbd5e1 !important;
                        padding: 4px 3px !important;
                        font-size: 7px !important;
                        color: black !important;
                    }
                    tr {
                        page-break-inside: avoid !important;
                    }
                    thead {
                        display: table-header-group !important;
                    }
                }
            `}</style>
        </div>
    );
}
