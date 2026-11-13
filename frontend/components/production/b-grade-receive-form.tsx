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
import { PackageCheck, Loader2, Receipt, Building2, AlertTriangle } from 'lucide-react';
import { warehouseApi, bGradeRefreshApi, BGradeRefreshOrder, Warehouse } from '@/lib/api';

interface StagedReceiveItem {
  orderItemId: string;
  itemId: string;
  sku: string;
  description: string;
  qtySent: number;
  qtyAlreadyReceived: number;
  qtyRemaining: number;
  qtyNowReceiving: number;
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
      const whList = Array.isArray(whs) ? whs : (Array.isArray((whs as { data?: Warehouse[] })?.data) ? (whs as { data: Warehouse[] }).data : []);
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
              const remaining = Math.max(0, qtySent - qtyReceived);
              return {
                orderItemId: oi.id,
                itemId: oi.itemId,
                sku: oi.item?.sku || 'Unknown',
                description: oi.item?.description || '',
                qtySent,
                qtyAlreadyReceived: qtyReceived,
                qtyRemaining: remaining,
                qtyNowReceiving: remaining,
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

  const updateNowReceiving = (orderItemId: string, value: number) => {
    setReceiveItems((prev) =>
      prev.map((i) =>
        i.orderItemId === orderItemId
          ? {
              ...i,
              qtyNowReceiving: Math.max(0, Math.min(value, i.qtyRemaining)),
            }
          : i,
      ),
    );
  };

  const setAllToMax = () => {
    setReceiveItems((prev) =>
      prev.map((i) => ({
        ...i,
        qtyNowReceiving: i.qtyRemaining,
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

  const totalNowReceiving = receiveItems.reduce((s, i) => s + i.qtyNowReceiving, 0);
  const costRate = Number(refreshCostPerPc) || 0;
  const totalRefreshInvoiceAmount = totalNowReceiving * costRate;
  const totalStillRemainingAtVendor = receiveItems.reduce(
    (s, i) => s + (i.qtyRemaining - i.qtyNowReceiving),
    0,
  );

  const handleSubmit = async () => {
    if (!order) return;
    if (!selectedWarehouseId) {
      toast.error('Please select the Destination A-Grade Warehouse.');
      return;
    }
    if (totalNowReceiving <= 0) {
      toast.error('Please enter at least 1 piece to receive.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await bGradeRefreshApi.createReceiving({
        orderId: order.id,
        aGradeWarehouseId: selectedWarehouseId,
        refreshCostPerPc: costRate,
        receivedDate,
        notes: notes.trim() || undefined,
        items: receiveItems
          .filter((i) => i.qtyNowReceiving > 0)
          .map((i) => ({
            orderItemId: i.orderItemId,
            itemId: i.itemId,
            qtyReceived: i.qtyNowReceiving,
          })),
      });

      toast.success(
        `Received ${totalNowReceiving} pieces fresh into stock! Order is now ${res.orderStatus}.`,
      );
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
      <DialogContent className="sm:max-w-[1020px] w-[96vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
            <PackageCheck className="h-5 w-5 text-emerald-500" />
            Receive Refreshed Stock — {order.orderNumber}
          </DialogTitle>
          <DialogDescription>
            Record refreshed sound pieces arriving back from vendor <strong>{order.supplier?.name}</strong>.
            Cost will be adjusted and inventory credited to sound warehouse.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Order Snapshot Card */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-muted/40 border border-border/80 rounded-lg text-xs">
            <div>
              <span className="text-muted-foreground">Order: </span>
              <strong className="font-mono text-foreground">{order.orderNumber}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Vendor: </span>
              <strong className="text-foreground">{order.supplier?.name}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Source B-WH: </span>
              <strong className="text-foreground">{order.bGradeWarehouse?.name}</strong>
            </div>
            <div>
              <span className="text-muted-foreground">Dispatched On: </span>
              <strong className="text-foreground">
                {new Date(order.sentDate).toLocaleDateString('en-PK')}
              </strong>
            </div>
          </div>

          {/* Form Inputs: Destination WH, Refresh Cost, Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-emerald-500" />
                Destination Warehouse <span className="text-destructive">*</span>
              </Label>
              <Autocomplete
                options={warehouseOptions}
                value={selectedWarehouseId}
                onValueChange={setSelectedWarehouseId}
                placeholder="Select Sound WH..."
                searchPlaceholder="Search warehouse..."
                disabled={loadingWh || submitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
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
                placeholder="0 if free repair"
                disabled={submitting}
              />
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
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">Receiving Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Received in good condition, 10 pcs retained at vendor for second wash..."
              rows={2}
              className="text-xs"
              disabled={submitting}
            />
          </div>

          {/* Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-foreground">
                Garments Pending at Vendor
              </Label>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-[11px] text-emerald-600 dark:text-emerald-400 hover:text-emerald-700"
                onClick={setAllToMax}
                disabled={submitting || receiveItems.length === 0}
              >
                Receive All Remaining
              </Button>
            </div>

            {receiveItems.length === 0 ? (
              <div className="text-xs text-muted-foreground py-6 text-center border border-border/80 rounded-md">
                All articles in this refresh order have already been received completely.
              </div>
            ) : (
              <div className="border border-border/80 rounded-md overflow-hidden bg-background">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-muted/40">
                      <TableHead>Article / SKU</TableHead>
                      <TableHead className="text-right tabular-nums">Total Sent</TableHead>
                      <TableHead className="text-right tabular-nums">Prev Received</TableHead>
                      <TableHead className="text-right tabular-nums">Still At Vendor</TableHead>
                      <TableHead className="text-center tabular-nums w-28">Now Receiving</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receiveItems.map((item) => (
                      <TableRow key={item.orderItemId} className="text-xs">
                        <TableCell className="py-2">
                          <span className="font-semibold text-foreground">{item.sku}</span>
                          {item.description && (
                            <span className="block text-[11px] text-muted-foreground truncate max-w-[200px]">
                              {item.description}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-foreground py-2 font-medium">
                          {item.qtySent} pcs
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground py-2">
                          {item.qtyAlreadyReceived} pcs
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-orange-600 dark:text-orange-400 font-semibold py-2">
                          {item.qtyRemaining} pcs
                        </TableCell>
                        <TableCell className="text-center py-2">
                          <Input
                            type="number"
                            min={0}
                            max={item.qtyRemaining}
                            value={item.qtyNowReceiving}
                            onChange={(e) =>
                              updateNowReceiving(
                                item.orderItemId,
                                parseInt(e.target.value, 10) || 0,
                              )
                            }
                            className="w-20 text-center tabular-nums h-8 text-xs mx-auto font-semibold"
                            disabled={submitting}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          {/* Costing & Logistics Summary */}
          {totalNowReceiving > 0 && (
            <div className="space-y-2.5 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-2.5 text-center">
                  <div className="text-[11px] text-muted-foreground font-medium">Inbound to Sound Stock</div>
                  <div className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {totalNowReceiving} pcs
                  </div>
                </div>

                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-2.5 text-center">
                  <div className="text-[11px] text-muted-foreground font-medium">Remaining at Vendor</div>
                  <div className="text-xl font-bold tabular-nums text-orange-600 dark:text-orange-400">
                    {totalStillRemainingAtVendor} pcs
                  </div>
                </div>

                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-2.5 text-center">
                  <div className="text-[11px] text-muted-foreground font-medium">CMT Alteration Bill</div>
                  <div className="text-sm font-bold tabular-nums text-blue-600 dark:text-blue-400 mt-1">
                    {totalRefreshInvoiceAmount > 0
                      ? `Rs ${totalRefreshInvoiceAmount.toLocaleString('en-PK', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}`
                      : 'Free / Included'}
                  </div>
                </div>
              </div>

              {costRate > 0 && (
                <div className="flex items-center gap-2 p-2.5 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-md text-xs text-blue-900 dark:text-blue-200">
                  <Receipt className="h-4 w-4 text-blue-500 shrink-0" />
                  <span>
                    A CMT Purchase Invoice (PI-REFRESH) of{' '}
                    <strong className="tabular-nums">
                      Rs {totalRefreshInvoiceAmount.toLocaleString('en-PK', { minimumFractionDigits: 2 })}
                    </strong>{' '}
                    will be auto-generated. Stock will enter sound inventory with unit cost increased by{' '}
                    <strong className="tabular-nums">Rs {costRate.toFixed(2)}/pc</strong>.
                  </span>
                </div>
              )}

              {totalStillRemainingAtVendor > 0 && (
                <div className="flex items-center gap-2 p-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-md text-xs text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                  <span>
                    Partial receipt: <strong className="tabular-nums">{totalStillRemainingAtVendor} pcs</strong> will stay tracked at vendor. The order will be marked as <strong>PARTIALLY_RECEIVED</strong>.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2.5 pt-3 border-t border-border/80">
            <Button variant="outline" onClick={onClose} disabled={submitting} className="text-xs h-9">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={submitting || totalNowReceiving <= 0 || !selectedWarehouseId}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs h-9"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Processing Inbound...
                </>
              ) : (
                <>
                  <PackageCheck className="h-3.5 w-3.5 mr-1.5" />
                  Confirm Receipt &amp; Credit Sound Stock
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
