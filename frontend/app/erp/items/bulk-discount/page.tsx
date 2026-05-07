'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

// ── UI ────────────────────────────────────────────────────────────────────────
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { DatePicker } from '@/components/ui/date-picker';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// ── Icons ─────────────────────────────────────────────────────────────────────
import {
    ArrowLeft, Filter, X, ChevronRight, Search, Tag,
    Loader2, Percent, DollarSign, CalendarRange, Square, AlertTriangle,
    Sparkles, RotateCcw, Info, MapPin, Store, CheckCircle2, History,
    Trash2, XCircle, Globe, Download, Undo2,
} from 'lucide-react';

// ── APIs & Actions ────────────────────────────────────────────────────────────
import {
    brandApi, categoryApi, silhouetteApi, genderApi,
    locationApi,
} from '@/lib/api';
import {
    getItems, getAllItemIds, bulkApplyDiscount, rollbackCampaign,
    getDiscountCampaigns,
    type BulkDiscountItemOverride,
} from '@/lib/actions/items';
import { PermissionGuard } from '@/components/auth/permission-guard';
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ItemRow {
    id: string;
    itemId: string;
    sku: string;
    description: string | null;
    unitPrice: number;
    discountRate: number | null;
    discountAmount: number | null;
    discountStartDate: string | null;
    discountEndDate: string | null;
    brand?: { name: string } | null;
    category?: { name: string } | null;
    brandId?: string;
    categoryId?: string;
    silhouetteId?: string;
    genderId?: string;
    isActive: boolean;
}

type DiscountType = 'percent' | 'fixed';
type StepId = 1 | 2 | 3 | 4;

interface Campaign {
    name: string;
    discountType: DiscountType;
    discountValue: string;
    startDate: string;
    endDate: string;
    notes: string;
    clearMode: boolean;
}

interface HistoryEntry {
    id: string;           // campaignId from DB
    name: string;
    discountType: DiscountType;
    discountValue: number;
    startDate: string;
    endDate: string;
    clearMode: boolean;
    itemCount: number;
    locationNames: string[];
    appliedAt: string;    // createdAt from DB
    snapshotCount: number; // how many items have snapshot data
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatPKR(n: number) {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 });
}

function effectivePrice(item: ItemRow, campaign: Campaign): number {
    if (campaign.clearMode) return item.unitPrice;
    const base = item.unitPrice;
    const val = parseFloat(campaign.discountValue) || 0;
    return campaign.discountType === 'percent'
        ? Math.max(0, base - base * (val / 100))
        : Math.max(0, base - val);
}

function hasActiveDiscount(item: ItemRow): boolean {
    return (item.discountRate ?? 0) > 0 || (item.discountAmount ?? 0) > 0;
}

function discountLabel(campaign: Campaign, val: number): string {
    if (campaign.clearMode) return 'Clear Discounts';
    return campaign.discountType === 'percent' ? `${val}% off` : `PKR ${val.toLocaleString()} off`;
}

// ── CSV export ────────────────────────────────────────────────────────────────

function exportToCSV(items: ItemRow[], campaign: Campaign, discountVal: number) {
    const headers = ['Item ID', 'SKU', 'Description', 'Brand', 'Category', 'Unit Price', 'Current Discount %', 'Current Discount Amt', 'After Discount Price'];
    const rows = items.map(item => [
        item.itemId,
        item.sku,
        item.description ?? '',
        item.brand?.name ?? '',
        item.category?.name ?? '',
        item.unitPrice,
        item.discountRate ?? 0,
        item.discountAmount ?? 0,
        campaign.clearMode ? item.unitPrice : effectivePrice(item, campaign),
    ]);

    const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${campaign.name.replace(/\s+/g, '_')}_items_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

const STEPS: { n: StepId; label: string }[] = [
    { n: 1, label: 'Campaign' },
    { n: 2, label: 'Select Items' },
    { n: 3, label: 'Locations' },
    { n: 4, label: 'Done' },
];

function StepIndicator({ step, current }: { step: number; current: number }) {
    const done = current > step;
    const active = current === step;
    return (
        <div className={cn(
            'flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold border-2 transition-all shrink-0',
            done && 'bg-primary border-primary text-primary-foreground',
            active && 'border-primary text-primary bg-primary/10',
            !done && !active && 'border-muted-foreground/30 text-muted-foreground',
        )}>
            {done ? '✓' : step}
        </div>
    );
}

// ─── Campaign Summary Bar ─────────────────────────────────────────────────────

function CampaignBar({ campaign, discountVal, onEdit }: {
    campaign: Campaign; discountVal: number; onEdit: () => void;
}) {
    return (
        <div className={cn(
            'flex items-center gap-3 p-3 rounded-lg border flex-wrap',
            campaign.clearMode ? 'bg-destructive/5 border-destructive/20' : 'bg-primary/5 border-primary/20',
        )}>
            {campaign.clearMode
                ? <XCircle className="h-4 w-4 text-destructive shrink-0" />
                : <Sparkles className="h-4 w-4 text-primary shrink-0" />}
            <span className="font-semibold text-sm">{campaign.name}</span>
            <Badge variant={campaign.clearMode ? 'destructive' : 'secondary'} className="font-mono">
                {discountLabel(campaign, discountVal)}
            </Badge>
            {!campaign.clearMode && campaign.startDate && campaign.endDate && (
                <span className="text-xs text-muted-foreground">
                    {format(new Date(campaign.startDate), 'dd MMM')} – {format(new Date(campaign.endDate), 'dd MMM yyyy')}
                </span>
            )}
            <div className="ml-auto">
                <Button variant="ghost" size="sm" onClick={onEdit}>
                    <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Edit Campaign
                </Button>
            </div>
        </div>
    );
}

// ─── Filter Sheet ─────────────────────────────────────────────────────────────

interface FilterSheetProps {
    open: boolean; onOpenChange: (v: boolean) => void;
    brands: any[]; categories: any[]; silhouettes: any[]; genders: any[];
    pendingBrandIds: string[]; pendingCategoryIds: string[];
    pendingSilhouetteIds: string[]; pendingGenderIds: string[];
    setPendingBrandIds: (v: string[]) => void; setPendingCategoryIds: (v: string[]) => void;
    setPendingSilhouetteIds: (v: string[]) => void; setPendingGenderIds: (v: string[]) => void;
    onApply: (f: { brandIds: string[]; categoryIds: string[]; silhouetteIds: string[]; genderIds: string[] }) => void;
    onClear: () => void;
}

function FilterSheet({
    open, onOpenChange, brands, categories, silhouettes, genders,
    pendingBrandIds, pendingCategoryIds, pendingSilhouetteIds, pendingGenderIds,
    setPendingBrandIds, setPendingCategoryIds, setPendingSilhouetteIds, setPendingGenderIds,
    onApply, onClear,
}: FilterSheetProps) {
    const [filterSearch, setFilterSearch] = useState('');
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
    const toggle = (k: string) => setCollapsed(p => ({ ...p, [k]: !p[k] }));

    const sections = [
        { key: 'brand', label: 'Brand', items: brands, ids: pendingBrandIds, setIds: setPendingBrandIds },
        { key: 'category', label: 'Category', items: categories, ids: pendingCategoryIds, setIds: setPendingCategoryIds },
        { key: 'silhouette', label: 'Silhouette', items: silhouettes, ids: pendingSilhouetteIds, setIds: setPendingSilhouetteIds },
        { key: 'gender', label: 'Gender', items: genders, ids: pendingGenderIds, setIds: setPendingGenderIds },
    ] as const;

    const totalPending = pendingBrandIds.length + pendingCategoryIds.length + pendingSilhouetteIds.length + pendingGenderIds.length;

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="w-90 sm:w-100 flex flex-col p-0">
                <SheetHeader className="px-5 pt-5 pb-3 border-b">
                    <SheetTitle className="flex items-center gap-2">
                        <Filter className="h-4 w-4 text-primary" />
                        Filter Items
                        {totalPending > 0 && (
                            <Badge className="h-5 text-[10px] px-1.5 bg-primary text-primary-foreground">{totalPending}</Badge>
                        )}
                    </SheetTitle>
                    <div className="relative mt-2">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input placeholder="Search across all filters..." value={filterSearch}
                            onChange={e => setFilterSearch(e.target.value)} className="pl-9 h-9 text-sm" />
                        {filterSearch && (
                            <button type="button" onClick={() => setFilterSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                                <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                            </button>
                        )}
                    </div>
                </SheetHeader>
                <ScrollArea className="flex-1 px-5 py-3">
                    <div className="space-y-3">
                        {sections.map(({ key, label, items, ids, setIds }) => {
                            const filtered = filterSearch
                                ? items.filter((i: any) => i.name.toLowerCase().includes(filterSearch.toLowerCase()))
                                : items;
                            if (filtered.length === 0) return null;
                            const isCollapsed = collapsed[key];
                            return (
                                <div key={key} className="rounded-md border border-border overflow-hidden">
                                    <button type="button" onClick={() => toggle(key)}
                                        className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/40 hover:bg-muted/70 transition-colors text-sm font-semibold">
                                        <div className="flex items-center gap-2">
                                            <span>{label}</span>
                                            {ids.length > 0 && <Badge variant="secondary" className="h-4 text-[10px] px-1">{ids.length}</Badge>}
                                        </div>
                                        <ChevronRight className={cn('h-4 w-4 text-muted-foreground transition-transform', !isCollapsed && 'rotate-90')} />
                                    </button>
                                    {!isCollapsed && (
                                        <div className="p-3">
                                            <ScrollArea className="h-40">
                                                <div className="flex flex-wrap gap-1.5 pr-3">
                                                    {filtered.map((item: any) => (
                                                        <button key={item.id} type="button"
                                                            onClick={() => (setIds as any)((prev: string[]) =>
                                                                prev.includes(item.id) ? prev.filter((x: string) => x !== item.id) : [...prev, item.id]
                                                            )}
                                                            className={cn(
                                                                'px-2.5 py-1 rounded-full text-xs border transition-all',
                                                                ids.includes(item.id)
                                                                    ? 'bg-primary text-primary-foreground border-primary font-semibold'
                                                                    : 'bg-background border-border hover:border-primary/60 hover:bg-primary/5',
                                                            )}
                                                        >{item.name}</button>
                                                    ))}
                                                </div>
                                            </ScrollArea>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>
                <SheetFooter className="px-5 py-4 border-t flex-row gap-2">
                    <Button className="flex-1" onClick={() => onApply({
                        brandIds: pendingBrandIds, categoryIds: pendingCategoryIds,
                        silhouetteIds: pendingSilhouetteIds, genderIds: pendingGenderIds,
                    })}>Apply Filters</Button>
                    <Button variant="outline" onClick={onClear}><X className="h-3.5 w-3.5 mr-1" /> Clear</Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BulkDiscountPage() {
    const searchParams = useSearchParams();
    const [step, setStep] = useState<StepId>(1);
    const [showHistory, setShowHistory] = useState(false);
    const [history, setHistory] = useState<HistoryEntry[]>([]);

    // ── Campaign — pre-fill from URL params when extending an existing campaign ──
    const extendId = searchParams.get('extend');
    const [campaign, setCampaign] = useState<Campaign>(() => {
        const type = searchParams.get('type') ?? 'percent';
        const rate = searchParams.get('rate') ?? '';
        const amount = searchParams.get('amount') ?? '';
        return {
            name: searchParams.get('name') ?? '',
            discountType: (type === 'fixed' ? 'fixed' : 'percent') as DiscountType,
            discountValue: type === 'percent' ? (rate !== '0' ? rate : '') : (amount !== '0' ? amount : ''),
            startDate: searchParams.get('startDate') ?? '',
            endDate: searchParams.get('endDate') ?? '',
            notes: '',
            clearMode: false,
        };
    });

    // ── Items ──────────────────────────────────────────────────────────────
    const [itemPage, setItemPage] = useState(1);
    const [itemSearch, setItemSearch] = useState('');
    const [searchInput, setSearchInput] = useState('');

    // ── Selection ──────────────────────────────────────────────────────────
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [overrides, setOverrides] = useState<Map<string, { discountRate?: number; discountAmount?: number }>>(new Map());
    const [selectAllPages, setSelectAllPages] = useState(false);
    const [selectAllLoading, setSelectAllLoading] = useState(false);

    // ── Item Filters ───────────────────────────────────────────────────────
    const [brands, setBrands] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [silhouettes, setSilhouettes] = useState<any[]>([]);
    const [genders, setGenders] = useState<any[]>([]);
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    // Pending = what's staged in the sheet; applied = what's sent to the API
    const [pendingBrandIds, setPendingBrandIds] = useState<string[]>([]);
    const [pendingCategoryIds, setPendingCategoryIds] = useState<string[]>([]);
    const [pendingSilhouetteIds, setPendingSilhouetteIds] = useState<string[]>([]);
    const [pendingGenderIds, setPendingGenderIds] = useState<string[]>([]);
    const [appliedFilters, setAppliedFilters] = useState<{
        brandIds: string[]; categoryIds: string[]; silhouetteIds: string[]; genderIds: string[];
    }>({ brandIds: [], categoryIds: [], silhouetteIds: [], genderIds: [] });

    // ── Locations (step 3) ─────────────────────────────────────────────────
    // Uses Location model (POS outlets) — flat list, no warehouse grouping
    const [locations, setLocations] = useState<any[]>([]);
    const [locationsLoading, setLocationsLoading] = useState(false);
    const [selectedLocationIds, setSelectedLocationIds] = useState<Set<string>>(new Set());
    const [locationSearch, setLocationSearch] = useState('');

    // ── Apply / Rollback ───────────────────────────────────────────────────
    const [applying, setApplying] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [rollbackEntry, setRollbackEntry] = useState<HistoryEntry | null>(null);
    const [rollingBack, setRollingBack] = useState(false);

    // ── Derived ────────────────────────────────────────────────────────────
    const activeFilterCount = appliedFilters.brandIds.length + appliedFilters.categoryIds.length +
        appliedFilters.silhouetteIds.length + appliedFilters.genderIds.length;
    const discountVal = parseFloat(campaign.discountValue) || 0;
    const campaignValid = campaign.name.trim().length > 0 && (campaign.clearMode || discountVal > 0);

    // ── React Query: items (step 2) ────────────────────────────────────────
    const queryClient = useQueryClient();
    const itemsQueryKey = ['bulk-discount-items', itemPage, itemSearch, appliedFilters] as const;

    const { data: itemsData, isLoading: itemsLoading, isFetching: itemsFetching } = useQuery({
        queryKey: itemsQueryKey,
        queryFn: () => getItems(itemPage, 50, itemSearch || undefined, 'createdAt', 'desc', {
            brandIds: appliedFilters.brandIds.length ? appliedFilters.brandIds : undefined,
            categoryIds: appliedFilters.categoryIds.length ? appliedFilters.categoryIds : undefined,
            silhouetteIds: appliedFilters.silhouetteIds.length ? appliedFilters.silhouetteIds : undefined,
            genderIds: appliedFilters.genderIds.length ? appliedFilters.genderIds : undefined,
        }),
        enabled: step === 2,
        placeholderData: keepPreviousData,
        staleTime: 30_000,
    });

    const allItems: ItemRow[] = itemsData?.data ?? [];
    const itemsMeta = { total: itemsData?.meta?.total ?? 0, totalPages: itemsData?.meta?.totalPages ?? 1 };

    // Prefetch next page
    useEffect(() => {
        if (step !== 2 || itemPage >= itemsMeta.totalPages) return;
        queryClient.prefetchQuery({
            queryKey: ['bulk-discount-items', itemPage + 1, itemSearch, appliedFilters],
            queryFn: () => getItems(itemPage + 1, 50, itemSearch || undefined, 'createdAt', 'desc', {
                brandIds: appliedFilters.brandIds.length ? appliedFilters.brandIds : undefined,
                categoryIds: appliedFilters.categoryIds.length ? appliedFilters.categoryIds : undefined,
                silhouetteIds: appliedFilters.silhouetteIds.length ? appliedFilters.silhouetteIds : undefined,
                genderIds: appliedFilters.genderIds.length ? appliedFilters.genderIds : undefined,
            }),
            staleTime: 30_000,
        });
    }, [step, itemPage, itemSearch, appliedFilters, itemsMeta.totalPages, queryClient]);

    const selectedItems = useMemo(() => allItems.filter(i => selectedIds.has(i.id)), [allItems, selectedIds]);
    const allPageSelected = allItems.length > 0 && allItems.every(i => selectedIds.has(i.id));
    const somePageSelected = allItems.some(i => selectedIds.has(i.id));

    const filteredLocations = useMemo(() => {
        if (!locationSearch.trim()) return locations;
        const q = locationSearch.toLowerCase();
        return locations.filter(l =>
            l.name.toLowerCase().includes(q) || l.code?.toLowerCase().includes(q)
        );
    }, [locations, locationSearch]);

    const selectedLocationNames = useMemo(() =>
        locations.filter(l => selectedLocationIds.has(l.id)).map(l => l.name),
        [locations, selectedLocationIds],
    );

    // ── Load master data ───────────────────────────────────────────────────
    useEffect(() => {
        getDiscountCampaigns(1, 20).then(res => {
            if (res.status && res.data) {
                setHistory(res.data.map((c: any) => ({
                    id: c.id,
                    name: c.name,
                    discountType: c.discountType === 'clear' ? 'percent' : c.discountType,
                    discountValue: c.discountRate || c.discountAmount || 0,
                    startDate: c.startDate ?? '',
                    endDate: c.endDate ?? '',
                    clearMode: c.clearMode,
                    itemCount: c.itemCount,
                    locationNames: (c.locations ?? []).map((l: any) => l.locationName ?? l.locationId),
                    appliedAt: c.createdAt,
                    snapshotCount: c._count?.items ?? 0,
                })));
            }
        });
        Promise.allSettled([brandApi.getAll(), categoryApi.getAll(), silhouetteApi.getAll(), genderApi.getAll()])
            .then(([b, c, s, g]) => {
                if (b.status === 'fulfilled' && b.value.status) setBrands(b.value.data);
                if (c.status === 'fulfilled' && c.value.status) setCategories(c.value.data);
                if (s.status === 'fulfilled' && s.value.status) setSilhouettes(s.value.data);
                if (g.status === 'fulfilled' && g.value.status) setGenders(g.value.data);
            });
    }, []);

    // ── Load locations (step 3) ────────────────────────────────────────────
    useEffect(() => {
        if (step !== 3) return;
        setLocationsLoading(true);
        locationApi.getAll()
            .then(res => { if (res.status) setLocations(res.data ?? []); })
            .catch(() => toast.error('Failed to load locations'))
            .finally(() => setLocationsLoading(false));
    }, [step]);

    // ── Handlers ───────────────────────────────────────────────────────────
    const toggleItem = (id: string) => {
        setSelectAllPages(false);
        setSelectedIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const togglePageAll = () => {
        setSelectAllPages(false);
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (allPageSelected) allItems.forEach(i => next.delete(i.id));
            else allItems.forEach(i => next.add(i.id));
            return next;
        });
    };

    // Fetch all IDs across all pages and select them (respects current search + filters)
    const handleSelectAllPages = async () => {
        if (selectAllPages) {
            setSelectedIds(new Set());
            setSelectAllPages(false);
            return;
        }
        setSelectAllLoading(true);
        try {
            const ids = await getAllItemIds(itemSearch || undefined, {
                brandIds: appliedFilters.brandIds.length ? appliedFilters.brandIds : undefined,
                categoryIds: appliedFilters.categoryIds.length ? appliedFilters.categoryIds : undefined,
                silhouetteIds: appliedFilters.silhouetteIds.length ? appliedFilters.silhouetteIds : undefined,
                genderIds: appliedFilters.genderIds.length ? appliedFilters.genderIds : undefined,
            });
            setSelectedIds(new Set(ids));
            setSelectAllPages(true);
            toast.success(`Selected all ${ids.length} items`);
        } catch {
            toast.error('Failed to select all items');
        } finally {
            setSelectAllLoading(false);
        }
    };

    const clearSelection = () => {
        setSelectedIds(new Set());
        setOverrides(new Map());
        setSelectAllPages(false);
    };

    const setOverride = (id: string, field: 'discountRate' | 'discountAmount', value: number | undefined) =>
        setOverrides(prev => {
            const next = new Map(prev);
            next.set(id, { ...(next.get(id) ?? {}), [field]: value });
            return next;
        });

    const toggleLocation = (id: string) => setSelectedLocationIds(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setItemPage(1);
        setSelectAllPages(false);
        setItemSearch(searchInput);
    };

    const handleApplyFilters = (filters: typeof appliedFilters) => {
        setAppliedFilters(filters);
        setItemPage(1);          // reset to page 1 when filters change
        setSelectAllPages(false);
        setIsFilterOpen(false);
    };

    const handleClearFilters = () => {
        setPendingBrandIds([]); setPendingCategoryIds([]);
        setPendingSilhouetteIds([]); setPendingGenderIds([]);
        setAppliedFilters({ brandIds: [], categoryIds: [], silhouetteIds: [], genderIds: [] });
        setItemPage(1);
        setSelectAllPages(false);
    };

    const handleApply = async () => {
        if (selectedIds.size === 0) return;
        setApplying(true);
        setConfirmOpen(false);
        try {
            const overrideList: BulkDiscountItemOverride[] = [];
            overrides.forEach((val, id) => { if (selectedIds.has(id)) overrideList.push({ id, ...val }); });

            const payload = {
                campaignName: campaign.name,
                itemIds: Array.from(selectedIds),
                notes: campaign.notes || undefined,
                locationIds: selectedLocationIds.size > 0 ? Array.from(selectedLocationIds) : undefined,
                locationNames: selectedLocationIds.size > 0 ? selectedLocationNames : undefined,
                ...(campaign.clearMode
                    ? { clearDiscount: true as const }
                    : {
                        ...(campaign.discountType === 'percent' ? { discountRate: discountVal } : { discountAmount: discountVal }),
                        ...(campaign.startDate && { discountStartDate: campaign.startDate }),
                        ...(campaign.endDate && { discountEndDate: campaign.endDate }),
                    }),
                ...(overrideList.length > 0 && { overrides: overrideList }),
            };

            const result = await bulkApplyDiscount(payload);
            if (result.status) {
                // Refresh history from DB
                const histRes = await getDiscountCampaigns(1, 20);
                if (histRes.status && histRes.data) {
                    setHistory(histRes.data.map((c: any) => ({
                        id: c.id,
                        name: c.name,
                        discountType: c.discountType === 'clear' ? 'percent' : c.discountType,
                        discountValue: c.discountRate || c.discountAmount || 0,
                        startDate: c.startDate ?? '',
                        endDate: c.endDate ?? '',
                        clearMode: c.clearMode,
                        itemCount: c.itemCount,
                        locationNames: (c.locations ?? []).map((l: any) => l.locationName ?? l.locationId),
                        appliedAt: c.createdAt,
                        snapshotCount: c._count?.items ?? 0,
                    })));
                }
                toast.success(`"${campaign.name}" applied to ${selectedIds.size} items`);
                setStep(4);
            } else {
                toast.error(result.message || 'Failed to apply discount');
            }
        } catch { toast.error('An unexpected error occurred'); }
        finally { setApplying(false); }
    };

    // Rollback: calls DB endpoint which restores snapshot and deletes campaign
    const handleRollback = async (entry: HistoryEntry) => {
        if (!entry.snapshotCount) {
            toast.error('No snapshot data available for this campaign.');
            return;
        }
        setRollingBack(true);
        try {
            const result = await rollbackCampaign(entry.id);
            if (result.status) {
                setHistory(prev => prev.filter(h => h.id !== entry.id));
                setRollbackEntry(null);
                toast.success(result.message || `Rolled back "${entry.name}"`);
            } else {
                toast.error(result.message || 'Rollback failed');
            }
        } catch { toast.error('Rollback failed'); }
        finally { setRollingBack(false); }
    };

    const resetAll = () => {
        setCampaign({ name: '', discountType: 'percent', discountValue: '', startDate: '', endDate: '', notes: '', clearMode: false });
        setSelectedIds(new Set()); setOverrides(new Map());
        setSelectedLocationIds(new Set());
        setLocationSearch('');
        setItemSearch(''); setSearchInput(''); setItemPage(1);
        setSelectAllPages(false);
        setAppliedFilters({ brandIds: [], categoryIds: [], silhouetteIds: [], genderIds: [] });
        setPendingBrandIds([]); setPendingCategoryIds([]);
        setPendingSilhouetteIds([]); setPendingGenderIds([]);
        setStep(1);
    };

    // ── Render ─────────────────────────────────────────────────────────────
    return (
        <PermissionGuard permissions={['erp.item.update']}>
            <div className="p-6 space-y-6 max-w-350 mx-auto">

                {/* ── Header ── */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                        <Link href="/erp/items/list" transitionTypes={['nav-back']}>
                            <Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
                        </Link>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                                {/* <Sparkles className="h-7 w-7 text-primary" /> */}
                                Bulk Discount
                            </h1>
                            <p className="text-muted-foreground text-sm mt-0.5">
                                Create a campaign, select items, scope to locations, and apply in one shot.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <Button variant="outline" size="sm" onClick={() => setShowHistory(p => !p)} className="gap-1.5">
                            <History className="h-4 w-4" />
                            History
                            {history.length > 0 && <Badge variant="secondary" className="h-4 text-[10px] px-1">{history.length}</Badge>}
                        </Button>
                        <div className="hidden md:flex items-center gap-2">
                            {STEPS.map(({ n, label }, idx) => (
                                <div key={n} className="flex items-center gap-2">
                                    {idx > 0 && <div className={cn('h-px w-6 transition-colors', step > idx ? 'bg-primary' : 'bg-border')} />}
                                    <div className="flex items-center gap-1.5">
                                        <StepIndicator step={n} current={step} />
                                        <span className={cn('text-sm font-medium', step === n ? 'text-foreground' : 'text-muted-foreground')}>
                                            {label}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── History panel ── */}
                {showHistory && (
                    <Card className="border-dashed">
                        <CardHeader className="pb-3 flex flex-row items-center justify-between">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <History className="h-4 w-4 text-muted-foreground" />
                                Recent Campaigns
                                <span className="text-xs font-normal text-muted-foreground">(stored in DB — rollback restores pre-apply state)</span>
                            </CardTitle>
                        </CardHeader>                        <CardContent className="p-0">
                            {history.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-6">No campaigns applied yet.</p>
                            ) : (
                                <div className="divide-y">
                                    {history.map(h => (
                                        <div key={h.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                                            <div className={cn(
                                                'flex items-center justify-center w-8 h-8 rounded-full shrink-0',
                                                h.clearMode ? 'bg-destructive/10' : 'bg-primary/10',
                                            )}>
                                                {h.clearMode
                                                    ? <XCircle className="h-4 w-4 text-destructive" />
                                                    : <Sparkles className="h-4 w-4 text-primary" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold truncate">{h.name}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {h.clearMode ? 'Cleared discounts' : h.discountType === 'percent' ? `${h.discountValue}% off` : `PKR ${h.discountValue.toLocaleString()} off`}
                                                    {' · '}{h.itemCount} items
                                                    {h.locationNames.length > 0 && ` · ${h.locationNames.slice(0, 2).join(', ')}${h.locationNames.length > 2 ? ` +${h.locationNames.length - 2}` : ''}`}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="text-xs text-muted-foreground">
                                                    {format(new Date(h.appliedAt), 'dd MMM, HH:mm')}
                                                </span>
                                                {/* Rollback button — only if snapshot exists */}
                                                {h.snapshotCount > 0 && (
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <Button variant="ghost" size="sm"
                                                                className="h-7 px-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                                                onClick={() => setRollbackEntry(h)}>
                                                                <Undo2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </TooltipTrigger>
                                                        <TooltipContent>Rollback — restore {h.snapshotCount} items to their previous discount state</TooltipContent>
                                                    </Tooltip>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* ══════════════════════════════════════════════════════════
                    STEP 1 — Campaign Definition
                ══════════════════════════════════════════════════════════ */}
                {step === 1 && (
                    <div className="max-w-2xl mx-auto">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <Tag className="h-5 w-5 text-primary" />
                                    {extendId ? 'Extend Campaign — Add More Items' : 'Define Your Campaign'}
                                </CardTitle>
                                <p className="text-sm text-muted-foreground">
                                    {extendId
                                        ? 'You are adding more items to an existing campaign. The discount settings below are pre-filled from the original campaign — adjust if needed.'
                                        : 'Name the campaign and set the discount rules. You can override individual items in the next step.'}
                                </p>
                            </CardHeader>
                            <CardContent className="space-y-6">

                                {/* Clear mode toggle */}
                                <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                                    <Checkbox id="clear-mode" checked={campaign.clearMode}
                                        onCheckedChange={v => setCampaign(p => ({ ...p, clearMode: !!v }))} />
                                    <div>
                                        <Label htmlFor="clear-mode" className="font-semibold cursor-pointer">
                                            Clear Mode — remove existing discounts
                                        </Label>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            Resets discountRate, discountAmount and dates to zero on selected items.
                                        </p>
                                    </div>
                                </div>

                                {/* Name */}
                                <div className="space-y-2">
                                    <Label htmlFor="campaign-name">Campaign Name <span className="text-destructive">*</span></Label>
                                    <Input id="campaign-name"
                                        placeholder="e.g. Summer Sale 2026, End of Season Clearance..."
                                        value={campaign.name}
                                        onChange={e => setCampaign(p => ({ ...p, name: e.target.value }))}
                                        className="text-base" />
                                </div>

                                {!campaign.clearMode && (
                                    <>
                                        {/* Discount type */}
                                        <div className="space-y-2">
                                            <Label>Discount Type <span className="text-destructive">*</span></Label>
                                            <div className="grid grid-cols-2 gap-3">
                                                {([
                                                    { type: 'percent' as DiscountType, icon: Percent, title: 'Percentage', sub: 'e.g. 20% off' },
                                                    { type: 'fixed' as DiscountType, icon: DollarSign, title: 'Fixed Amount', sub: 'e.g. PKR 500 off' },
                                                ] as const).map(({ type, icon: Icon, title, sub }) => (
                                                    <button key={type} type="button"
                                                        onClick={() => setCampaign(p => ({ ...p, discountType: type }))}
                                                        className={cn(
                                                            'flex items-center gap-3 p-4 rounded-lg border-2 transition-all text-left',
                                                            campaign.discountType === type ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40',
                                                        )}>
                                                        <div className={cn(
                                                            'flex items-center justify-center w-10 h-10 rounded-full',
                                                            campaign.discountType === type ? 'bg-primary text-primary-foreground' : 'bg-muted',
                                                        )}>
                                                            <Icon className="h-5 w-5" />
                                                        </div>
                                                        <div>
                                                            <p className="font-semibold text-sm">{title}</p>
                                                            <p className="text-xs text-muted-foreground">{sub}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Discount value */}
                                        <div className="space-y-2">
                                            <Label htmlFor="discount-value">
                                                {campaign.discountType === 'percent' ? 'Discount Percentage' : 'Discount Amount (PKR)'}
                                                <span className="text-destructive"> *</span>
                                            </Label>
                                            <div className="relative">
                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">
                                                    {campaign.discountType === 'percent' ? '%' : '₨'}
                                                </span>
                                                <Input id="discount-value" type="number" min={0}
                                                    max={campaign.discountType === 'percent' ? 100 : undefined}
                                                    step={campaign.discountType === 'percent' ? 0.5 : 1}
                                                    placeholder={campaign.discountType === 'percent' ? '0 – 100' : '0'}
                                                    value={campaign.discountValue}
                                                    onChange={e => setCampaign(p => ({ ...p, discountValue: e.target.value }))}
                                                    className="pl-8" />
                                            </div>
                                            {campaign.discountType === 'percent' && discountVal > 100 && (
                                                <p className="text-xs text-destructive flex items-center gap-1">
                                                    <AlertTriangle className="h-3 w-3" /> Percentage cannot exceed 100%
                                                </p>
                                            )}
                                        </div>

                                        {/* Date range */}
                                        <div className="space-y-2">
                                            <Label className="flex items-center gap-1.5">
                                                <CalendarRange className="h-4 w-4 text-muted-foreground" />
                                                Validity Period
                                                <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                                            </Label>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div className="space-y-1">
                                                    <p className="text-xs text-muted-foreground">Start Date</p>
                                                    <DatePicker value={campaign.startDate}
                                                        onChange={v => setCampaign(p => ({ ...p, startDate: v }))} placeholder="From" />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs text-muted-foreground">End Date</p>
                                                    <DatePicker value={campaign.endDate}
                                                        onChange={v => setCampaign(p => ({ ...p, endDate: v }))} placeholder="Until" />
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* Notes */}
                                <div className="space-y-2">
                                    <Label htmlFor="campaign-notes">
                                        Notes <span className="text-muted-foreground font-normal text-xs">(optional)</span>
                                    </Label>
                                    <Input id="campaign-notes" placeholder="Internal notes about this campaign..."
                                        value={campaign.notes}
                                        onChange={e => setCampaign(p => ({ ...p, notes: e.target.value }))} />
                                </div>

                                {/* Preview pill */}
                                {campaignValid && (
                                    <div className={cn(
                                        'flex items-center gap-2 p-3 rounded-lg border',
                                        campaign.clearMode ? 'bg-destructive/5 border-destructive/20' : 'bg-primary/5 border-primary/20',
                                    )}>
                                        {campaign.clearMode
                                            ? <XCircle className="h-4 w-4 text-destructive shrink-0" />
                                            : <Sparkles className="h-4 w-4 text-primary shrink-0" />}
                                        <p className="text-sm">
                                            <span className="font-semibold">{campaign.name}</span>
                                            {' — '}{discountLabel(campaign, discountVal)}
                                            {!campaign.clearMode && campaign.startDate && campaign.endDate && (
                                                <span className="text-muted-foreground">
                                                    {' · '}{format(new Date(campaign.startDate), 'dd MMM')} – {format(new Date(campaign.endDate), 'dd MMM yyyy')}
                                                </span>
                                            )}
                                        </p>
                                    </div>
                                )}

                                <Button className="w-full" size="lg"
                                    disabled={!campaignValid || (!campaign.clearMode && campaign.discountType === 'percent' && discountVal > 100)}
                                    onClick={() => setStep(2)}>
                                    Continue — Select Items
                                    <ChevronRight className="h-4 w-4 ml-2" />
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════
                    STEP 2 — Item Selection
                ══════════════════════════════════════════════════════════ */}
                {step === 2 && (
                    <div className="space-y-4">
                        <CampaignBar campaign={campaign} discountVal={discountVal} onEdit={() => setStep(1)} />

                        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">

                            {/* ── Item table ── */}
                            <Card className="xl:col-span-3">
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between flex-wrap gap-3">
                                        <CardTitle className="text-base">
                                            Items Catalog
                                            <span className="ml-2 text-sm font-normal text-muted-foreground">
                                                {itemsMeta.total.toLocaleString()} total
                                            </span>
                                            {itemsFetching && !itemsLoading && (
                                                <span className="ml-2 inline-flex items-center gap-1 text-xs text-primary">
                                                    <Loader2 className="h-3 w-3 animate-spin" /> Updating...
                                                </span>
                                            )}
                                        </CardTitle>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {/* Search */}
                                            <form onSubmit={handleSearchSubmit} className="flex items-center gap-1">
                                                <div className="relative">
                                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                                    <Input placeholder="Search items..." value={searchInput}
                                                        onChange={e => setSearchInput(e.target.value)}
                                                        className="pl-8 h-8 w-48 text-sm" />
                                                    {searchInput && (
                                                        <button type="button" onClick={() => { setSearchInput(''); setItemSearch(''); setItemPage(1); }}
                                                            className="absolute right-2 top-1/2 -translate-y-1/2">
                                                            <X className="h-3 w-3 text-muted-foreground" />
                                                        </button>
                                                    )}
                                                </div>
                                                <Button type="submit" size="sm" variant="outline" className="h-8 px-2">
                                                    <Search className="h-3.5 w-3.5" />
                                                </Button>
                                            </form>

                                            {/* Filter trigger */}
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div className="relative inline-flex">
                                                        <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5"
                                                            onClick={() => {
                                                                setPendingBrandIds(appliedFilters.brandIds);
                                                                setPendingCategoryIds(appliedFilters.categoryIds);
                                                                setPendingSilhouetteIds(appliedFilters.silhouetteIds);
                                                                setPendingGenderIds(appliedFilters.genderIds);
                                                                setIsFilterOpen(true);
                                                            }}>
                                                            <Filter className="h-3.5 w-3.5" /> Filter
                                                        </Button>
                                                        {activeFilterCount > 0 && (
                                                            <span className="absolute -top-2 -right-2 h-5 min-w-5 px-1 rounded-full text-[10px] font-bold bg-primary text-primary-foreground flex items-center justify-center">
                                                                {activeFilterCount}
                                                            </span>
                                                        )}
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent>Filter by brand, category, silhouette or gender</TooltipContent>
                                            </Tooltip>

                                            {activeFilterCount > 0 && (
                                                <button type="button" onClick={handleClearFilters}
                                                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors">
                                                    <X className="h-3 w-3" /> Clear filters
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* ── Select-all-pages banner ── */}
                                    {allPageSelected && itemsMeta.totalPages > 1 && !selectAllPages && (
                                        <div className="mt-3 flex items-center gap-2 p-2.5 rounded-md bg-primary/5 border border-primary/20 text-sm">
                                            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                                            <span>All <strong>{allItems.length}</strong> items on this page are selected.</span>
                                            <button type="button" onClick={handleSelectAllPages}
                                                className="ml-1 text-primary font-semibold hover:underline flex items-center gap-1">
                                                {selectAllLoading
                                                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...</>
                                                    : <>Select all {itemsMeta.total.toLocaleString()} items</>}
                                            </button>
                                        </div>
                                    )}
                                    {selectAllPages && (
                                        <div className="mt-3 flex items-center gap-2 p-2.5 rounded-md bg-primary/5 border border-primary/20 text-sm">
                                            <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                                            <span>All <strong>{selectedIds.size.toLocaleString()}</strong> items are selected.</span>
                                            <button type="button" onClick={() => { setSelectedIds(new Set()); setSelectAllPages(false); }}
                                                className="ml-1 text-muted-foreground hover:text-destructive font-semibold hover:underline">
                                                Clear selection
                                            </button>
                                        </div>
                                    )}
                                </CardHeader>

                                <CardContent className="p-0">
                                    <div className="border-t">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="hover:bg-transparent">
                                                    <TableHead className="w-10 pl-4">
                                                        <Checkbox
                                                            checked={allPageSelected}
                                                            data-state={somePageSelected && !allPageSelected ? 'indeterminate' : allPageSelected ? 'checked' : 'unchecked'}
                                                            onCheckedChange={togglePageAll}
                                                            aria-label="Select all on page"
                                                        />
                                                    </TableHead>
                                                    <TableHead>Item ID</TableHead>
                                                    <TableHead>SKU</TableHead>
                                                    <TableHead>Description</TableHead>
                                                    <TableHead>Brand</TableHead>
                                                    <TableHead>Category</TableHead>
                                                    <TableHead className="text-right">Price</TableHead>
                                                    <TableHead className="text-right">Cur. Disc.</TableHead>
                                                    {!campaign.clearMode && <TableHead className="text-right">After</TableHead>}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {itemsLoading ? (
                                                    Array.from({ length: 8 }).map((_, i) => (
                                                        <TableRow key={i}>
                                                            {Array.from({ length: 8 }).map((_, j) => (
                                                                <TableCell key={j}><div className="h-4 bg-muted animate-pulse rounded" /></TableCell>
                                                            ))}
                                                        </TableRow>
                                                    ))
                                                ) : allItems.length === 0 ? (
                                                    <TableRow>
                                                        <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                                                            No items found. Try adjusting your search or filters.
                                                        </TableCell>
                                                    </TableRow>
                                                ) : (
                                                    allItems.map(item => {
                                                        const selected = selectedIds.has(item.id);
                                                        const after = effectivePrice(item, campaign);
                                                        const conflict = hasActiveDiscount(item);
                                                        return (
                                                            <TableRow key={item.id}
                                                                className={cn('cursor-pointer transition-colors', selected && 'bg-primary/5 hover:bg-primary/8')}
                                                                onClick={() => toggleItem(item.id)}>
                                                                <TableCell className="pl-4" onClick={e => e.stopPropagation()}>
                                                                    <Checkbox checked={selected} onCheckedChange={() => toggleItem(item.id)} aria-label={`Select ${item.sku}`} />
                                                                </TableCell>
                                                                <TableCell><span className="font-mono text-xs">{item.itemId}</span></TableCell>
                                                                <TableCell><span className="font-mono text-xs text-muted-foreground">{item.sku}</span></TableCell>
                                                                <TableCell className="max-w-50">
                                                                    <span className="truncate block text-sm">{item.description ?? '—'}</span>
                                                                </TableCell>
                                                                <TableCell><span className="text-sm">{item.brand?.name ?? '—'}</span></TableCell>
                                                                <TableCell><span className="text-sm">{item.category?.name ?? '—'}</span></TableCell>
                                                                <TableCell className="text-right font-mono text-sm">{formatPKR(item.unitPrice)}</TableCell>
                                                                <TableCell className="text-right">
                                                                    {conflict ? (
                                                                        <Tooltip>
                                                                            <TooltipTrigger asChild>
                                                                                <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 gap-1 cursor-help">
                                                                                    <AlertTriangle className="h-3 w-3" />
                                                                                    {item.discountRate ? `${item.discountRate}%` : formatPKR(item.discountAmount ?? 0)}
                                                                                </Badge>
                                                                            </TooltipTrigger>
                                                                            <TooltipContent>Already has a discount — will be overwritten.</TooltipContent>
                                                                        </Tooltip>
                                                                    ) : <span className="text-muted-foreground text-xs">—</span>}
                                                                </TableCell>
                                                                {!campaign.clearMode && (
                                                                    <TableCell className="text-right">
                                                                        {selected
                                                                            ? <span className="font-mono text-sm font-semibold text-primary">{formatPKR(after)}</span>
                                                                            : <span className="text-muted-foreground text-xs">—</span>}
                                                                    </TableCell>
                                                                )}
                                                            </TableRow>
                                                        );
                                                    })
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>

                                    {/* Pagination */}
                                    {itemsMeta.totalPages > 1 && (
                                        <div className="flex items-center justify-between px-4 py-3 border-t text-sm text-muted-foreground">
                                            <span>Page {itemPage} of {itemsMeta.totalPages}</span>
                                            <div className="flex gap-2">
                                                <Button variant="outline" size="sm" disabled={itemPage <= 1} onClick={() => setItemPage(p => p - 1)}>Previous</Button>
                                                <Button variant="outline" size="sm" disabled={itemPage >= itemsMeta.totalPages} onClick={() => setItemPage(p => p + 1)}>Next</Button>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* ── Selection summary ── */}
                            <div className="space-y-4">
                                <Card className="sticky top-4">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base flex items-center justify-between">
                                            <span>Selected</span>
                                            <Badge className="text-sm px-2">{selectedIds.size}</Badge>
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {selectedIds.size === 0 ? (
                                            <div className="text-center py-6 text-muted-foreground text-sm">
                                                <Square className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                                Click rows to select items
                                            </div>
                                        ) : (
                                            <>
                                                <ScrollArea className="h-70">
                                                    <div className="space-y-1.5 pr-2">
                                                        {selectAllPages ? (
                                                            <div className="flex items-center gap-2 p-3 rounded-md bg-primary/5 border border-primary/20">
                                                                <Globe className="h-4 w-4 text-primary shrink-0" />
                                                                <p className="text-xs text-primary font-semibold">
                                                                    All {selectedIds.size.toLocaleString()} items selected across all pages
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            selectedItems.map(item => {
                                                                const ov = overrides.get(item.id);
                                                                const ovVal = campaign.discountType === 'percent' ? ov?.discountRate : ov?.discountAmount;
                                                                return (
                                                                    <div key={item.id} className="flex items-start gap-2 p-2 rounded-md bg-muted/40 group">
                                                                        <div className="flex-1 min-w-0">
                                                                            <p className="text-xs font-mono truncate">{item.sku}</p>
                                                                            <p className="text-[11px] text-muted-foreground truncate">{item.description ?? item.itemId}</p>
                                                                            {!campaign.clearMode && (
                                                                                <div className="mt-1.5 flex items-center gap-1">
                                                                                    <span className="text-[10px] text-muted-foreground">Override:</span>
                                                                                    <Input type="number" min={0}
                                                                                        placeholder={campaign.discountValue || '—'}
                                                                                        value={ovVal ?? ''}
                                                                                        onChange={e => {
                                                                                            const v = e.target.value === '' ? undefined : parseFloat(e.target.value);
                                                                                            setOverride(item.id, campaign.discountType === 'percent' ? 'discountRate' : 'discountAmount', v);
                                                                                        }}
                                                                                        className="h-5 text-[10px] px-1.5 py-0 w-20"
                                                                                        onClick={e => e.stopPropagation()} />
                                                                                    {ovVal !== undefined && (
                                                                                        <span className="text-[10px] text-primary font-semibold">
                                                                                            {campaign.discountType === 'percent' ? `${ovVal}%` : `₨${ovVal}`}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        <button type="button" onClick={e => { e.stopPropagation(); toggleItem(item.id); }}
                                                                            className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive mt-0.5">
                                                                            <X className="h-3.5 w-3.5" />
                                                                        </button>
                                                                    </div>
                                                                );
                                                            })
                                                        )}
                                                    </div>
                                                </ScrollArea>

                                                <Separator />

                                                {selectedItems.some(hasActiveDiscount) && (
                                                    <div className="flex items-start gap-2 p-2.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800">
                                                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                                                        <p className="text-xs">
                                                            {selectedItems.filter(hasActiveDiscount).length} item(s) already have a discount — will be overwritten.
                                                        </p>
                                                    </div>
                                                )}

                                                <div className="space-y-1.5 text-sm">
                                                    <div className="flex justify-between text-muted-foreground">
                                                        <span>Items selected</span>
                                                        <span className="font-semibold text-foreground">{selectedIds.size.toLocaleString()}</span>
                                                    </div>
                                                    {!campaign.clearMode && (
                                                        <div className="flex justify-between text-muted-foreground">
                                                            <span>Discount</span>
                                                            <span className="font-semibold text-primary">{discountLabel(campaign, discountVal)}</span>
                                                        </div>
                                                    )}
                                                    {overrides.size > 0 && (
                                                        <div className="flex justify-between text-muted-foreground">
                                                            <span>With overrides</span>
                                                            <span className="font-semibold text-foreground">{overrides.size}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="space-y-2 pt-1">
                                                    {/* Export CSV */}
                                                    {selectedItems.length > 0 && !selectAllPages && (
                                                        <Button variant="outline" size="sm" className="w-full gap-1.5 text-muted-foreground"
                                                            onClick={() => exportToCSV(selectedItems, campaign, discountVal)}>
                                                            <Download className="h-3.5 w-3.5" />
                                                            Export {selectedItems.length} items to CSV
                                                        </Button>
                                                    )}
                                                    <Button className="w-full" disabled={selectedIds.size === 0} onClick={() => setStep(3)}>
                                                        Continue — Scope Locations
                                                        <ChevronRight className="h-4 w-4 ml-2" />
                                                    </Button>
                                                    <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={clearSelection}>
                                                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Clear Selection
                                                    </Button>
                                                </div>
                                            </>
                                        )}
                                    </CardContent>
                                </Card>

                                <Card className="border-dashed">
                                    <CardContent className="pt-4 pb-4">
                                        <div className="flex items-start gap-2 text-muted-foreground">
                                            <Info className="h-4 w-4 shrink-0 mt-0.5" />
                                            <p className="text-xs leading-relaxed">
                                                Use the <strong>Override</strong> field to set a different discount for a specific item. Leave blank to use the campaign default.
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════
                    STEP 3 — Location Scope
                ══════════════════════════════════════════════════════════ */}
                {step === 3 && (
                    <div className="space-y-4">
                        <CampaignBar campaign={campaign} discountVal={discountVal} onEdit={() => setStep(1)} />

                        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">

                            {/* ── Location flat list ── */}
                            <Card className="xl:col-span-3">
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between flex-wrap gap-3">
                                        <div>
                                            <CardTitle className="text-base flex items-center gap-2">
                                                <MapPin className="h-4 w-4 text-primary" />
                                                Location Scope
                                                <Badge variant="secondary" className="font-normal text-xs">Optional</Badge>
                                            </CardTitle>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Tag which outlets or counters this campaign applies to. This is informational — the discount is applied at item level regardless.
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="relative">
                                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                                <Input placeholder="Search locations..."
                                                    value={locationSearch}
                                                    onChange={e => setLocationSearch(e.target.value)}
                                                    className="pl-8 h-8 w-48 text-sm" />
                                                {locationSearch && (
                                                    <button type="button" onClick={() => setLocationSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                                                        <X className="h-3 w-3 text-muted-foreground" />
                                                    </button>
                                                )}
                                            </div>
                                            <Button variant="outline" size="sm" className="h-8 text-xs gap-1"
                                                onClick={() => setSelectedLocationIds(new Set(locations.map(l => l.id)))}>
                                                <Globe className="h-3.5 w-3.5" /> All
                                            </Button>
                                            {selectedLocationIds.size > 0 && (
                                                <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-muted-foreground"
                                                    onClick={() => setSelectedLocationIds(new Set())}>
                                                    <X className="h-3.5 w-3.5" /> Clear
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </CardHeader>

                                <CardContent className="p-0">
                                    {locationsLoading ? (
                                        <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                            <span className="text-sm">Loading locations...</span>
                                        </div>
                                    ) : filteredLocations.length === 0 ? (
                                        <div className="text-center py-12 text-muted-foreground text-sm">
                                            {locationSearch ? `No locations match "${locationSearch}"` : 'No locations found.'}
                                        </div>
                                    ) : (
                                        <div className="divide-y">
                                            {filteredLocations.map(loc => {
                                                const selected = selectedLocationIds.has(loc.id);
                                                return (
                                                    <div key={loc.id}
                                                        className={cn(
                                                            'flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-muted/40 transition-colors',
                                                            selected && 'bg-primary/5',
                                                            loc.status !== 'active' && 'opacity-60',
                                                        )}
                                                        onClick={() => toggleLocation(loc.id)}>
                                                        <Checkbox
                                                            checked={selected}
                                                            onCheckedChange={() => toggleLocation(loc.id)}
                                                            onClick={e => e.stopPropagation()}
                                                        />
                                                        <Store className="h-4 w-4 text-muted-foreground shrink-0" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium truncate">{loc.name}</p>
                                                            {loc.code && (
                                                                <p className="text-xs text-muted-foreground font-mono">{loc.code}</p>
                                                            )}
                                                        </div>
                                                        {loc.status !== 'active' && (
                                                            <Badge variant="outline" className="text-[10px] px-1.5 text-muted-foreground shrink-0">
                                                                Inactive
                                                            </Badge>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* ── Right: Review & Apply ── */}
                            <div className="space-y-4">
                                <Card className="sticky top-4">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-base">Review & Apply</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Campaign</span>
                                                <span className="font-semibold truncate max-w-32 text-right">{campaign.name}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Discount</span>
                                                <span className={cn('font-semibold', campaign.clearMode ? 'text-destructive' : 'text-primary')}>
                                                    {discountLabel(campaign, discountVal)}
                                                </span>
                                            </div>
                                            {!campaign.clearMode && campaign.startDate && (
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">From</span>
                                                    <span className="font-semibold">{format(new Date(campaign.startDate), 'dd MMM yyyy')}</span>
                                                </div>
                                            )}
                                            {!campaign.clearMode && campaign.endDate && (
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">Until</span>
                                                    <span className="font-semibold">{format(new Date(campaign.endDate), 'dd MMM yyyy')}</span>
                                                </div>
                                            )}
                                        </div>
                                        <Separator />
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Items</span>
                                                <span className="font-bold text-lg leading-none">{selectedIds.size.toLocaleString()}</span>
                                            </div>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">Locations tagged</span>
                                                <span className="font-semibold">
                                                    {selectedLocationIds.size === 0
                                                        ? <span className="text-muted-foreground font-normal">All (global)</span>
                                                        : selectedLocationIds.size}
                                                </span>
                                            </div>
                                        </div>
                                        {selectedLocationIds.size > 0 && (
                                            <div className="flex flex-wrap gap-1.5">
                                                {selectedLocationNames.slice(0, 6).map(name => (
                                                    <Badge key={name} variant="secondary" className="text-xs">{name}</Badge>
                                                ))}
                                                {selectedLocationNames.length > 6 && (
                                                    <Badge variant="outline" className="text-xs">+{selectedLocationNames.length - 6} more</Badge>
                                                )}
                                            </div>
                                        )}
                                        {selectedLocationIds.size === 0 && (
                                            <div className="flex items-start gap-2 p-2.5 rounded-md bg-muted/50 border border-border">
                                                <Globe className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                                                <p className="text-xs text-muted-foreground">
                                                    No locations selected — discount will apply globally to all selected items.
                                                </p>
                                            </div>
                                        )}
                                        <Separator />
                                        <div className="space-y-2">
                                            <Button className="w-full" onClick={() => setConfirmOpen(true)} disabled={selectedIds.size === 0}>
                                                {campaign.clearMode
                                                    ? <><Trash2 className="h-4 w-4 mr-2" /> Clear Discounts</>
                                                    : <><Sparkles className="h-4 w-4 mr-2" /> Apply Discount</>}
                                            </Button>
                                            <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setStep(2)}>
                                                <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back to Items
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </div>
                )}

                {/* ══════════════════════════════════════════════════════════
                    STEP 4 — Done
                ══════════════════════════════════════════════════════════ */}
                {step === 4 && (
                    <div className="max-w-lg mx-auto">
                        <Card>
                            <CardContent className="pt-10 pb-10 text-center space-y-5">
                                <div className={cn(
                                    'flex items-center justify-center w-16 h-16 rounded-full mx-auto',
                                    campaign.clearMode ? 'bg-destructive/10' : 'bg-primary/10',
                                )}>
                                    {campaign.clearMode
                                        ? <CheckCircle2 className="h-8 w-8 text-destructive" />
                                        : <Sparkles className="h-8 w-8 text-primary" />}
                                </div>
                                <div>
                                    <h2 className="text-2xl font-bold">
                                        {campaign.clearMode ? 'Discounts Cleared!' : 'Campaign Applied!'}
                                    </h2>
                                    <p className="text-muted-foreground mt-1">
                                        <span className="font-semibold text-foreground">{campaign.name}</span>
                                        {' was applied to '}
                                        <span className="font-semibold text-foreground">{selectedIds.size.toLocaleString()} items</span>
                                        {selectedLocationIds.size > 0 && (
                                            <> across <span className="font-semibold text-foreground">{selectedLocationIds.size} location{selectedLocationIds.size !== 1 ? 's' : ''}</span></>
                                        )}.
                                    </p>
                                </div>

                                <div className="flex items-center justify-center gap-4 p-4 rounded-lg bg-muted/50 text-sm flex-wrap">
                                    <div className="text-center">
                                        <p className={cn('text-2xl font-bold', campaign.clearMode ? 'text-destructive' : 'text-primary')}>
                                            {campaign.clearMode ? '—' : campaign.discountType === 'percent' ? `${discountVal}%` : `PKR ${discountVal.toLocaleString()}`}
                                        </p>
                                        <p className="text-xs text-muted-foreground">Discount</p>
                                    </div>
                                    <Separator orientation="vertical" className="h-10" />
                                    <div className="text-center">
                                        <p className="text-2xl font-bold">{selectedIds.size.toLocaleString()}</p>
                                        <p className="text-xs text-muted-foreground">Items</p>
                                    </div>
                                    {selectedLocationIds.size > 0 && (
                                        <>
                                            <Separator orientation="vertical" className="h-10" />
                                            <div className="text-center">
                                                <p className="text-2xl font-bold">{selectedLocationIds.size}</p>
                                                <p className="text-xs text-muted-foreground">Locations</p>
                                            </div>
                                        </>
                                    )}
                                    {!campaign.clearMode && (campaign.startDate || campaign.endDate) && (
                                        <>
                                            <Separator orientation="vertical" className="h-10" />
                                            <div className="text-center">
                                                <p className="text-sm font-semibold">
                                                    {campaign.startDate ? format(new Date(campaign.startDate), 'dd MMM') : '—'}
                                                    {' – '}
                                                    {campaign.endDate ? format(new Date(campaign.endDate), 'dd MMM yy') : '—'}
                                                </p>
                                                <p className="text-xs text-muted-foreground">Validity</p>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Rollback hint */}
                                <div className="flex items-center gap-2 p-2.5 rounded-md bg-muted/40 border border-border text-xs text-muted-foreground">
                                    <Undo2 className="h-3.5 w-3.5 shrink-0" />
                                    <span>Need to undo? Open <strong>History</strong> and click the rollback button next to this campaign.</span>
                                </div>

                                <div className="flex gap-3 justify-center pt-2">
                                    <Button variant="outline" onClick={resetAll}>
                                        <Sparkles className="h-4 w-4 mr-2" /> New Campaign
                                    </Button>
                                    <Link href="/erp/items/list" transitionTypes={['nav-back']}>
                                        <Button>View Items List</Button>
                                    </Link>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* ── Filter Sheet ── */}
                <FilterSheet
                    open={isFilterOpen} onOpenChange={setIsFilterOpen}
                    brands={brands} categories={categories} silhouettes={silhouettes} genders={genders}
                    pendingBrandIds={pendingBrandIds} pendingCategoryIds={pendingCategoryIds}
                    pendingSilhouetteIds={pendingSilhouetteIds} pendingGenderIds={pendingGenderIds}
                    setPendingBrandIds={setPendingBrandIds} setPendingCategoryIds={setPendingCategoryIds}
                    setPendingSilhouetteIds={setPendingSilhouetteIds} setPendingGenderIds={setPendingGenderIds}
                    onApply={handleApplyFilters} onClear={handleClearFilters}
                />

                {/* ── Apply Confirm Dialog ── */}
                <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                                {campaign.clearMode
                                    ? <><Trash2 className="h-5 w-5 text-destructive" /> Clear discounts on {selectedIds.size.toLocaleString()} items?</>
                                    : <><Sparkles className="h-5 w-5 text-primary" /> Apply "{campaign.name}"?</>}
                            </AlertDialogTitle>
                            <AlertDialogDescription asChild>
                                <div className="space-y-3">
                                    {campaign.clearMode ? (
                                        <p>This will reset <strong>discountRate</strong>, <strong>discountAmount</strong>, and discount dates to zero on <strong>{selectedIds.size.toLocaleString()} item{selectedIds.size !== 1 ? 's' : ''}</strong>.</p>
                                    ) : (
                                        <p>
                                            This will apply a <strong>{discountLabel(campaign, discountVal)}</strong> to{' '}
                                            <strong>{selectedIds.size.toLocaleString()} item{selectedIds.size !== 1 ? 's' : ''}</strong>
                                            {selectedLocationIds.size > 0 && <> tagged to <strong>{selectedLocationIds.size} location{selectedLocationIds.size !== 1 ? 's' : ''}</strong></>}.
                                        </p>
                                    )}
                                    {selectedItems.some(hasActiveDiscount) && (
                                        <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                                            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                                            <span>{selectedItems.filter(hasActiveDiscount).length} item(s) already have a discount — they will be overwritten.</span>
                                        </div>
                                    )}
                                    <p className="text-sm text-muted-foreground">A snapshot will be saved so you can rollback from History if needed.</p>
                                </div>
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={applying}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleApply} disabled={applying}
                                className={cn('gap-2', campaign.clearMode && 'bg-destructive hover:bg-destructive/90')}>
                                {applying
                                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Applying...</>
                                    : campaign.clearMode
                                        ? <><Trash2 className="h-4 w-4" /> Confirm Clear</>
                                        : <><Sparkles className="h-4 w-4" /> Confirm & Apply</>}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

                {/* ── Rollback Confirm Dialog ── */}
                <AlertDialog open={!!rollbackEntry} onOpenChange={open => { if (!open) setRollbackEntry(null); }}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                                <Undo2 className="h-5 w-5 text-destructive" />
                                Rollback "{rollbackEntry?.name}"?
                            </AlertDialogTitle>
                            <AlertDialogDescription asChild>
                                <div className="space-y-3">
                                    <p>
                                        This will restore the previous discount state for{' '}
                                        <strong>{rollbackEntry?.snapshotCount ?? 0} items</strong> that were snapshotted when the campaign was applied.
                                    </p>
                                    <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-sm">
                                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                                        <span>
                                            Only items from the page that was loaded when the campaign was applied are included in the snapshot.
                                            Items selected via "Select all pages" are not individually snapshotted.
                                        </span>
                                    </div>
                                    <p className="text-sm text-muted-foreground">This campaign will be removed from history after rollback.</p>
                                </div>
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={rollingBack}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => rollbackEntry && handleRollback(rollbackEntry)}
                                disabled={rollingBack}
                                className="bg-destructive hover:bg-destructive/90 gap-2">
                                {rollingBack
                                    ? <><Loader2 className="h-4 w-4 animate-spin" /> Rolling back...</>
                                    : <><Undo2 className="h-4 w-4" /> Confirm Rollback</>}
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>

            </div>
        </PermissionGuard>
    );
}
