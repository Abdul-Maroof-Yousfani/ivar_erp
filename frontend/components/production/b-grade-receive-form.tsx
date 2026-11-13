'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Autocomplete, AutocompleteOption } from '@/components/ui/autocomplete';
import { toast } from 'sonner';
import {
  PackageCheck,
  Loader2,
  Receipt,
  Building2,
  RotateCcw,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { warehouseApi, bGradeRefreshApi, BGradeRefreshOrder, Warehouse } from '@/lib/api';

interface StagedReceiveItem {
  orderItemId: string;
  itemId: string;
  sku: string;
  description: string;
  qtySent: number;
  qtyAlreadyReceived: number;
  qtyAlreadyReturnedB: number;
  qtyRemaining: number;
  qtyNowFresh: number;
  qtyNowBGrade: number;
  aFinalUnitCost: number;
  bUnitValue: number;
}

interface BGradeReceiveFormProps {
  open: boolean;
  order: BGradeRefreshOrder | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function BGradeReceiveForm({ open, order, onClose, onSuccess }: BGradeReceiveFormProps) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [refreshCostPerPc, setRefreshCostPerPc] = useState<number | ''>(0);
  const [receivedDate, setReceivedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [receiveItems, setReceiveItems] = useState<StagedReceiveItem[]>([]);
  const [loadingWh, setLoadingWh] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadWarehouses = useCallback(async () => {
    setLoadingWh(true);
    try {
      const whs = await warehouseApi.getAll();
      const whList = Array.isArray(whs)
        ? whs
        : Array.isArray((whs as { data?: Warehouse[] })?.data)
          ? (whs as { data: Warehouse[] }).data
          : [];
      setWarehouses(whList);
    } catch {
      toast.error('Failed to load warehouses');
    } finally {
      setLoadingWh(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    if (open && order) {
      queueMicrotask(() => {
        if (!ignore) {
          loadWarehouses();
          setSelectedWarehouseId('');
          setRefreshCostPerPc(0);
          setReceivedDate(new Date().toISOString().split('T')[0]);
          setNotes('');

          const items: StagedReceiveItem[] = (order.items || [])
            .map((oi) => {
              const qtySent = Number(oi.qtySent) || 0;
              const qtyReceived = Number(oi.qtyReceived) || 0;
              const qtyReturnedB = Number(oi.qtyReturnedBGrade) || 0;
              const remaining = Math.max(0, qtySent - (qtyReceived + qtyReturnedB));
              return {
                orderItemId: oi.id,
                itemId: oi.itemId,
                sku: oi.item?.sku || 'Unknown',
                description: oi.item?.description || '',
                qtySent,
                qtyAlreadyReceived: qtyReceived,
                qtyAlreadyReturnedB: qtyReturnedB,
                qtyRemaining: remaining,
                qtyNowFresh: remaining,
                qtyNowBGrade: 0,
                aFinalUnitCost: Number(oi.aFinalUnitCost) || 0,
                bUnitValue: Number(oi.bUnitValue) || 0,
              };
            })
            .filter((i) => i.qtyRemaining > 0);

          setReceiveItems(items);
        }
      });
    }
    return () => {
      ignore = true;
    };
  }, [open, order, loadWarehouses]);

  const updateNowFresh = (orderItemId: string, value: number) => {
    setReceiveItems((prev) =>
      prev.map((i) => {
        if (i.orderItemId !== orderItemId) return i;
        const maxAllowed = Math.max(0, i.qtyRemaining - i.qtyNowBGrade);
        return {
          ...i,
          qtyNowFresh: Math.max(0, Math.min(value, maxAllowed)),
        };
      }),
    );
  };

  const updateNowBGrade = (orderItemId: string, value: number) => {
    setReceiveItems((prev) =>
      prev.map((i) => {
        if (i.orderItemId !== orderItemId) return i;
        const maxAllowed = Math.max(0, i.qtyRemaining - i.qtyNowFresh);
        return {
          ...i,
          qtyNowBGrade: Math.max(0, Math.min(value, maxAllowed)),
        };
      }),
    );
  };

  const setAllFresh = () => {
    setReceiveItems((prev) =>
      prev.map((i) => ({
        ...i,
        qtyNowFresh: i.qtyRemaining,
        qtyNowBGrade: 0,
      })),
    );
  };

  const clearAll = () => {
    setReceiveItems((prev) =>
      prev.map((i) => ({
        ...i,
        qtyNowFresh: 0,
        qtyNowBGrade: 0,
      })),
    );
  };

  const warehouseOptions = useMemo<AutocompleteOption[]>(
    () =>
      Array.isArray(warehouses)
        ? warehouses.map((w) => ({
            value: w.id,
            label: w.code ? `${w.name} (${w.code})` : w.name,
            description: w.code || '',
          }))
        : [],
    [warehouses],
  );

  const selectedWarehouse = useMemo(
    () => warehouses.find((w) => w.id === selectedWarehouseId),
    [warehouses, selectedWarehouseId],
  );

  const totalNowFresh = receiveItems.reduce((s, i) => s + i.qtyNowFresh, 0);
  const totalNowBGrade = receiveItems.reduce((s, i) => s + i.qtyNowBGrade, 0);
  const totalTotalNow = totalNowFresh + totalNowBGrade;
  const costRate = Number(refreshCostPerPc) || 0;
  const bCostRate = costRate * 0.5; // 50% rate for returned B-grade pieces (Rs. 60 when fresh is Rs. 120)
  const freshInvoiceAmount = totalNowFresh * costRate;
  const bInvoiceAmount = totalNowBGrade * bCostRate;
  const totalRefreshInvoiceAmount = freshInvoiceAmount + bInvoiceAmount;
  const totalStillRemainingAtVendor = receiveItems.reduce(
    (s, i) => s + (i.qtyRemaining - (i.qtyNowFresh + i.qtyNowBGrade)),
    0,
  );

  const handleSubmit = async () => {
    if (!order) return;
    if (totalNowFresh > 0 && !selectedWarehouseId) {
      toast.error('Please select the Destination Sound Warehouse for fresh garments.');
      return;
    }
    if (totalTotalNow <= 0) {
      toast.error('Please enter at least 1 piece to receive (either Fresh A-Grade or Returned B-Grade).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await bGradeRefreshApi.createReceiving({
        orderId: order.id,
        aGradeWarehouseId: selectedWarehouseId || order.bGradeWarehouseId,
        refreshCostPerPc: costRate,
        receivedDate,
        notes: notes.trim() || undefined,
        items: receiveItems
          .filter((i) => i.qtyNowFresh > 0 || i.qtyNowBGrade > 0)
          .map((i) => ({
            orderItemId: i.orderItemId,
            itemId: i.itemId,
            qtyReceived: i.qtyNowFresh,
            qtyReturnedBGrade: i.qtyNowBGrade,
          })),
      });

      const parts: string[] = [];
      if (totalNowFresh > 0) parts.push(`${totalNowFresh} fresh pieces credited to sound stock`);
      if (totalNowBGrade > 0) parts.push(`${totalNowBGrade} defective pieces returned to B-grade WH`);

      toast.success(`Received: ${parts.join(', ')}! Order is now ${res.orderStatus}.`);
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to process receiving';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent noScroll={true} className="sm:max-w-5xl w-[96vw] max-h-[92vh] flex flex-col p-0 gap-0 border border-border shadow-2xl rounded-xl bg-background overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-5 pb-4 border-b bg-muted/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <PackageCheck className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold tabular-nums tracking-tight text-foreground flex items-center gap-2">
                Receive Refreshed Stock — {order.orderNumber}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Vendor: <strong className="text-foreground">{order.supplier?.name}</strong> • Dispatched from Source B-WH: <strong className="text-foreground">{order.bGradeWarehouse?.name}</strong>
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Top Form Controls: Sound WH, Refresh Rate, Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-emerald-500" />
                Destination Sound Warehouse (A-Grade) <span className="text-destructive">*</span>
              </Label>
              <Autocomplete
                options={warehouseOptions}
                value={selectedWarehouseId}
                onValueChange={setSelectedWarehouseId}
                placeholder="Select Sound Warehouse..."
                searchPlaceholder="Search warehouse..."
                disabled={loadingWh || submitting}
              />
              <p className="text-[11px] text-muted-foreground">
                Warehouse where fresh sound stock will be inbounded
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5 text-primary" />
                Refresh Cost / Pc (PKR)
              </Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={refreshCostPerPc}
                onChange={(e) =>
                  setRefreshCostPerPc(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)
                }
                className="h-9 text-xs tabular-nums"
                placeholder="0 if free alteration"
                disabled={submitting}
              />
              <p className="text-[11px] text-muted-foreground">
                Vendor CMT rate billed per fresh garment
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Received Date <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={receivedDate}
                onChange={(e) => setReceivedDate(e.target.value)}
                className="h-9 text-xs tabular-nums"
                disabled={submitting}
              />
              <p className="text-[11px] text-muted-foreground">
                Inbound inventory posting date
              </p>
            </div>
          </div>

          {/* Receiving Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">Receiving Notes &amp; Observations</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. 6 pcs refreshed nicely with collar stitch; 2 pcs had fabric burn defect and returned unrepaired to B-warehouse..."
              rows={2}
              className="text-xs"
              disabled={submitting}
            />
          </div>

          {/* 2-Way Receiving Matrix Table */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Garment Receiving &amp; Grading Matrix
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Enter how many returned as <strong className="text-emerald-600 dark:text-emerald-400">Fresh (A-Grade)</strong> vs remained <strong className="text-amber-600 dark:text-amber-400">Defective (B-Grade Return)</strong>.
                </p>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                  onClick={setAllFresh}
                  disabled={submitting || receiveItems.length === 0}
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  All Fresh
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={clearAll}
                  disabled={submitting || receiveItems.length === 0}
                >
                  Reset
                </Button>
              </div>
            </div>

            {receiveItems.length === 0 ? (
              <div className="text-xs text-muted-foreground py-8 text-center border border-dashed border-border/80 rounded-lg">
                All articles in this refresh order have already been received completely.
              </div>
            ) : (
              <div className="border border-border/80 rounded-lg overflow-hidden bg-card">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-muted/40">
                      <TableHead className="font-semibold">Article / SKU</TableHead>
                      <TableHead className="text-center tabular-nums font-semibold w-24">Sent</TableHead>
                      <TableHead className="text-center tabular-nums font-semibold w-28">Prev Received</TableHead>
                      <TableHead className="text-center tabular-nums font-semibold w-28">Pending with Vendor</TableHead>
                      <TableHead className="text-center tabular-nums font-semibold w-36 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                        ✨ Fresh (A-Grade)
                      </TableHead>
                      <TableHead className="text-center tabular-nums font-semibold w-36 bg-amber-500/10 text-amber-700 dark:text-amber-300">
                        🔁 Defective (Return B)
                      </TableHead>
                      <TableHead className="text-center tabular-nums font-semibold w-28">Balance Remaining</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receiveItems.map((item) => {
                      const balance = item.qtyRemaining - (item.qtyNowFresh + item.qtyNowBGrade);
                      const maxFresh = item.qtyRemaining - item.qtyNowBGrade;
                      const maxBGrade = item.qtyRemaining - item.qtyNowFresh;

                      return (
                        <TableRow key={item.orderItemId} className="text-xs hover:bg-muted/15">
                          <TableCell className="py-2.5">
                            <span className="font-semibold text-foreground">{item.sku}</span>
                            {item.description && (
                              <span className="block text-[11px] text-muted-foreground truncate max-w-[220px]">
                                {item.description}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-center tabular-nums font-medium text-foreground py-2.5">
                            {item.qtySent} pcs
                          </TableCell>
                          <TableCell className="text-center tabular-nums text-muted-foreground py-2.5 text-[11px]">
                            {item.qtyAlreadyReceived > 0 && (
                              <span className="text-emerald-600 font-medium">{item.qtyAlreadyReceived}A </span>
                            )}
                            {item.qtyAlreadyReturnedB > 0 && (
                              <span className="text-amber-600 font-medium">{item.qtyAlreadyReturnedB}B </span>
                            )}
                            {item.qtyAlreadyReceived === 0 && item.qtyAlreadyReturnedB === 0 && '0 pcs'}
                          </TableCell>
                          <TableCell className="text-center tabular-nums font-semibold text-red-600 dark:text-red-400 py-2.5">
                            {item.qtyRemaining} pcs
                          </TableCell>

                          {/* Fresh Input */}
                          <TableCell className="text-center py-2.5 bg-emerald-500/5">
                            <div className="flex items-center justify-center gap-1">
                              <Input
                                type="number"
                                min={0}
                                max={maxFresh}
                                value={item.qtyNowFresh}
                                onChange={(e) =>
                                  updateNowFresh(
                                    item.orderItemId,
                                    parseInt(e.target.value, 10) || 0,
                                  )
                                }
                                className="w-20 text-center tabular-nums h-8 text-xs font-bold border-emerald-500/40 focus-visible:ring-emerald-500"
                                disabled={submitting}
                              />
                              <span className="text-[11px] text-muted-foreground">pcs</span>
                            </div>
                          </TableCell>

                          {/* Returned B-Grade Input */}
                          <TableCell className="text-center py-2.5 bg-amber-500/5">
                            <div className="flex items-center justify-center gap-1">
                              <Input
                                type="number"
                                min={0}
                                max={maxBGrade}
                                value={item.qtyNowBGrade}
                                onChange={(e) =>
                                  updateNowBGrade(
                                    item.orderItemId,
                                    parseInt(e.target.value, 10) || 0,
                                  )
                                }
                                className="w-20 text-center tabular-nums h-8 text-xs font-bold border-amber-500/40 focus-visible:ring-amber-500"
                                disabled={submitting}
                              />
                              <span className="text-[11px] text-muted-foreground">pcs</span>
                            </div>
                          </TableCell>

                          {/* Balance remaining with vendor */}
                          <TableCell className="text-center tabular-nums py-2.5 font-semibold">
                            {balance === 0 ? (
                              <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                                Resolved (0)
                              </Badge>
                            ) : (
                              <span className="text-red-600 dark:text-red-400">{balance} pcs</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Summary KPIs & Costing Impact */}
          {totalTotalNow > 0 && (
            <div className="space-y-3 pt-1">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-3 text-center">
                  <div className="text-[11px] text-muted-foreground font-medium flex items-center justify-center gap-1">
                    <Sparkles className="h-3 w-3 text-emerald-600" />
                    Inbound Fresh (Sound WH)
                  </div>
                  <div className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {totalNowFresh} <span className="text-xs font-normal">pcs</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    → {selectedWarehouse?.name || 'Sound Warehouse'}
                  </p>
                </div>

                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-center">
                  <div className="text-[11px] text-muted-foreground font-medium flex items-center justify-center gap-1">
                    <RotateCcw className="h-3 w-3 text-amber-600" />
                    Returned Defective (B-WH)
                  </div>
                  <div className="text-xl font-bold tabular-nums text-amber-600 dark:text-amber-400 mt-0.5">
                    {totalNowBGrade} <span className="text-xs font-normal">pcs</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    → {order.bGradeWarehouse?.name || 'B-Warehouse'}
                  </p>
                </div>

                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center">
                  <div className="text-[11px] text-muted-foreground font-medium">Pending at Vendor</div>
                  <div className="text-xl font-bold tabular-nums text-red-600 dark:text-red-400 mt-0.5">
                    {totalStillRemainingAtVendor} <span className="text-xs font-normal">pcs</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {totalStillRemainingAtVendor === 0 ? 'Full batch closed' : 'Awaiting 2nd return'}
                  </p>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3 text-center">
                  <div className="text-[11px] text-muted-foreground font-medium flex items-center justify-center gap-1">
                    <Receipt className="h-3 w-3 text-primary" />
                    CMT Refresh Bill
                  </div>
                  <div className="text-xl font-bold tabular-nums text-primary mt-0.5">
                    Rs. {totalRefreshInvoiceAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Fresh: Rs. {freshInvoiceAmount.toLocaleString()} + B: Rs. {bInvoiceAmount.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Informative Explanation of Costing Logic */}
              <div className="p-3 bg-muted/40 rounded-lg border border-border/70 space-y-1.5 text-xs">
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Automatic Inventory &amp; Costing Adjustments:</span>
                </div>
                <ul className="text-muted-foreground space-y-1 pl-6 list-disc text-[11px]">
                  {totalNowFresh > 0 && (
                    <li>
                      <strong className="text-foreground">{totalNowFresh} Fresh pcs</strong> will enter{' '}
                      <strong className="text-foreground">{selectedWarehouse?.name || 'Sound Warehouse'}</strong> at{' '}
                      <strong className="text-foreground">Original Sound Cost + Rs. {costRate.toFixed(2)}/pc</strong>.
                    </li>
                  )}
                  {totalNowBGrade > 0 && (
                    <li>
                      <strong className="text-foreground">{totalNowBGrade} Defective pcs</strong> will return to{' '}
                      <strong className="text-foreground">{order.bGradeWarehouse?.name}</strong> at{' '}
                      <strong className="text-foreground">50% of the fresh A-Grade unit cost</strong> (New B-Valuation = 50% of Fresh A-Cost).
                    </li>
                  )}
                  {totalRefreshInvoiceAmount > 0 && (
                    <li>
                      <strong className="text-foreground">CMT Purchase Invoice (PI-REFRESH) of Rs. {totalRefreshInvoiceAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong> will be auto-generated with 2 line items:
                      <span className="block mt-0.5 text-foreground/90 pl-2">
                        • Fresh (A-Grade): {totalNowFresh} pcs @ Rs. {costRate.toFixed(2)} = <strong>Rs. {freshInvoiceAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                      </span>
                      {totalNowBGrade > 0 && (
                        <span className="block mt-0.5 text-foreground/90 pl-2">
                          • Returned (B-Grade): {totalNowBGrade} pcs @ 50% rate (Rs. {bCostRate.toFixed(2)}) = <strong>Rs. {bInvoiceAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong>
                        </span>
                      )}
                    </li>
                  )}
                  <li>
                    {totalStillRemainingAtVendor === 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        All sent garments accounted for — Order will transition to COMPLETED.
                      </span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        {totalStillRemainingAtVendor} pcs remain with the vendor — Order will remain PARTIALLY_RECEIVED until subsequent return.
                      </span>
                    )}
                  </li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-muted/20 shrink-0 flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Total Accounted Now:{' '}
            <strong className="tabular-nums text-foreground">
              {totalTotalNow} pcs
            </strong>{' '}
            ({totalNowFresh} Fresh + {totalNowBGrade} Returned B)
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={submitting} className="h-8 text-xs">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || totalTotalNow <= 0 || (totalNowFresh > 0 && !selectedWarehouseId)}
              className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Processing Inbound...
                </>
              ) : (
                <>
                  <PackageCheck className="h-3.5 w-3.5 mr-1.5" />
                  Confirm Receipt &amp; Post Inventory
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
