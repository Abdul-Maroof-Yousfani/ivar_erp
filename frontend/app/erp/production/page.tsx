'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  productionApi,
  fabricVendorTrackerApi,
  ProductionBatch,
  BGradeInventoryItem,
  ProductionStats,
  FabricVendorTracker,
} from '@/lib/api';
import { ProductionEntryForm } from '@/components/production/production-entry-form';
import { BGradeRefreshModal } from '@/components/production/b-grade-refresh-modal';
import { BatchDetailsModal } from '@/components/production/batch-details-modal';
import { FabricVendorForm } from '@/components/inventory/fabric-vendor-form';
import { toast } from 'sonner';
import {
  Plus,
  Search,
  RefreshCw,
  Layers,
  Sparkles,
  TrendingUp,
  Package,
  PackageCheck,
  Scissors,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  ArrowRight,
  ShieldAlert,
  ArrowUpRight,
  Link2,
  Trash2,
  ArrowDownLeft,
  Scale,
  Eye,
} from 'lucide-react';
import Link from 'next/link';

export default function ProductionPage() {
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [trackers, setTrackers] = useState<FabricVendorTracker[]>([]);
  const [bGradeStock, setBGradeStock] = useState<BGradeInventoryItem[]>([]);
  const [stats, setStats] = useState<ProductionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [activeTrackerIdForProduction, setActiveTrackerIdForProduction] = useState<string | undefined>(undefined);
  const [selectedBGradeItem, setSelectedBGradeItem] = useState<BGradeInventoryItem | null>(null);
  const [isRefreshOpen, setIsRefreshOpen] = useState(false);
  const [selectedBatchForView, setSelectedBatchForView] = useState<ProductionBatch | null>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);

  // Fabric Issue / Consumption Modal
  const [isIssueModalOpen, setIsIssueModalOpen] = useState(false);
  const [selectedTracker, setSelectedTracker] = useState<FabricVendorTracker | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [batchesRes, bStockRes, statsRes, trackersRes] = await Promise.all([
        productionApi.getBatches({ search }),
        productionApi.getBGradeInventory(),
        productionApi.getDashboardStats(),
        fabricVendorTrackerApi.getAll({ search }).catch(() => []),
      ]);

      setBatches(batchesRes.batches || []);
      setBGradeStock(bStockRes || []);
      setStats(statsRes);
      setTrackers(Array.isArray(trackersRes) ? trackersRes : []);
    } catch (error) {
      console.error('Failed to load production data:', error);
      toast.error('Failed to fetch production records');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      loadData();
    }
  };

  const handleOpenRefresh = (item: BGradeInventoryItem) => {
    setSelectedBGradeItem(item);
    setIsRefreshOpen(true);
  };

  const handleOpenIssueFabric = () => {
    setSelectedTracker(null);
    setIsIssueModalOpen(true);
  };

  const handleOpenEditTracker = (tracker: FabricVendorTracker) => {
    setSelectedTracker(tracker);
    setIsIssueModalOpen(true);
  };

  const handleDeleteTracker = async (id: string) => {
    if (!confirm('Are you sure you want to delete this fabric tracker record?')) return;
    try {
      await fabricVendorTrackerApi.delete(id);
      toast.success('Fabric tracking record deleted successfully.');
      loadData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete fabric tracker');
    }
  };

  return (
    <div className="flex-1 space-y-6 p-6 max-w-[1600px] mx-auto">
      {/* ── Top Header ── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              Production & Garment Costing Engine
            </h1>
            <Badge variant="outline" className="border-indigo-500/30 text-indigo-700 dark:text-indigo-300 bg-indigo-500/10 font-semibold">
              Unified Manufacturing
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            End-to-end fabric consumption tracking, live article costing, dynamic multi-size grading, and auto-generated CMT purchase invoices.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <Button onClick={loadData} variant="outline" size="icon" title="Refresh">
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            onClick={handleOpenIssueFabric}
            variant="outline"
            className="border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 font-medium"
          >
            <Scissors className="h-4 w-4 mr-1.5 text-indigo-500" />
            Issue Fabric
          </Button>
          <Button
            onClick={() => {
              setActiveTrackerIdForProduction(undefined);
              setIsCreateOpen(true);
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm font-medium"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            New Production Entry
          </Button>
        </div>
      </div>

      {/* ── Dashboard KPI Cards ── */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-indigo-500 shadow-2xs hover:shadow-sm transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Batches & Fabric Used
            </CardTitle>
            <Scissors className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-foreground">
              {stats ? `${stats.totalFabricUsed.toLocaleString()} m` : '—'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across <strong className="text-foreground">{stats?.totalBatches || 0} batches</strong> • Avg CONS: {stats?.avgConsumption || '0'} m/pc
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 shadow-2xs hover:shadow-sm transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Sound Articles (A-Grade)
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {stats ? `${stats.totalAGradePieces.toLocaleString()} pcs` : '—'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Entered A-Grade Stock at recalculated unit cost
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 shadow-2xs hover:shadow-sm transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              B-Grade Defective Pieces
            </CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
              {stats ? `${stats.totalBGradePieces.toLocaleString()} pcs` : '—'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Valued @ 50% • Ratio: <strong className="text-amber-700 dark:text-amber-300">{stats?.bGradeRatio || '0%'}</strong>
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 shadow-2xs hover:shadow-sm transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Pending Refresh in B-Warehouse
            </CardTitle>
            <RefreshCw className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-blue-600 dark:text-blue-400">
              {stats ? `${stats.pendingRefreshPieces.toLocaleString()} pcs` : '—'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.totalRefreshedPieces || 0} pieces already refreshed to A-stock
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Main Unified Workspace Tabs ── */}
      <Tabs defaultValue="batches" className="space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-3">
          <TabsList className="bg-muted/70 p-1">
            <TabsTrigger value="batches" className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              <span>Production Batches & Costing</span>
              <Badge variant="secondary" className="ml-1 text-[11px] py-0 px-1.5">
                {batches.length}
              </Badge>
            </TabsTrigger>

            <TabsTrigger value="fabric-tracker" className="flex items-center gap-2">
              <Scissors className="h-4 w-4 text-indigo-600" />
              <span>Fabric Consignment Tracker</span>
              <Badge variant="secondary" className="ml-1 text-[11px] py-0 px-1.5">
                {trackers.length}
              </Badge>
            </TabsTrigger>

            <TabsTrigger value="b-grade" className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              <span>B-Grade Warehouse Stock</span>
              {bGradeStock.some((b) => b.qtyRemainingBGrade > 0) && (
                <Badge className="ml-1 bg-amber-500 text-white text-[10px] py-0 px-1.5">
                  Action
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Quick Search */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-[280px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search SKU, batch, vendor..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleSearchKeyPress}
                className="pl-9 h-9 text-xs"
              />
            </div>
            <Button onClick={loadData} variant="secondary" size="sm" className="h-9 text-xs">
              Search
            </Button>
          </div>
        </div>

        {/* ── Tab 1: Production Batches & Costing ── */}
        <TabsContent value="batches" className="space-y-4">
          <Card className="shadow-2xs">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-[140px] font-bold">Batch Reference</TableHead>
                    <TableHead className="font-bold">Finished Article</TableHead>
                    <TableHead className="font-bold">CMT Vendor</TableHead>
                    <TableHead className="font-bold text-right">Fabric Consumed</TableHead>
                    <TableHead className="font-bold text-center">CONS</TableHead>
                    <TableHead className="font-bold text-right">Received (A / B)</TableHead>
                    <TableHead className="font-bold text-right">Initial Net Cost</TableHead>
                    <TableHead className="font-bold text-right text-emerald-600 dark:text-emerald-400">Recalc A-Cost</TableHead>
                    <TableHead className="font-bold">CMT Invoice</TableHead>
                    <TableHead className="font-bold text-center">Status</TableHead>
                    <TableHead className="font-bold text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-10 text-muted-foreground">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-indigo-600" />
                        Loading production batches...
                      </TableCell>
                    </TableRow>
                  ) : batches.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center py-12 text-muted-foreground">
                        <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground/60" />
                        No production batches recorded yet. Click <strong>"New Production Entry"</strong> to create your first batch!
                      </TableCell>
                    </TableRow>
                  ) : (
                    batches.map((batch) => {
                      const fUsed = Number(batch.qtyFabricUsed);
                      const fRate = Number(batch.fabricRate);
                      const totalRecv = Number(batch.qtyTotalReceived);
                      const aPieces = Number(batch.qtyAGrade);
                      const bPieces = Number(batch.qtyBGrade);
                      const cons = Number(batch.consumption);
                      const initialNet = Number(batch.initialNetCost);
                      const aCost = Number(batch.aFinalUnitCost);
                      const hasMultiItems = batch.batchItems && batch.batchItems.length > 1;

                      return (
                        <TableRow key={batch.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-bold text-indigo-600 dark:text-indigo-400 tabular-nums">
                            <div>{batch.batchNumber}</div>
                            <div className="text-[11px] font-normal text-muted-foreground">
                              {new Date(batch.productionDate).toLocaleDateString()}
                            </div>
                            {batch.tracker && (
                              <div className="mt-0.5">
                                <span className="text-[10px] bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-1">
                                  <Link2 className="h-2.5 w-2.5" />
                                  {batch.tracker.trackerNumber}
                                </span>
                              </div>
                            )}
                          </TableCell>

                          <TableCell>
                            {hasMultiItems ? (
                              <div>
                                <div className="font-semibold text-foreground flex items-center gap-1.5">
                                  <span className="truncate max-w-[170px]">{batch.batchItems![0].articleItem?.sku}</span>
                                  <Badge variant="outline" className="text-[10px] py-0 px-1 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30">
                                    +{batch.batchItems!.length - 1} more
                                  </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground truncate max-w-[210px]">
                                  {batch.batchItems!.length} Finished Articles (Split Batch)
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="font-semibold text-foreground flex items-center gap-1.5">
                                  <span className="truncate max-w-[190px]">{batch.articleItem?.sku || 'Article'}</span>
                                  {batch.articleItem?.size?.name && (
                                    <Badge variant="outline" className="text-[10px] py-0 px-1">
                                      Size: {batch.articleItem.size.name}
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-xs text-muted-foreground truncate max-w-[210px]">
                                  {batch.articleItem?.description || 'Finished Good'}
                                </div>
                              </div>
                            )}
                          </TableCell>

                          <TableCell>
                            <div className="font-medium text-foreground truncate max-w-[170px]">{batch.supplier?.name}</div>
                            <div className="text-[11px] text-muted-foreground">[{batch.supplier?.code}]</div>
                          </TableCell>

                          <TableCell className="text-right tabular-nums">
                            <span className="font-semibold text-foreground">{fUsed.toLocaleString()} m</span>
                            <div className="text-[11px] text-muted-foreground">@ Rs {fRate.toFixed(2)}/m</div>
                          </TableCell>

                          <TableCell className="text-center tabular-nums text-xs">
                            <Badge variant="outline" className="font-normal tabular-nums bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20">
                              {cons.toFixed(2)} m/pc
                            </Badge>
                          </TableCell>

                          <TableCell className="text-right tabular-nums">
                            <div className="font-bold text-foreground">{totalRecv.toLocaleString()} pcs</div>
                            <div className="text-[11px] text-muted-foreground whitespace-nowrap">
                              <span className="text-emerald-600 dark:text-emerald-400 font-medium">{aPieces.toLocaleString()} A</span> •{' '}
                              <span className="text-amber-600 dark:text-amber-400 font-medium">{bPieces.toLocaleString()} B</span>
                            </div>
                          </TableCell>

                          <TableCell className="text-right tabular-nums text-xs text-foreground whitespace-nowrap">
                            Rs {initialNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>

                          <TableCell className="text-right tabular-nums whitespace-nowrap">
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-bold tabular-nums text-xs">
                              Rs {aCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </Badge>
                            {hasMultiItems && (
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                (Avg of {batch.batchItems!.length} items)
                              </div>
                            )}
                          </TableCell>

                          <TableCell>
                            {batch.purchaseInvoice ? (
                              <div>
                                <Link
                                  href={`/erp/procurement/purchase-invoice`}
                                  className="font-mono text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-semibold flex items-center gap-1"
                                >
                                  {batch.purchaseInvoice.invoiceNumber}
                                  <ArrowUpRight className="h-3 w-3" />
                                </Link>
                                <div className="text-[11px] text-muted-foreground whitespace-nowrap">
                                  Rs {Number(batch.purchaseInvoice.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>

                          <TableCell className="text-center">
                            <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                              {batch.status}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 font-medium shadow-2xs"
                              onClick={() => {
                                setSelectedBatchForView(batch);
                                setIsViewOpen(true);
                              }}
                              title="View complete batch costing, multi-item breakdown, and warehouse stock routing"
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" />
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* ── Tab 2: Fabric Consignment Tracker ── */}
        <TabsContent value="fabric-tracker" className="space-y-4">
          <Card className="shadow-2xs">
            <CardHeader className="py-3 px-4 border-b bg-muted/10 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Scissors className="h-4 w-4 text-indigo-600" />
                  Fabric Issues & Vendor Consignment Tracker
                </CardTitle>
                <CardDescription className="text-xs">
                  Track fabric rolls issued to CMT vendors, meters consumed across batches, returns, shortages, and remaining balances.
                </CardDescription>
              </div>

              <Button
                size="sm"
                onClick={handleOpenIssueFabric}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs h-8"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Issue New Fabric
              </Button>
            </CardHeader>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="font-bold">Tracker #</TableHead>
                    <TableHead className="font-bold">Vendor / Supplier</TableHead>
                    <TableHead className="font-bold">Fabric Item (SKU)</TableHead>
                    <TableHead className="font-bold">Source Warehouse</TableHead>
                    <TableHead className="font-bold text-right">Issued Qty</TableHead>
                    <TableHead className="font-bold">Usage Breakdown</TableHead>
                    <TableHead className="font-bold">Dates</TableHead>
                    <TableHead className="font-bold text-center">Status</TableHead>
                    <TableHead className="font-bold text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-indigo-600" />
                        Loading fabric trackers...
                      </TableCell>
                    </TableRow>
                  ) : trackers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                        <Scissors className="h-8 w-8 mx-auto mb-2 text-muted-foreground/60" />
                        No fabric vendor tracking records found. Click <strong>"Issue Fabric"</strong> to track fabric issues.
                      </TableCell>
                    </TableRow>
                  ) : (
                    trackers.map((tracker) => {
                      const issued = Number(tracker.qtyIssued || 0);
                      const used = Number(tracker.qtyUsed || 0);
                      const returned = Number(tracker.qtyReturned || 0);
                      const shortage = Number(tracker.qtyShortage || 0);
                      const remaining = Math.max(0, issued - used - returned - shortage);

                      return (
                        <TableRow key={tracker.id} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="font-mono font-bold text-indigo-700">
                            {tracker.trackerNumber}
                          </TableCell>

                          <TableCell>
                            <div className="font-semibold text-foreground">{tracker.supplier?.name}</div>
                            <div className="text-xs text-muted-foreground font-mono">[{tracker.supplier?.code}]</div>
                          </TableCell>

                          <TableCell>
                            <div className="font-semibold">{tracker.item?.sku}</div>
                            <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                              {tracker.item?.description}
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="text-xs font-medium">{tracker.warehouse?.name}</div>
                            <div className="text-[10px] text-muted-foreground uppercase font-semibold">
                              [{tracker.warehouse?.code}]
                            </div>
                          </TableCell>

                          <TableCell className="text-right font-mono font-semibold text-indigo-700">
                            {issued.toLocaleString()} m
                          </TableCell>

                          <TableCell>
                            <div className="space-y-1 text-xs">
                              <div className="flex items-center gap-2 font-mono">
                                <span className="text-emerald-700 font-semibold">U: {used}m</span>
                                <span className="text-blue-600 font-semibold">R: {returned}m</span>
                                {shortage > 0 && <span className="text-rose-600 font-semibold">S: {shortage}m</span>}
                              </div>
                              {tracker.status !== 'COMPLETED' && (
                                <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 inline-block font-mono">
                                  Remaining with Vendor: {remaining.toFixed(2)}m
                                </span>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                            <div className="flex flex-col space-y-0.5">
                              <span>Issue: {new Date(tracker.issueDate).toLocaleDateString()}</span>
                              {tracker.consumptionDate && (
                                <span>Used: {new Date(tracker.consumptionDate).toLocaleDateString()}</span>
                              )}
                            </div>
                          </TableCell>

                          <TableCell className="text-center">
                            <Badge
                              className={
                                tracker.status === 'PENDING'
                                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                                  : tracker.status === 'PARTIAL'
                                  ? 'bg-blue-100 text-blue-800 border-blue-200'
                                  : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              }
                            >
                              {tracker.status}
                            </Badge>
                          </TableCell>

                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1.5">
                              {tracker.status !== 'COMPLETED' && (
                                <>
                                  <Button
                                    size="sm"
                                    className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-2xs"
                                    onClick={() => {
                                      setActiveTrackerIdForProduction(tracker.id);
                                      setIsCreateOpen(true);
                                    }}
                                    title="Receive garments produced against this fabric issue"
                                  >
                                    <PackageCheck className="h-3.5 w-3.5 mr-1" />
                                    Receive Garments
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs border-indigo-500/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/10 font-medium"
                                    onClick={() => handleOpenEditTracker(tracker)}
                                    title="Log fabric return to warehouse or shortage settlement"
                                  >
                                    <Scale className="h-3 w-3 mr-1" />
                                    Return / Shortage
                                  </Button>
                                </>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleDeleteTracker(tracker.id)}
                                title="Delete tracker"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* ── Tab 3: B-Grade Warehouse Stock ── */}
        <TabsContent value="b-grade" className="space-y-4">
          <Card className="shadow-2xs">
            <CardHeader className="pb-3 border-b border-border bg-amber-500/10 dark:bg-amber-500/15">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                    <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    B-Grade Stock Management & Refresh Center
                  </CardTitle>
                  <CardDescription className="text-xs text-muted-foreground mt-0.5">
                    Track defective pieces isolated in B-Grade Warehouse (valued at 50% cost). Send pieces for refresh/repair and return them to A-grade stock.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="font-bold">Batch Reference</TableHead>
                    <TableHead className="font-bold">Garment / SKU</TableHead>
                    <TableHead className="font-bold">CMT Vendor</TableHead>
                    <TableHead className="font-bold text-center">B-Grade Received</TableHead>
                    <TableHead className="font-bold text-center">Already Refreshed</TableHead>
                    <TableHead className="font-bold text-center text-amber-600 dark:text-amber-400">Remaining in B-Warehouse</TableHead>
                    <TableHead className="font-bold text-right">Unit Valuation (50%)</TableHead>
                    <TableHead className="font-bold text-right">Remaining Valuation</TableHead>
                    <TableHead className="font-bold text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                        <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-indigo-600" />
                        Loading B-Grade inventory...
                      </TableCell>
                    </TableRow>
                  ) : bGradeStock.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                        No B-grade stock on record! All production pieces are 100% first quality.
                      </TableCell>
                    </TableRow>
                  ) : (
                    bGradeStock.map((item) => (
                      <TableRow key={item.id || `${item.batchId}-${item.batchItemId || item.articleItem?.id || ''}`} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="tabular-nums font-bold text-indigo-600 dark:text-indigo-400">
                          {item.batchNumber}
                          <div className="text-[11px] font-normal text-muted-foreground">
                            {new Date(item.productionDate).toLocaleDateString()}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="flex items-center gap-1.5 font-semibold text-foreground">
                            <span>{item.articleItem?.sku}</span>
                            {item.sizeName && item.sizeName !== 'Standard' && (
                              <Badge variant="outline" className="text-[10px] py-0 px-1 tabular-nums font-semibold">
                                {item.sizeName}
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground truncate max-w-[220px]">
                            {item.articleItem?.description}
                          </div>
                        </TableCell>

                        <TableCell>
                          <div className="font-medium text-xs">{item.supplier?.name}</div>
                        </TableCell>

                        <TableCell className="text-center tabular-nums font-semibold">
                          {item.qtyBGradeTotal} pcs
                        </TableCell>

                        <TableCell className="text-center tabular-nums font-medium text-emerald-600 dark:text-emerald-400">
                          {item.qtyRefreshed} pcs
                        </TableCell>

                        <TableCell className="text-center tabular-nums">
                          {item.qtyRemainingBGrade > 0 ? (
                            <Badge variant="outline" className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 tabular-nums font-bold">
                              {item.qtyRemainingBGrade} pcs
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-muted-foreground">
                              0 (All Cleared)
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-right tabular-nums text-xs">
                          Rs {Number(item.bUnitValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>

                        <TableCell className="text-right tabular-nums font-semibold text-amber-700 dark:text-amber-400">
                          Rs {Number(item.remainingValuation).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>

                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            disabled={item.qtyRemainingBGrade <= 0}
                            onClick={() => handleOpenRefresh(item)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8"
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Send for Refresh
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Single Clean Production Entry Modal (NO Duplicate Header) ── */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent
          noScroll
          className="sm:max-w-[1440px] w-[98vw] max-h-[94vh] flex flex-col p-0 gap-0 overflow-hidden rounded-xl border shadow-2xl"
        >
          <DialogTitle className="sr-only">Record Production & Garment Costing</DialogTitle>
          <DialogDescription className="sr-only">Production Receiving & Garment Costing Engine</DialogDescription>

          <ProductionEntryForm
            initialTrackerId={activeTrackerIdForProduction}
            onSuccess={() => {
              setIsCreateOpen(false);
              setActiveTrackerIdForProduction(undefined);
              loadData();
            }}
            onClose={() => {
              setIsCreateOpen(false);
              setActiveTrackerIdForProduction(undefined);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* ── B-Grade Refresh Modal ── */}
      {selectedBGradeItem && (
        <BGradeRefreshModal
          item={selectedBGradeItem}
          isOpen={isRefreshOpen}
          onClose={() => {
            setIsRefreshOpen(false);
            setSelectedBGradeItem(null);
          }}
          onSuccess={() => {
            setIsRefreshOpen(false);
            setSelectedBGradeItem(null);
            loadData();
          }}
        />
      )}

      {/* ── View Batch Costing & Multi-Item Details Modal ── */}
      <BatchDetailsModal
        batch={selectedBatchForView}
        isOpen={isViewOpen}
        onClose={() => {
          setIsViewOpen(false);
          setSelectedBatchForView(null);
        }}
        onOpenRefresh={handleOpenRefresh}
      />

      {/* ── Issue Fabric / Consumption Settlement Modal ── */}
      <Dialog open={isIssueModalOpen} onOpenChange={setIsIssueModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader className="pb-3 border-b">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                {selectedTracker ? <Scale className="h-5 w-5" /> : <Scissors className="h-5 w-5" />}
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  {selectedTracker ? 'Log Vendor Fabric Settlement' : 'Issue Fabric to Vendor'}
                  {selectedTracker && (
                    <Badge variant="outline" className="text-[11px] font-mono border-indigo-500/30 text-indigo-700 dark:text-indigo-300 bg-indigo-500/10">
                      Returns & Wastage
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {selectedTracker
                    ? 'Record fabric returns to warehouse, cutting shortages, or manual usage to reconcile this consignment.'
                    : 'Issue fabric rolls or meters from warehouse to CMT vendor for garment cutting and stitching.'}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <FabricVendorForm
            initialData={selectedTracker}
            onSuccess={() => {
              setIsIssueModalOpen(false);
              setSelectedTracker(null);
              loadData();
            }}
            onClose={() => {
              setIsIssueModalOpen(false);
              setSelectedTracker(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
