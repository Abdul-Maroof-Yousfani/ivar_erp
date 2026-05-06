/* eslint-disable react-hooks/set-state-in-effect -- Data fetching in dialog is a valid pattern */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    XCircle,
    Sparkles,
    Plus,
    Tag,
    Package,
    MapPin,
    Globe,
    CheckCircle2,
    Clock,
    Search,
    Loader2,
    CalendarRange,
} from 'lucide-react';

import { getDiscountCampaign } from '@/lib/actions/items';
import { toast } from 'sonner';

// ─── Types ──────────────────────────────────────────────────────────────────

interface Campaign {
    id: string;
    name: string;
    discountType: string;
    discountRate: number;
    discountAmount: number;
    startDate: string | null;
    endDate: string | null;
    notes: string | null;
    clearMode: boolean;
    itemCount: number;
    appliedById: string | null;
    createdAt: string;
    locations: { id: string; locationId: string; locationName: string | null }[];
    _count: { items: number };
}

interface CampaignDetail extends Campaign {
    items: {
        id: string;
        itemId: string;
        overrideRate: number | null;
        overrideAmount: number | null;
        prevDiscountRate: number | null;
        prevDiscountAmount: number | null;
        item: {
            id: string;
            itemId: string;
            sku: string;
            description: string | null;
            unitPrice: number;
            discountRate: number | null;
            discountAmount: number | null;
            brand: { name: string } | null;
            category: { name: string } | null;
        };
    }[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatPKR(n: number) {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'PKR', minimumFractionDigits: 0 });
}

function discountBadge(c: Campaign) {
    if (c.clearMode) return { label: 'Clear', variant: 'destructive' as const };
    if (c.discountType === 'percent') return { label: `${c.discountRate}% off`, variant: 'secondary' as const };
    return { label: `PKR ${c.discountAmount.toLocaleString()} off`, variant: 'secondary' as const };
}

function isActive(c: Campaign): boolean {
    if (c.clearMode) return false;
    const now = new Date();
    const start = c.startDate ? new Date(c.startDate) : null;
    const end = c.endDate ? new Date(c.endDate) : null;
    return (!start || start <= now) && (!end || end >= now);
}

// ─── Campaign Detail Dialog ─────────────────────────────────────────────────

interface CampaignDetailDialogProps {
    campaignId: string | null;
    open: boolean;
    onClose: () => void;
    onAddItems: (campaign: CampaignDetail) => void;
}

export default function CampaignDetailDialog({
    campaignId,
    open,
    onClose,
    onAddItems,
}: CampaignDetailDialogProps) {
    const [detail, setDetail] = useState<CampaignDetail | null>(null);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');

    const loadCampaign = useCallback((id: string) => {
        setLoading(true);
        getDiscountCampaign(id)
            .then(res => {
                if (res.status) setDetail(res.data);
            })
            .catch(() => toast.error('Failed to load campaign'))
            .finally(() => setLoading(false));
    }, []);

    // Load campaign when dialog opens with a new campaignId
    useEffect(() => {
        if (campaignId && open) {
            void loadCampaign(campaignId);
        }
    }, [campaignId, open, loadCampaign]);

    const handleClose = () => {
        setDetail(null);
        setSearch('');
        onClose();
    };

    const filtered = detail?.items.filter(ci =>
        !search ||
        ci.item.sku.toLowerCase().includes(search.toLowerCase()) ||
        (ci.item.description ?? '').toLowerCase().includes(search.toLowerCase()) ||
        ci.item.itemId.includes(search) ||
        (ci.item.brand?.name ?? '').toLowerCase().includes(search.toLowerCase())
    ) ?? [];

    const active = detail ? isActive(detail) : false;
    const badge = detail ? discountBadge(detail) : null;

    if (!open) return null;

    return (
        <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
            <DialogContent className="!max-w-[95vw] !w-[95vw] h-[92vh] flex flex-col p-0 gap-0">
                {/* ── Header ── */}
                <DialogHeader className="px-8 pt-6 pb-5 border-b shrink-0">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className={cn(
                                'flex items-center justify-center w-10 h-10 rounded-xl shrink-0',
                                detail?.clearMode ? 'bg-destructive/10' : 'bg-primary/10',
                            )}>
                                {detail?.clearMode
                                    ? <XCircle className="h-5 w-5 text-destructive" />
                                    : <Sparkles className="h-5 w-5 text-primary" />}
                            </div>
                            <div className="min-w-0">
                                <DialogTitle className="text-xl font-bold truncate">
                                    {loading ? 'Loading...' : (detail?.name ?? '—')}
                                </DialogTitle>
                                {detail?.notes && (
                                    <p className="text-sm text-muted-foreground mt-0.5 truncate">{detail.notes}</p>
                                )}
                            </div>
                        </div>
                        {detail && !detail.clearMode && (
                            <Button onClick={() => { onClose(); onAddItems(detail); }} className="shrink-0 gap-1.5">
                                <Plus className="h-4 w-4" /> Add More Items
                            </Button>
                        )}
                    </div>
                </DialogHeader>

                {loading ? (
                    <div className="flex items-center justify-center flex-1 gap-2 text-muted-foreground">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span>Loading campaign details...</span>
                    </div>
                ) : detail ? (
                    <div className="flex flex-col flex-1 min-h-0">
                        {/* ── Stats row ── */}
                        <div className="px-8 py-4 border-b shrink-0 bg-muted/20">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        'flex items-center justify-center w-9 h-9 rounded-lg shrink-0',
                                        detail.clearMode ? 'bg-destructive/10' : 'bg-primary/10',
                                    )}>
                                        <Tag className={cn('h-4 w-4', detail.clearMode ? 'text-destructive' : 'text-primary')} />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Discount</p>
                                        <p className={cn('text-sm font-bold', detail.clearMode ? 'text-destructive' : 'text-primary')}>
                                            {badge?.label}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-500/10 shrink-0">
                                        <Package className="h-4 w-4 text-blue-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Items</p>
                                        <p className="text-sm font-bold">{detail.itemCount.toLocaleString()}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        'flex items-center justify-center w-9 h-9 rounded-lg shrink-0',
                                        active ? 'bg-green-500/10' : 'bg-muted',
                                    )}>
                                        {active
                                            ? <CheckCircle2 className="h-4 w-4 text-green-600" />
                                            : <Clock className="h-4 w-4 text-muted-foreground" />}
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Status</p>
                                        <p className={cn('text-sm font-bold', active ? 'text-green-600' : 'text-muted-foreground')}>
                                            {detail.clearMode ? 'Cleared' : active ? 'Active' : 'Inactive'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-orange-500/10 shrink-0">
                                        <CalendarRange className="h-4 w-4 text-orange-600" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Validity</p>
                                        <p className="text-sm font-bold">
                                            {detail.startDate && detail.endDate
                                                ? `${format(new Date(detail.startDate), 'dd MMM')} – ${format(new Date(detail.endDate), 'dd MMM yy')}`
                                                : 'No expiry'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── Locations row ── */}
                        <div className="px-8 py-3 border-b shrink-0 flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">
                                <MapPin className="h-3.5 w-3.5" />
                                Locations
                            </div>
                            {detail.locations.length === 0 ? (
                                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <Globe className="h-3.5 w-3.5" />
                                    Global — applies to all outlets
                                </div>
                            ) : (
                                <>
                                    {detail.locations.map(l => (
                                        <Badge key={l.id} variant="secondary" className="text-xs font-normal">
                                            {l.locationName ?? l.locationId}
                                        </Badge>
                                    ))}
                                    <span className="text-xs text-muted-foreground">
                                        ({detail.locations.length} location{detail.locations.length !== 1 ? 's' : ''})
                                    </span>
                                </>
                            )}
                            <span className="ml-auto text-xs text-muted-foreground shrink-0">
                                Applied {format(new Date(detail.createdAt), 'dd MMM yyyy, HH:mm')}
                            </span>
                        </div>

                        {/* ── Search ── */}
                        <div className="px-8 py-3 border-b shrink-0 flex items-center gap-4">
                            <div className="relative flex-1 max-w-sm">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                    placeholder="Search by Item ID, SKU, description or brand..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="pl-9 h-9 text-sm"
                                />
                                {search && (
                                    <button type="button" onClick={() => setSearch('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2">
                                        <XCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                                    </button>
                                )}
                            </div>
                            <span className="text-sm text-muted-foreground shrink-0">
                                {filtered.length.toLocaleString()} of {detail.items.length.toLocaleString()} items
                            </span>
                        </div>

                        {/* ── Items table — scrollable ── */}
                        <div className="flex-1 min-h-0 overflow-auto">
                            <Table>
                                <TableHeader className="sticky top-0 bg-background z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                                    <TableRow className="hover:bg-transparent">
                                        <TableHead className="w-24 pl-8">Item ID</TableHead>
                                        <TableHead className="w-40">SKU</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead className="w-36">Brand</TableHead>
                                        <TableHead className="w-36">Category</TableHead>
                                        <TableHead className="text-right w-28">Unit Price</TableHead>
                                        <TableHead className="text-right w-40">Applied Discount</TableHead>
                                        <TableHead className="text-right w-32">Current Disc.</TableHead>
                                        <TableHead className="text-right w-32 pr-8">Prev. Disc.</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filtered.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={9} className="text-center py-16 text-muted-foreground">
                                                {search ? `No items match "${search}"` : 'No items in this campaign.'}
                                            </TableCell>
                                        </TableRow>
                                    ) : filtered.map(ci => {
                                        const hasOverride = ci.overrideRate != null || ci.overrideAmount != null;
                                        const appliedDiscount = ci.overrideRate != null
                                            ? `${ci.overrideRate}%`
                                            : ci.overrideAmount != null
                                                ? formatPKR(ci.overrideAmount)
                                                : detail.clearMode
                                                    ? 'Cleared'
                                                    : detail.discountType === 'percent'
                                                        ? `${detail.discountRate}%`
                                                        : formatPKR(detail.discountAmount);

                                        const currentDiscount = (ci.item.discountRate ?? 0) > 0
                                            ? `${ci.item.discountRate}%`
                                            : (ci.item.discountAmount ?? 0) > 0
                                                ? formatPKR(ci.item.discountAmount ?? 0)
                                                : null;

                                        const prevDiscount = (ci.prevDiscountRate ?? 0) > 0
                                            ? `${ci.prevDiscountRate}%`
                                            : (ci.prevDiscountAmount ?? 0) > 0
                                                ? formatPKR(ci.prevDiscountAmount ?? 0)
                                                : null;

                                        return (
                                            <TableRow key={ci.id} className="hover:bg-muted/30">
                                                <TableCell className="pl-8">
                                                    <span className="font-mono text-xs font-medium">{ci.item.itemId}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="font-mono text-xs text-muted-foreground">{ci.item.sku}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-sm">{ci.item.description ?? '—'}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-sm">{ci.item.brand?.name ?? '—'}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-sm text-muted-foreground">{ci.item.category?.name ?? '—'}</span>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <span className="font-mono text-sm">{formatPKR(ci.item.unitPrice)}</span>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <span className={cn(
                                                            'font-mono text-sm font-semibold',
                                                            detail.clearMode ? 'text-destructive' : 'text-primary',
                                                        )}>
                                                            {appliedDiscount}
                                                        </span>
                                                        {hasOverride && (
                                                            <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 text-amber-600 border-amber-300">
                                                                override
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {currentDiscount
                                                        ? <span className="font-mono text-sm font-semibold text-primary">{currentDiscount}</span>
                                                        : <span className="text-muted-foreground text-xs">—</span>}
                                                </TableCell>
                                                <TableCell className="text-right pr-8">
                                                    {prevDiscount
                                                        ? <span className="font-mono text-sm text-muted-foreground">{prevDiscount}</span>
                                                        : <span className="text-muted-foreground text-xs">—</span>}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center justify-center flex-1 text-muted-foreground text-sm">
                        Failed to load campaign.
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
