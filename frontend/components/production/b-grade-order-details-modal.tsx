'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Truck,
  PackageCheck,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Receipt,
  Building2,
  Calendar,
  FileText,
  RotateCcw,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { bGradeRefreshApi, BGradeRefreshOrder } from '@/lib/api';

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

interface BGradeOrderDetailsModalProps {
  open: boolean;
  orderId: string | null;
  initialOrder?: BGradeRefreshOrder | null;
  onClose: () => void;
  onReceiveClick?: (order: BGradeRefreshOrder) => void;
  onCancelClick?: (order: BGradeRefreshOrder) => void;
}

export function BGradeOrderDetailsModal({
  open,
  orderId,
  initialOrder,
  onClose,
  onReceiveClick,
  onCancelClick,
}: BGradeOrderDetailsModalProps) {
  const [fetchedOrder, setFetchedOrder] = useState<BGradeRefreshOrder | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !orderId) {
      return;
    }
    let ignore = false;
    queueMicrotask(() => {
      if (ignore) return;
      setLoading(true);
      bGradeRefreshApi
        .getOrderById(orderId)
        .then((data) => {
          if (!ignore && data) {
            setFetchedOrder(data);
          }
        })
        .catch((err) => {
          console.error('Failed to fetch refresh order details:', err);
        })
        .finally(() => {
          if (!ignore) {
            setLoading(false);
          }
        });
    });

    return () => {
      ignore = true;
    };
  }, [open, orderId]);

  // Derive active order: prefer fetched freshest details, fallback to initialOrder
  const order = useMemo(() => {
    if (fetchedOrder && fetchedOrder.id === orderId) {
      return fetchedOrder;
    }
    if (initialOrder && initialOrder.id === orderId) {
      return initialOrder;
    }
    return fetchedOrder;
  }, [fetchedOrder, initialOrder, orderId]);

  // Aggregate metrics
  const {
    totalSent,
    totalReceived,
    pendingReturn,
    totalDispatchedValue,
    totalRefreshExpense,
  } = useMemo(() => {
    if (!order) {
      return {
        totalSent: 0,
        totalReceived: 0,
        pendingReturn: 0,
        totalDispatchedValue: 0,
        totalRefreshExpense: 0,
      };
    }

    const items = order.items || [];
    const sent = items.reduce((s, it) => s + (Number(it.qtySent) || 0), 0);
    const rcvd = items.reduce((s, it) => s + (Number(it.qtyReceived) || 0), 0);
    const pending = Math.max(0, sent - rcvd);
    const val = items.reduce(
      (s, it) => s + (Number(it.qtySent) || 0) * (Number(it.bUnitValue) || 0),
      0,
    );
    const expense = (order.receivings || []).reduce(
      (s, r) => s + (Number(r.totalRefreshCost) || 0),
      0,
    );

    return {
      totalSent: sent,
      totalReceived: rcvd,
      pendingReturn: pending,
      totalDispatchedValue: val,
      totalRefreshExpense: expense,
    };
  }, [order]);

  if (!open) return null;

  const statusKey = order?.status || 'PENDING';
  const statusInfo = STATUS_MAP[statusKey] || STATUS_MAP.PENDING;
  const StatusIcon = statusInfo.icon;

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent
        noScroll={true}
        className="sm:max-w-5xl w-[96vw] max-h-[92vh] flex flex-col p-0 gap-0 border border-border shadow-2xl rounded-xl bg-background overflow-hidden"
      >
        {/* ── Dialog Header ── */}
        <DialogHeader className="p-5 pb-4 border-b bg-muted/20 shrink-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pr-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Truck className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-lg font-bold tabular-nums tracking-tight text-foreground">
                    {order?.orderNumber || 'Refresh Order'}
                  </DialogTitle>
                  <Badge
                    variant="outline"
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold py-0.5 ${statusInfo.badgeClass}`}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {statusInfo.label}
                  </Badge>
                  {loading && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-1" />
                  )}
                </div>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Sent Date:{' '}
                    <strong className="text-foreground font-normal">
                      {order?.sentDate
                        ? new Date(order.sentDate).toLocaleDateString('en-PK', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : '—'}
                    </strong>
                  </span>
                  <span>•</span>
                  <span>
                    Vendor:{' '}
                    <strong className="text-foreground">
                      {order?.supplier?.name || '—'}
                    </strong>
                    {order?.supplier?.code ? ` (${order.supplier.code})` : ''}
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    Source WH:{' '}
                    <strong className="text-foreground">
                      {order?.bGradeWarehouse?.name || '—'}
                    </strong>
                  </span>
                </DialogDescription>
              </div>
            </div>

            {/* Quick Action Buttons in Header */}
            {order && (order.status === 'PENDING' || order.status === 'PARTIALLY_RECEIVED') && (
              <div className="flex items-center gap-2 self-end sm:self-center">
                {onReceiveClick && (
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                    onClick={() => {
                      onClose();
                      onReceiveClick(order);
                    }}
                  >
                    <PackageCheck className="h-3.5 w-3.5 mr-1.5" />
                    Receive Stock
                  </Button>
                )}
                {order.status === 'PENDING' && onCancelClick && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                    onClick={() => {
                      onClose();
                      onCancelClick(order);
                    }}
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1" />
                    Cancel Order
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogHeader>

        {/* ── Scrollable Body ── */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border border-border/80 shadow-2xs bg-card">
              <CardContent className="p-3.5">
                <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
                  <span>Total Sent</span>
                  <Truck className="h-3.5 w-3.5 text-amber-500" />
                </div>
                <div className="text-xl font-bold tabular-nums text-foreground">
                  {totalSent} <span className="text-xs font-normal text-muted-foreground">pcs</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Initial B-Grade dispatch
                </p>
              </CardContent>
            </Card>

            <Card className="border border-border/80 shadow-2xs bg-card">
              <CardContent className="p-3.5">
                <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
                  <span>Received Sound</span>
                  <PackageCheck className="h-3.5 w-3.5 text-emerald-500" />
                </div>
                <div className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                  {totalReceived} <span className="text-xs font-normal text-muted-foreground">pcs</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Restored to A-Grade stock
                </p>
              </CardContent>
            </Card>

            <Card className="border border-border/80 shadow-2xs bg-card">
              <CardContent className="p-3.5">
                <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
                  <span>Pending at Vendor</span>
                  <Clock className="h-3.5 w-3.5 text-red-500" />
                </div>
                <div className="text-xl font-bold tabular-nums text-red-600 dark:text-red-400">
                  {pendingReturn} <span className="text-xs font-normal text-muted-foreground">pcs</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Still under alteration
                </p>
              </CardContent>
            </Card>

            <Card className="border border-border/80 shadow-2xs bg-card">
              <CardContent className="p-3.5">
                <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
                  <span>Alteration Expense</span>
                  <Receipt className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="text-xl font-bold tabular-nums text-foreground">
                  Rs. {totalRefreshExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Total vendor CMT billed
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Notes Callout if present */}
          {order?.notes && (
            <div className="p-3 bg-muted/40 rounded-lg border border-border/60 text-xs flex items-start gap-2.5">
              <FileText className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <strong className="text-foreground">Dispatch / Alteration Instructions:</strong>
                <p className="text-muted-foreground mt-0.5 whitespace-pre-wrap">{order.notes}</p>
              </div>
            </div>
          )}

          {/* ── Section 1: Dispatched Items (Phase 1) ── */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-primary" />
                Phase 1: Dispatched Items (Outbound from {order?.bGradeWarehouse?.name || 'B-Warehouse'})
              </h3>
              <Badge variant="outline" className="text-[10px] font-mono">
                {order?.items?.length || 0} Article{(order?.items?.length || 0) > 1 ? 's' : ''}
              </Badge>
            </div>

            <div className="border border-border/80 rounded-lg overflow-hidden bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="text-xs bg-muted/40">
                    <TableHead className="font-semibold">Article / SKU</TableHead>
                    <TableHead className="text-center tabular-nums font-semibold">Sent</TableHead>
                    <TableHead className="text-center tabular-nums font-semibold">Received</TableHead>
                    <TableHead className="text-center tabular-nums font-semibold">Pending</TableHead>
                    <TableHead className="text-right tabular-nums font-semibold">B-Unit Valuation</TableHead>
                    <TableHead className="text-right tabular-nums font-semibold">Target A-Cost</TableHead>
                    <TableHead className="text-right tabular-nums font-semibold">Total Dispatched Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(order?.items || []).map((it) => {
                    const sent = Number(it.qtySent) || 0;
                    const rcvd = Number(it.qtyReceived) || 0;
                    const rem = Math.max(0, sent - rcvd);
                    const bVal = Number(it.bUnitValue) || 0;
                    const aCost = Number(it.aFinalUnitCost) || 0;
                    const totalLineVal = sent * bVal;

                    return (
                      <TableRow key={it.id} className="text-xs hover:bg-muted/20">
                        <TableCell className="py-2.5">
                          <div className="font-medium text-foreground">
                            {it.item?.sku || 'Article'}
                          </div>
                          {it.item?.description && (
                            <div className="text-[11px] text-muted-foreground line-clamp-1">
                              {it.item.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center tabular-nums font-semibold py-2.5">
                          {sent} pcs
                        </TableCell>
                        <TableCell className="text-center tabular-nums font-semibold text-emerald-600 dark:text-emerald-400 py-2.5">
                          {rcvd} pcs
                        </TableCell>
                        <TableCell className="text-center tabular-nums font-semibold text-red-600 dark:text-red-400 py-2.5">
                          {rem} pcs
                        </TableCell>
                        <TableCell className="text-right tabular-nums py-2.5 text-muted-foreground">
                          Rs. {bVal.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums py-2.5 text-muted-foreground">
                          Rs. {aCost.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold py-2.5 text-foreground">
                          Rs. {totalLineVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <tfoot>
                  <TableRow className="bg-muted/30 font-semibold text-xs border-t">
                    <TableCell className="py-2.5">Totals</TableCell>
                    <TableCell className="text-center tabular-nums py-2.5">
                      {totalSent} pcs
                    </TableCell>
                    <TableCell className="text-center tabular-nums text-emerald-600 dark:text-emerald-400 py-2.5">
                      {totalReceived} pcs
                    </TableCell>
                    <TableCell className="text-center tabular-nums text-red-600 dark:text-red-400 py-2.5">
                      {pendingReturn} pcs
                    </TableCell>
                    <TableCell colSpan={2} className="py-2.5 text-right text-muted-foreground text-[11px]">
                      Net Dispatched Valuation:
                    </TableCell>
                    <TableCell className="text-right tabular-nums py-2.5 text-foreground">
                      Rs. {totalDispatchedValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                </tfoot>
              </Table>
            </div>
          </div>

          {/* ── Section 2: Inbound Receivings & Alteration Billing (Phase 2) ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <PackageCheck className="h-3.5 w-3.5 text-emerald-600" />
                Phase 2: Inbound Returns & Alteration Invoices
              </h3>
              <Badge variant="outline" className="text-[10px] font-mono">
                {order?.receivings?.length || 0} Inbound Receiving{(order?.receivings?.length || 0) === 1 ? '' : 's'}
              </Badge>
            </div>

            {(!order?.receivings || order.receivings.length === 0) ? (
              <div className="border border-dashed border-border/80 rounded-lg p-6 flex flex-col items-center justify-center text-center space-y-2 bg-muted/10">
                <RotateCcw className="h-7 w-7 text-muted-foreground/40" />
                <div className="text-xs font-medium text-muted-foreground">
                  No sound stock returns have been recorded yet for this order.
                </div>
                <p className="text-[11px] text-muted-foreground/80 max-w-sm">
                  Once garments are repaired and returned by {order?.supplier?.name || 'the vendor'}, use the Receive option to record incoming stock, assign sound unit cost, and auto-generate the CMT invoice.
                </p>
                {order && (order.status === 'PENDING' || order.status === 'PARTIALLY_RECEIVED') && onReceiveClick && (
                  <Button
                    size="sm"
                    className="mt-2 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium h-7"
                    onClick={() => {
                      onClose();
                      onReceiveClick(order);
                    }}
                  >
                    <PackageCheck className="h-3 w-3 mr-1" />
                    Receive Garments Now
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {order.receivings.map((rcv) => {
                  const rcvTotalCost = Number(rcv.totalRefreshCost) || 0;
                  const rcvCostPerPc = Number(rcv.refreshCostPerPc) || 0;

                  return (
                    <div
                      key={rcv.id}
                      className="border border-border/80 rounded-lg bg-card overflow-hidden shadow-2xs space-y-0"
                    >
                      {/* Receiving Header Bar */}
                      <div className="p-3.5 bg-muted/30 border-b border-border/70 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-foreground">
                            {rcv.receivingNumber}
                          </span>
                          <span className="text-muted-foreground">|</span>
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(rcv.receivedDate).toLocaleDateString('en-PK', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                          <span className="text-muted-foreground">|</span>
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-emerald-600" />
                            Sound WH:{' '}
                            <strong className="text-foreground font-normal">
                              {rcv.aGradeWarehouse?.name || '—'}
                            </strong>
                          </span>
                        </div>

                        {/* Linked Purchase Invoice details */}
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground text-[11px]">CMT Invoice:</span>
                          {rcv.purchaseInvoice ? (
                            <div className="flex items-center gap-1.5">
                              <Badge
                                variant="outline"
                                className="font-mono text-[11px] bg-primary/5 text-primary border-primary/30"
                              >
                                <Receipt className="h-3 w-3 mr-1" />
                                {rcv.purchaseInvoice.invoiceNumber}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-medium ${
                                  rcv.purchaseInvoice.paymentStatus === 'PAID'
                                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30'
                                }`}
                              >
                                {rcv.purchaseInvoice.paymentStatus || 'UNPAID'}
                              </Badge>
                            </div>
                          ) : (
                            <Badge variant="outline" className="text-[11px] text-muted-foreground">
                              Not generated
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Items received in this entry */}
                      <Table>
                        <TableHeader>
                          <TableRow className="text-xs bg-muted/15 border-b">
                            <TableHead className="font-semibold py-2">Article SKU</TableHead>
                            <TableHead className="text-center tabular-nums font-semibold py-2">
                              Qty Received
                            </TableHead>
                            <TableHead className="text-right tabular-nums font-semibold py-2">
                              Refresh Cost / pc
                            </TableHead>
                            <TableHead className="text-right tabular-nums font-semibold py-2">
                              Total Alteration Line
                            </TableHead>
                            <TableHead className="text-right tabular-nums font-semibold py-2">
                              Recalculated Sound A-Cost
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(rcv.items || []).map((rit) => {
                            const qRcv = Number(rit.qtyReceived) || 0;
                            const unitCost = Number(rit.refreshCostPerPc) || rcvCostPerPc;
                            const lineTotal = qRcv * unitCost;

                            // Find original order item to get target sound A-Cost or B-Unit Value
                            const originalOrderItem = (order.items || []).find(
                              (oi) => oi.id === rit.orderItemId || oi.itemId === rit.itemId,
                            );
                            const origACost = Number(originalOrderItem?.aFinalUnitCost) || 0;
                            const resultingSoundCost = origACost + unitCost;

                            return (
                              <TableRow key={rit.id} className="text-xs hover:bg-muted/10">
                                <TableCell className="py-2">
                                  <span className="font-medium text-foreground">
                                    {rit.item?.sku || originalOrderItem?.item?.sku || 'Article'}
                                  </span>
                                </TableCell>
                                <TableCell className="text-center tabular-nums font-semibold text-emerald-600 dark:text-emerald-400 py-2">
                                  {qRcv} pcs
                                </TableCell>
                                <TableCell className="text-right tabular-nums py-2 text-muted-foreground">
                                  Rs. {unitCost.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right tabular-nums font-semibold text-foreground py-2">
                                  Rs. {lineTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell className="text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400 py-2">
                                  Rs. {resultingSoundCost.toFixed(2)}
                                  <span className="text-[10px] text-muted-foreground ml-1">
                                    (Orig: Rs. {origACost.toFixed(2)} + Alteration: Rs. {unitCost.toFixed(2)})
                                  </span>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>

                      {/* Receiving Footer with total invoice line */}
                      <div className="p-3 bg-muted/20 border-t flex items-center justify-between text-xs">
                        {rcv.notes ? (
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                            <span className="font-semibold text-foreground">Note:</span>
                            {rcv.notes}
                          </div>
                        ) : (
                          <div />
                        )}
                        <div className="flex items-center gap-2 font-medium">
                          <span className="text-muted-foreground">Total Inbound Alteration Bill:</span>
                          <span className="font-bold tabular-nums text-foreground">
                            Rs. {rcvTotalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── Dialog Footer ── */}
        <div className="p-4 border-t bg-muted/20 shrink-0 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Order Ref: <span className="font-mono font-semibold text-foreground">{order?.orderNumber}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={onClose}>
              Close
            </Button>
            {order && (order.status === 'PENDING' || order.status === 'PARTIALLY_RECEIVED') && onReceiveClick && (
              <Button
                size="sm"
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                onClick={() => {
                  onClose();
                  onReceiveClick(order);
                }}
              >
                <PackageCheck className="h-3.5 w-3.5 mr-1" />
                Receive Stock
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
