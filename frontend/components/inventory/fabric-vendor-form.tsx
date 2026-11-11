'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  fabricVendorTrackerApi,
  supplierApi,
  itemApi,
  warehouseApi,
  inventoryApi,
  FabricVendorTracker,
  Supplier,
  MasterItem,
  Warehouse,
} from '@/lib/api';
import { toast } from 'sonner';
import { AlertCircle, CheckCircle, CheckCircle2, Scale, Package, Clock, History } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface FabricVendorFormProps {
  initialData?: FabricVendorTracker | null;
  onSuccess: () => void;
  onClose: () => void;
}

export function FabricVendorForm({ initialData, onSuccess, onClose }: FabricVendorFormProps) {
  const isEditMode = !!initialData;

  // Form states for Issue Phase (Step A)
  const [supplierId, setSupplierId] = useState(initialData?.supplierId || '');
  const [itemId, setItemId] = useState(initialData?.itemId || '');
  const [warehouseId, setWarehouseId] = useState(initialData?.warehouseId || '');
  const [qtyIssued, setQtyIssued] = useState(initialData ? Number(initialData.qtyIssued) : 0);
  const [issueDate, setIssueDate] = useState(
    initialData?.issueDate ? new Date(initialData.issueDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState(initialData?.notes || '');

  // Form states for THIS Consumption Log Entry (Step B)
  const [newQtyUsed, setNewQtyUsed] = useState<number>(0);
  const [newQtyReturned, setNewQtyReturned] = useState<number>(0);
  const [newQtyShortage, setNewQtyShortage] = useState<number>(0);
  const [consumptionDate, setConsumptionDate] = useState(new Date().toISOString().split('T')[0]);
  const [logNotes, setLogNotes] = useState('');

  // Options states
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<MasterItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Available stock state
  const [availableStock, setAvailableStock] = useState<number | null>(null);
  const [loadingStock, setLoadingStock] = useState(false);

  useEffect(() => {
    if (!isEditMode) {
      loadOptions();
    }
  }, [isEditMode]);

  // Fetch available stock when both itemId and warehouseId are selected
  useEffect(() => {
    if (!isEditMode && itemId && warehouseId) {
      setLoadingStock(true);
      setAvailableStock(null);
      inventoryApi
        .getStockLevel(itemId, warehouseId)
        .then((res) => {
          setAvailableStock(Number(res.totalQuantity) || 0);
        })
        .catch((err) => {
          console.error('Failed to fetch stock level:', err);
          setAvailableStock(null);
        })
        .finally(() => setLoadingStock(false));
    } else {
      setAvailableStock(null);
    }
  }, [itemId, warehouseId, isEditMode]);

  const loadOptions = async () => {
    setLoadingOptions(true);
    try {
      const [suppliersRes, itemsRes, warehousesRes] = await Promise.all([
        supplierApi.getAll(),
        itemApi.getAll({ itemType: 'RAW_FABRIC' }),
        warehouseApi.getAll(),
      ]);

      setSuppliers(suppliersRes.data || []);
      setItems(itemsRes.data || []);
      setWarehouses(warehousesRes || []);
    } catch (error) {
      console.error('Failed to load options', error);
      toast.error('Failed to load form dropdown options');
    } finally {
      setLoadingOptions(false);
    }
  };

  // Calculations for Edit / Consumption Mode
  const qtyIssuedTotal = isEditMode && initialData ? Number(initialData.qtyIssued) : 0;
  const prevUsed = isEditMode && initialData ? Number(initialData.qtyUsed || 0) : 0;
  const prevReturned = isEditMode && initialData ? Number(initialData.qtyReturned || 0) : 0;
  const prevShortage = isEditMode && initialData ? Number(initialData.qtyShortage || 0) : 0;
  const prevTotalAccounted = prevUsed + prevReturned + prevShortage;
  const remainingBalance = qtyIssuedTotal - prevTotalAccounted;

  const thisEntryTotal = newQtyUsed + newQtyReturned + newQtyShortage;
  const projectedTotalAccounted = prevTotalAccounted + thisEntryTotal;
  const projectedRemaining = qtyIssuedTotal - projectedTotalAccounted;

  const isValidConsumption =
    !isEditMode || (thisEntryTotal > 0 && thisEntryTotal <= remainingBalance + 0.0001);
  const isCompleting = isEditMode && (Math.abs(projectedRemaining) < 0.0001 || projectedRemaining <= 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (isEditMode && initialData) {
        if (thisEntryTotal <= 0) {
          toast.error('Please enter quantity for used, returned, or shortage for this batch');
          setSubmitting(false);
          return;
        }

        if (thisEntryTotal > remainingBalance + 0.0001) {
          toast.error(
            `Entered quantity (${thisEntryTotal}m) exceeds remaining unaccounted fabric (${remainingBalance.toFixed(2)}m)`
          );
          setSubmitting(false);
          return;
        }

        await fabricVendorTrackerApi.updateConsumption(initialData.id, {
          qtyUsed: newQtyUsed,
          qtyReturned: newQtyReturned,
          qtyShortage: newQtyShortage,
          consumptionDate,
          notes: logNotes,
        });

        if (isCompleting) {
          toast.success('Fabric issue fully accounted & completed!');
        } else {
          toast.success(
            `Partial consumption logged! (${projectedRemaining.toFixed(2)}m remaining with vendor)`
          );
        }
      } else {
        if (!supplierId || !itemId || !warehouseId || qtyIssued <= 0) {
          toast.error('Please fill in all required fields');
          setSubmitting(false);
          return;
        }

        await fabricVendorTrackerApi.create({
          supplierId,
          itemId,
          warehouseId,
          qtyIssued,
          issueDate,
          notes,
        });

        toast.success('Fabric issued to vendor successfully!');
      }

      onSuccess();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {isEditMode && initialData ? (
        // Consumption / Settlement Mode (Step B)
        <div className="space-y-4">
          {/* Summary Box */}
          <div className="bg-muted/40 dark:bg-muted/20 p-3.5 rounded-xl border border-border space-y-2.5">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Fabric Consignment:</span>
                <span className="font-mono font-bold text-xs bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/20">
                  {initialData.trackerNumber}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                Issued: {new Date(initialData.issueDate).toLocaleDateString()}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">CMT Vendor</span>
                <span className="font-semibold text-foreground truncate block">{initialData.supplier?.name}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Fabric (Item)</span>
                <span className="font-semibold text-foreground truncate block">{initialData.item?.description || initialData.item?.sku}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Source Warehouse</span>
                <span className="font-semibold text-foreground truncate block">{initialData.warehouse?.name}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Total Issued</span>
                <span className="font-bold font-mono text-indigo-600 dark:text-indigo-400 block">{qtyIssuedTotal.toLocaleString()} m</span>
              </div>
            </div>
          </div>

          {/* Accounted & Remaining Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 bg-muted/40 dark:bg-muted/20 border border-border rounded-xl">
              <span className="text-[11px] font-medium text-muted-foreground block">Previously Used</span>
              <span className="text-base font-bold font-mono text-foreground mt-0.5 block">{prevUsed.toLocaleString()} m</span>
            </div>
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl">
              <span className="text-[11px] font-medium text-blue-700 dark:text-blue-300 block">Previously Returned</span>
              <span className="text-base font-bold font-mono text-blue-700 dark:text-blue-300 mt-0.5 block">{prevReturned.toLocaleString()} m</span>
            </div>
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
              <span className="text-[11px] font-medium text-amber-800 dark:text-amber-300 block">Balance Remaining</span>
              <span className="text-base font-bold font-mono text-amber-800 dark:text-amber-300 mt-0.5 block">{remainingBalance.toLocaleString()} m</span>
            </div>
          </div>

          {/* Previous Consumption Logs History Timeline (if any) */}
          {initialData.consumptionLogs && initialData.consumptionLogs.length > 0 && (
            <div className="space-y-2 border-t border-border pt-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <History className="h-3.5 w-3.5 text-indigo-500" /> Previous Settlement Logs
              </h4>
              <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                {initialData.consumptionLogs.map((log, idx) => (
                  <div key={log.id || idx} className="p-2 bg-muted/30 border border-border rounded-lg text-xs flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-foreground">
                        Log #{initialData.consumptionLogs!.length - idx} &bull; {new Date(log.consumptionDate || log.createdAt).toLocaleDateString()}
                      </span>
                      {log.notes && <p className="text-muted-foreground italic text-[11px] mt-0.5">{log.notes}</p>}
                    </div>
                    <div className="flex gap-1.5 font-mono text-[11px]">
                      {Number(log.qtyUsed) > 0 && <Badge variant="outline" className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">Used: {log.qtyUsed}m</Badge>}
                      {Number(log.qtyReturned) > 0 && <Badge variant="outline" className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30">Returned: {log.qtyReturned}m</Badge>}
                      {Number(log.qtyShortage) > 0 && <Badge variant="outline" className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30">Shortage: {log.qtyShortage}m</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Form to Log New Batch Settlement */}
          <div className="border-t border-border pt-3.5 space-y-3.5">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Scale className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                This Settlement Entry
              </h4>
              <span className="text-[11px] text-muted-foreground">
                Max available: <strong className="font-mono text-foreground">{remainingBalance} m</strong>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="qtyUsed" className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Qty Used</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Meters</span>
                </Label>
                <Input
                  id="qtyUsed"
                  type="number"
                  min="0"
                  max={remainingBalance}
                  step="0.0001"
                  value={newQtyUsed || ''}
                  onChange={(e) => setNewQtyUsed(e.target.value === '' ? 0 : Number(e.target.value))}
                  placeholder="0"
                  className="h-9 font-mono text-sm bg-background border-input"
                />
                <p className="text-[10px] text-muted-foreground">Manual cutting / usage</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="qtyReturned" className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Qty Returned</span>
                  <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold font-mono">Restocked</span>
                </Label>
                <Input
                  id="qtyReturned"
                  type="number"
                  min="0"
                  max={remainingBalance}
                  step="0.0001"
                  value={newQtyReturned || ''}
                  onChange={(e) => setNewQtyReturned(e.target.value === '' ? 0 : Number(e.target.value))}
                  placeholder="0"
                  className="h-9 font-mono text-sm bg-background border-input"
                />
                <p className="text-[10px] text-blue-600 dark:text-blue-400">Adds back to warehouse</p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="qtyShortage" className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Qty Shortage</span>
                  <span className="text-[10px] text-red-600 dark:text-red-400 font-semibold font-mono">Loss / Defect</span>
                </Label>
                <Input
                  id="qtyShortage"
                  type="number"
                  min="0"
                  max={remainingBalance}
                  step="0.0001"
                  value={newQtyShortage || ''}
                  onChange={(e) => setNewQtyShortage(e.target.value === '' ? 0 : Number(e.target.value))}
                  placeholder="0"
                  className="h-9 font-mono text-sm bg-background border-input"
                />
                <p className="text-[10px] text-muted-foreground">Wastage / damaged roll</p>
              </div>
            </div>

            {/* Validation & Projected Indicator */}
            <div className="bg-muted/40 dark:bg-muted/20 p-3.5 rounded-xl border border-border space-y-2.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                  Accounted After Entry:
                  <strong className="font-mono text-sm text-foreground">{projectedTotalAccounted.toFixed(2)}</strong>
                  <span className="text-muted-foreground font-normal">/ {qtyIssuedTotal} m</span>
                </span>
                {thisEntryTotal > remainingBalance + 0.0001 ? (
                  <Badge variant="outline" className="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30 text-[11px] font-semibold">
                    <AlertCircle className="h-3 w-3 mr-1" /> Exceeds Remaining ({remainingBalance}m)
                  </Badge>
                ) : isCompleting ? (
                  <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[11px] font-semibold">
                    <CheckCircle className="h-3 w-3 mr-1" /> Will Mark COMPLETED
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/30 text-[11px] font-semibold">
                    <Clock className="h-3 w-3 mr-1" /> Status: PARTIAL ({projectedRemaining.toFixed(2)}m left)
                  </Badge>
                )}
              </div>

              {/* Progress Visualizer */}
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden flex">
                <div
                  className={`h-full transition-all duration-300 ${isCompleting ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                  style={{ width: `${Math.min(100, (projectedTotalAccounted / qtyIssuedTotal) * 100)}%` }}
                  title={`Accounted: ${projectedTotalAccounted}m`}
                />
              </div>

              <div className="grid grid-cols-3 text-[11px] text-muted-foreground pt-1 border-t border-border/50 text-center font-mono">
                <div>Prev: <strong className="text-foreground">{prevTotalAccounted}m</strong></div>
                <div>This Entry: <strong className="text-indigo-600 dark:text-indigo-400">{thisEntryTotal}m</strong></div>
                <div>Remaining: <strong className="text-amber-700 dark:text-amber-400">{projectedRemaining > 0 ? projectedRemaining.toFixed(2) : 0}m</strong></div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="consumptionDate" className="text-xs font-semibold text-foreground">Settlement Date</Label>
                <Input
                  id="consumptionDate"
                  type="date"
                  required
                  value={consumptionDate}
                  onChange={(e) => setConsumptionDate(e.target.value)}
                  className="h-9 text-xs bg-background"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="logNotes" className="text-xs font-semibold text-foreground">Settlement Notes / Remarks</Label>
                <Input
                  id="logNotes"
                  type="text"
                  value={logNotes}
                  onChange={(e) => setLogNotes(e.target.value)}
                  placeholder="e.g. 20m fabric returned to store"
                  className="h-9 text-xs bg-background"
                />
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Issue Mode (Step A)
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Vendor (Supplier)</label>
              {loadingOptions ? (
                <div className="h-10 bg-muted animate-pulse rounded-md" />
              ) : (
                <Select value={supplierId} onValueChange={setSupplierId} required>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select Vendor" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold">Fabric (Item)</label>
              {loadingOptions ? (
                <div className="h-10 bg-muted animate-pulse rounded-md" />
              ) : (
                <Select value={itemId} onValueChange={setItemId} required>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select Fabric" />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.sku} - {i.description || 'No description'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {/* Available Stock Indicator */}
              {itemId && warehouseId && (
                <div className="flex items-center gap-1.5 mt-1">
                  <Package className="h-3.5 w-3.5 text-muted-foreground" />
                  {loadingStock ? (
                    <span className="text-xs text-muted-foreground animate-pulse">Checking stock...</span>
                  ) : availableStock !== null ? (
                    <Badge
                      variant="outline"
                      className={`text-xs font-semibold ${
                        availableStock > 0
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-red-200 bg-red-50 text-red-700'
                      }`}
                    >
                      Available: {availableStock.toLocaleString()} meters
                    </Badge>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Source Store / Warehouse</label>
              {loadingOptions ? (
                <div className="h-10 bg-muted animate-pulse rounded-md" />
              ) : (
                <Select value={warehouseId} onValueChange={setWarehouseId} required>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select Warehouse" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold">Qty Issued (Meters)</label>
              <Input
                type="number"
                min="0.0001"
                step="0.0001"
                required
                value={qtyIssued || ''}
                onChange={(e) => setQtyIssued(Number(e.target.value))}
                placeholder="e.g. 100"
                className="h-10"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Issue Date</label>
              <Input
                type="date"
                required
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="h-10"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold">Notes / Remarks</label>
              <Input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional remarks"
                className="h-10"
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2.5 border-t border-border pt-4">
        <Button variant="outline" type="button" size="sm" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-2xs"
          disabled={submitting || (isEditMode && !isValidConsumption)}
        >
          {submitting ? (
            'Saving...'
          ) : isEditMode ? (
            isCompleting ? (
              <>
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                Save Settlement & Mark Complete
              </>
            ) : (
              <>
                <Scale className="h-4 w-4 mr-1.5" />
                Save Settlement Entry
              </>
            )
          ) : (
            'Issue Fabric to Vendor'
          )}
        </Button>
      </div>
    </form>
  );
}
