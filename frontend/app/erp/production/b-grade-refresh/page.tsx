'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  RefreshCw,
  Plus,
  PackageCheck,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  Truck,
  RotateCcw,
  Eye,
} from 'lucide-react';
import { toast } from 'sonner';
import { bGradeRefreshApi, BGradeRefreshOrder } from '@/lib/api';
import { BGradeSendForm } from '@/components/production/b-grade-send-form';
import { BGradeReceiveForm } from '@/components/production/b-grade-receive-form';
import { BGradeOrderDetailsModal } from '@/components/production/b-grade-order-details-modal';

const STATUS_MAP = {
  PENDING: {
    label: 'Pending Dispatch / In Transit',
    icon: Clock,
    badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  },
  PARTIALLY_RECEIVED: {
    label: 'Partially Received',
    icon: AlertTriangle,
    badgeClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
  },
  COMPLETED: {
    label: 'Fully Completed',
    icon: CheckCircle2,
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  },
  CANCELLED: {
    label: 'Cancelled',
    icon: XCircle,
    badgeClass: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
  },
} as const;

export default function BGradeRefreshPage() {
  const [orders, setOrders] = useState<BGradeRefreshOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('active');

  // Modals
  const [isSendOpen, setIsSendOpen] = useState(false);
  const [isReceiveOpen, setIsReceiveOpen] = useState(false);
  const [selectedOrderForReceive, setSelectedOrderForReceive] =
    useState<BGradeRefreshOrder | null>(null);

  const [isViewOpen, setIsViewOpen] = useState(false);
  const [viewOrderId, setViewOrderId] = useState<string | null>(null);
  const [selectedOrderForView, setSelectedOrderForView] =
    useState<BGradeRefreshOrder | null>(null);

  const handleOpenView = (order: BGradeRefreshOrder) => {
    setSelectedOrderForView(order);
    setViewOrderId(order.id);
    setIsViewOpen(true);
  };

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const data = await bGradeRefreshApi.getOrders();
      setOrders(data || []);
    } catch {
      toast.error('Failed to load B-Grade refresh orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    queueMicrotask(() => {
      if (!ignore) {
        loadOrders();
      }
    });
    return () => {
      ignore = true;
    };
  }, [loadOrders]);

  const handleOpenReceive = (order: BGradeRefreshOrder) => {
    setSelectedOrderForReceive(order);
    setIsReceiveOpen(true);
  };

  const handleCancelOrder = async (order: BGradeRefreshOrder) => {
    if (
      !confirm(
        `Are you sure you want to cancel order ${order.orderNumber}? All deducted stock will be returned to ${order.bGradeWarehouse?.name || 'the warehouse'}.`,
      )
    ) {
      return;
    }

    try {
      await bGradeRefreshApi.cancelOrder(order.id);
      toast.success(
        `Order ${order.orderNumber} cancelled. Stock successfully returned to warehouse!`,
      );
      loadOrders();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel order';
      toast.error(msg);
    }
  };

  // Filtered orders
  const filteredOrders = useMemo(() => {
    const s = search.toLowerCase().trim();
    return orders.filter((o) => {
      const matchesSearch =
        !s ||
        o.orderNumber.toLowerCase().includes(s) ||
        o.supplier?.name?.toLowerCase().includes(s) ||
        o.bGradeWarehouse?.name?.toLowerCase().includes(s) ||
        o.items?.some((i) => i.item?.sku?.toLowerCase().includes(s));
      return matchesSearch;
    });
  }, [orders, search]);

  const activeOrders = useMemo(
    () =>
      filteredOrders.filter(
        (o) => o.status === 'PENDING' || o.status === 'PARTIALLY_RECEIVED',
      ),
    [filteredOrders],
  );

  const completedOrders = useMemo(
    () => filteredOrders.filter((o) => o.status === 'COMPLETED'),
    [filteredOrders],
  );

  const cancelledOrders = useMemo(
    () => filteredOrders.filter((o) => o.status === 'CANCELLED'),
    [filteredOrders],
  );

  // Overall KPIs
  const totalSent = useMemo(
    () =>
      orders.reduce(
        (acc, o) =>
          o.status !== 'CANCELLED'
            ? acc +
              (o.items || []).reduce((si, i) => si + (Number(i.qtySent) || 0), 0)
            : acc,
        0,
      ),
    [orders],
  );

  const totalReceived = useMemo(
    () =>
      orders.reduce(
        (acc, o) =>
          o.status !== 'CANCELLED'
            ? acc +
              (o.items || []).reduce(
                (si, i) => si + (Number(i.qtyReceived) || 0),
                0,
              )
            : acc,
        0,
      ),
    [orders],
  );

  const totalPendingAtVendor = Math.max(0, totalSent - totalReceived);

  return (
    <div className="flex-1 space-y-6 p-6 max-w-[1600px] mx-auto">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              B-Grade Refresh &amp; Alteration Management
            </h1>
            <Badge
              variant="outline"
              className="border-orange-500/30 text-orange-700 dark:text-orange-300 bg-orange-500/10 font-semibold"
            >
              2-Phase Logistics
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Dispatch defective pieces to vendors for alteration/repair, track pending balances, and receive them into sound stock with automatic costing &amp; CMT invoices.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto">
          <Button
            onClick={loadOrders}
            variant="outline"
            size="icon"
            title="Refresh"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            onClick={() => setIsSendOpen(true)}
            className="bg-orange-600 hover:bg-orange-700 text-white font-medium shadow-sm"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            New Refresh Order (Dispatch)
          </Button>
        </div>
      </div>

      {/* ── KPI Dashboard Cards ── */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-l-4 border-l-orange-500 shadow-2xs hover:shadow-sm transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Total Refresh Orders
            </CardTitle>
            <Truck className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-foreground">
              {orders.length}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              <strong className="text-foreground">{activeOrders.length} active</strong> in transit / with vendor
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 shadow-2xs hover:shadow-sm transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Dispatched to Vendor
            </CardTitle>
            <Send className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
              {totalSent.toLocaleString()} pcs
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              B-grade pieces sent out for rework
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-red-500 shadow-2xs hover:shadow-sm transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Still Pending at Vendor
            </CardTitle>
            <RotateCcw className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-red-600 dark:text-red-400">
              {totalPendingAtVendor.toLocaleString()} pcs
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Awaiting return from alteration
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-emerald-500 shadow-2xs hover:shadow-sm transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Returned as Sound (A-Grade)
            </CardTitle>
            <PackageCheck className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {totalReceived.toLocaleString()} pcs
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Successfully inbounded to finished stock
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Search & Filter Controls ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order#, vendor, warehouse, SKU..."
            className="pl-8 text-xs h-9 bg-background"
          />
        </div>
      </div>

      {/* ── Orders Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/60 p-1">
          <TabsTrigger value="active" className="text-xs font-medium">
            Active Orders ({activeOrders.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="text-xs font-medium">
            Completed ({completedOrders.length})
          </TabsTrigger>
          <TabsTrigger value="all" className="text-xs font-medium">
            All ({filteredOrders.length})
          </TabsTrigger>
          <TabsTrigger value="cancelled" className="text-xs font-medium">
            Cancelled ({cancelledOrders.length})
          </TabsTrigger>
        </TabsList>

        {(['active', 'completed', 'all', 'cancelled'] as const).map((tabKey) => {
          const list =
            tabKey === 'active'
              ? activeOrders
              : tabKey === 'completed'
                ? completedOrders
                : tabKey === 'cancelled'
                  ? cancelledOrders
                  : filteredOrders;

          return (
            <TabsContent key={tabKey} value={tabKey}>
              <Card className="border border-border/80 shadow-2xs">
                <CardContent className="p-0">
                  {loading ? (
                    <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
                      <RefreshCw className="h-5 w-5 animate-spin mr-2 text-orange-500" />
                      Loading orders...
                    </div>
                  ) : list.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-muted-foreground text-sm space-y-2">
                      <Truck className="h-8 w-8 text-muted-foreground/40" />
                      <span>No refresh orders found in this view.</span>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="text-xs bg-muted/30">
                            <TableHead className="font-semibold">Order #</TableHead>
                            <TableHead className="font-semibold">Refresh Vendor</TableHead>
                            <TableHead className="font-semibold">B-Grade Source WH</TableHead>
                            <TableHead className="font-semibold">Articles</TableHead>
                            <TableHead className="text-center tabular-nums font-semibold">Sent</TableHead>
                            <TableHead className="text-center tabular-nums font-semibold">Received</TableHead>
                            <TableHead className="text-center tabular-nums font-semibold">Pending Return</TableHead>
                            <TableHead className="font-semibold">Status</TableHead>
                            <TableHead className="font-semibold">Date</TableHead>
                            <TableHead className="text-right font-semibold">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {list.map((order) => {
                            const sent = (order.items || []).reduce(
                              (s, i) => s + (Number(i.qtySent) || 0),
                              0,
                            );
                            const received = (order.items || []).reduce(
                              (s, i) => s + (Number(i.qtyReceived) || 0),
                              0,
                            );
                            const pending = Math.max(0, sent - received);
                            const statusInfo =
                              STATUS_MAP[order.status] || STATUS_MAP.PENDING;
                            const StatusIcon = statusInfo.icon;

                            return (
                              <TableRow key={order.id} className="text-xs hover:bg-muted/20">
                                <TableCell
                                  className="font-mono font-bold text-foreground py-3 cursor-pointer hover:text-primary transition-colors"
                                  onClick={() => handleOpenView(order)}
                                >
                                  <span className="hover:underline">{order.orderNumber}</span>
                                </TableCell>
                                <TableCell className="py-3">
                                  <div className="font-semibold text-foreground">
                                    {order.supplier?.name || '—'}
                                  </div>
                                  {order.supplier?.code && (
                                    <span className="text-[11px] text-muted-foreground">
                                      {order.supplier.code}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="py-3 text-muted-foreground">
                                  {order.bGradeWarehouse?.name || '—'}
                                </TableCell>
                                <TableCell className="py-3 max-w-[200px]">
                                  <div className="space-y-0.5">
                                    {(order.items || []).map((it) => (
                                      <div
                                        key={it.id}
                                        className="text-[11px] text-foreground flex items-center justify-between gap-1"
                                      >
                                        <span className="truncate">{it.item?.sku || 'Article'}</span>
                                        <span className="text-muted-foreground tabular-nums shrink-0">
                                          ({it.qtySent} pcs)
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </TableCell>
                                <TableCell className="text-center tabular-nums font-semibold text-foreground py-3">
                                  {sent} pcs
                                </TableCell>
                                <TableCell className="text-center tabular-nums font-semibold text-emerald-600 dark:text-emerald-400 py-3">
                                  {received} pcs
                                </TableCell>
                                <TableCell className="text-center tabular-nums font-semibold text-red-600 dark:text-red-400 py-3">
                                  {pending} pcs
                                </TableCell>
                                <TableCell className="py-3">
                                  <Badge
                                    variant="outline"
                                    className={`inline-flex items-center gap-1 text-[11px] font-semibold py-0.5 ${statusInfo.badgeClass}`}
                                  >
                                    <StatusIcon className="h-3 w-3" />
                                    {statusInfo.label}
                                  </Badge>
                                </TableCell>
                                <TableCell className="py-3 text-muted-foreground tabular-nums">
                                  {new Date(order.sentDate).toLocaleDateString('en-PK')}
                                </TableCell>
                                <TableCell className="py-3 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 text-xs border-border/80 hover:bg-muted/60"
                                      onClick={() => handleOpenView(order)}
                                    >
                                      <Eye className="h-3 w-3 mr-1 text-muted-foreground" />
                                      View
                                    </Button>
                                    {(order.status === 'PENDING' ||
                                      order.status === 'PARTIALLY_RECEIVED') && (
                                      <>
                                        <Button
                                          size="sm"
                                          className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                                          onClick={() => handleOpenReceive(order)}
                                        >
                                          <PackageCheck className="h-3 w-3 mr-1" />
                                          Receive
                                        </Button>
                                        {order.status === 'PENDING' && (
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                                            onClick={() => handleCancelOrder(order)}
                                          >
                                            <XCircle className="h-3 w-3 mr-1" />
                                            Cancel
                                          </Button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>

      {/* ── Dialog Modals ── */}
      <BGradeSendForm
        open={isSendOpen}
        onClose={() => setIsSendOpen(false)}
        onSuccess={loadOrders}
      />

      <BGradeReceiveForm
        open={isReceiveOpen}
        order={selectedOrderForReceive}
        onClose={() => {
          setIsReceiveOpen(false);
          setSelectedOrderForReceive(null);
        }}
        onSuccess={loadOrders}
      />

      <BGradeOrderDetailsModal
        open={isViewOpen}
        orderId={viewOrderId}
        initialOrder={selectedOrderForView}
        onClose={() => {
          setIsViewOpen(false);
          setViewOrderId(null);
          setSelectedOrderForView(null);
        }}
        onReceiveClick={(order) => {
          handleOpenReceive(order);
        }}
        onCancelClick={(order) => {
          handleCancelOrder(order);
        }}
      />
    </div>
  );
}
