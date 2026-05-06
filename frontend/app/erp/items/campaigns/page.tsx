'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ColumnDef, PaginationState, SortingState } from '@tanstack/react-table';
import {
    ArrowLeft, Sparkles, XCircle, Undo2, Plus, Eye,
    RefreshCw, Tag, Loader2,
} from 'lucide-react';

import { getDiscountCampaigns, rollbackCampaign } from '@/lib/actions/items';
import { PermissionGuard } from '@/components/auth/permission-guard';
import DataTable from '@/components/common/data-table';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import CampaignDetailDialog from './campaign-detail-dialog';

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

// ─── Helpers ────────────────────────────────────────────────────────────────

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

// ─── Column Definitions ─────────────────────────────────────────────────────

function useCampaignColumns(
    onView: (id: string) => void,
    onAddItems: (c: Campaign) => void,
    onRollback: (c: Campaign) => void,
): ColumnDef<Campaign>[] {
    return [
        {
            accessorKey: 'name',
            header: 'Campaign',
            cell: ({ row }) => {
                const c = row.original;
                return (
                    <div className="flex items-center gap-2">
                        {c.clearMode
                            ? <XCircle className="h-4 w-4 text-destructive shrink-0" />
                            : <Sparkles className="h-4 w-4 text-primary shrink-0" />}
                        <div>
                            <p className="font-semibold text-sm">{c.name}</p>
                            {c.notes && <p className="text-xs text-muted-foreground truncate max-w-40">{c.notes}</p>}
                        </div>
                    </div>
                );
            },
        },
        {
            id: 'discount',
            header: 'Discount',
            cell: ({ row }) => {
                const badge = discountBadge(row.original);
                return (
                    <Badge variant={badge.variant} className="font-mono text-xs">
                        {badge.label}
                    </Badge>
                );
            },
        },
        {
            id: 'validity',
            header: 'Validity',
            cell: ({ row }) => {
                const c = row.original;
                return c.startDate && c.endDate ? (
                    <span className="text-xs text-muted-foreground">
                        {format(new Date(c.startDate), 'dd MMM')} – {format(new Date(c.endDate), 'dd MMM yy')}
                    </span>
                ) : (
                    <span className="text-xs text-muted-foreground">No expiry</span>
                );
            },
        },
        {
            accessorKey: 'itemCount',
            header: 'Items',
            cell: ({ row }) => (
                <div className="text-center">
                    <Badge variant="outline" className="font-mono">{row.original._count.items}</Badge>
                </div>
            ),
        },
        {
            id: 'locations',
            header: 'Locations',
            cell: ({ row }) => {
                const c = row.original;
                return c.locations.length === 0
                    ? <span className="text-muted-foreground text-xs">Global</span>
                    : <span className="text-xs">{c.locations.slice(0, 2).map(l => l.locationName ?? l.locationId).join(', ')}{c.locations.length > 2 ? ` +${c.locations.length - 2}` : ''}</span>;
            },
        },
        {
            id: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const c = row.original;
                const active = isActive(c);
                return c.clearMode ? (
                    <Badge variant="outline" className="text-xs text-muted-foreground">Cleared</Badge>
                ) : active ? (
                    <Badge className="text-xs bg-green-500/10 text-green-700 border-green-300">Active</Badge>
                ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground">Inactive</Badge>
                );
            },
        },
        {
            accessorKey: 'createdAt',
            header: 'Applied',
            cell: ({ row }) => (
                <span className="text-xs text-muted-foreground">
                    {format(new Date(row.original.createdAt), 'dd MMM yy')}
                </span>
            ),
        },
        {
            id: 'actions',
            header: 'Actions',
            enableSorting: false,
            cell: ({ row }) => {
                const c = row.original;
                return (
                    <div className="flex items-center justify-end gap-1">
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onView(c.id)}>
                                    <Eye className="h-3.5 w-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>View campaign details</TooltipContent>
                        </Tooltip>

                        {!c.clearMode && (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-primary" onClick={() => onAddItems(c)}>
                                        <Plus className="h-3.5 w-3.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Add more items to this campaign</TooltipContent>
                            </Tooltip>
                        )}

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => onRollback(c)}>
                                    <Undo2 className="h-3.5 w-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>Rollback — restore pre-campaign discounts</TooltipContent>
                        </Tooltip>
                    </div>
                );
            },
        },
    ];
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function CampaignsPage() {
    const router = useRouter();
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [meta, setMeta] = useState({ total: 0, totalPages: 1 });
    const [pagination, setPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: 20,
    });
    const [sorting, setSorting] = useState<SortingState>([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    const [detailId, setDetailId] = useState<string | null>(null);
    const [rollbackTarget, setRollbackTarget] = useState<Campaign | null>(null);
    const [rollingBack, setRollingBack] = useState(false);

    const load = useCallback(async (page: number) => {
        setLoading(true);
        try {
            const res = await getDiscountCampaigns(page, pagination.pageSize);
            if (res.status) {
                setCampaigns(res.data ?? []);
                setMeta({ total: res.meta?.total ?? 0, totalPages: res.meta?.totalPages ?? 1 });
            }
        } catch {
            toast.error('Failed to load campaigns');
        } finally {
            setLoading(false);
        }
    }, [pagination.pageSize]);

    const currentPage = pagination.pageIndex + 1;

    // Load on page change
    useEffect(() => {
        load(currentPage);
    }, [currentPage, load]);

    const handleRollback = async () => {
        if (!rollbackTarget) return;
        setRollingBack(true);
        try {
            const result = await rollbackCampaign(rollbackTarget.id);
            if (result.status) {
                toast.success(result.message || `Rolled back "${rollbackTarget.name}"`);
                setRollbackTarget(null);
                load(currentPage);
            } else {
                toast.error(result.message || 'Rollback failed');
            }
        } catch {
            toast.error('Rollback failed');
        } finally {
            setRollingBack(false);
        }
    };

    const handleAddItems = (campaign: Campaign) => {
        const params = new URLSearchParams({
            extend: campaign.id,
            name: campaign.name,
            type: campaign.discountType,
            rate: String(campaign.discountRate),
            amount: String(campaign.discountAmount),
            ...(campaign.startDate && { startDate: campaign.startDate }),
            ...(campaign.endDate && { endDate: campaign.endDate }),
        });
        router.push(`/erp/items/bulk-discount?${params.toString()}`);
    };

    const columns = useCampaignColumns(
        setDetailId,
        handleAddItems,
        setRollbackTarget,
    );

    return (
        <PermissionGuard permissions={['erp.item.read']}>
            <div className="p-6 space-y-6 max-w-350 mx-auto">
                {/* ── Header ── */}
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
                        <div className="flex items-center gap-4">
                            <div>
                                <CardTitle className="text-2xl font-bold flex items-center gap-2">
                                    Discount Campaigns
                                </CardTitle>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {meta.total} campaign{meta.total !== 1 ? 's' : ''} — view, extend, or rollback
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Link href="/erp/items/bulk-discount" transitionTypes={['nav-forward']}>
                                <Button className="gap-1.5">
                                    <Plus className="h-4 w-4" /> New Campaign
                                </Button>
                            </Link>
                        </div>
                    </CardHeader>

                    <CardContent>
                        <DataTable
                            columns={columns}
                            data={campaigns}
                            tableId="campaigns-list"
                            searchFields={[{ key: 'name', label: 'Campaign Name' }]}
                            manualPagination
                            manualSorting
                            manualFiltering
                            rowCount={meta.total}
                            pageCount={meta.totalPages}
                            onPaginationChange={setPagination}
                            onSortingChange={setSorting}
                            onSearchChange={setSearch}
                            isLoading={loading}
                            canBulkEdit={false}
                            canBulkDelete={false}
                            canRowEdit={false}
                            canRowDelete={false}
                        />
                    </CardContent>
                </Card>

                {/* ── Campaign Detail Dialog ── */}
                <CampaignDetailDialog
                    campaignId={detailId}
                    open={!!detailId}
                    onClose={() => setDetailId(null)}
                    onAddItems={(campaign) => {
                        setDetailId(null);
                        handleAddItems(campaign);
                    }}
                />

                {/* ── Rollback Confirm ── */}
                <AlertDialog open={!!rollbackTarget} onOpenChange={open => { if (!open) setRollbackTarget(null); }}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2">
                                <Undo2 className="h-5 w-5 text-destructive" />
                                Rollback &quot;{rollbackTarget?.name}&quot;?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                                This will restore the pre-campaign discount state for all snapshotted items and remove this campaign record. This action cannot be undone.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel disabled={rollingBack}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={handleRollback}
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
