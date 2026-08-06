'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { AlertCircle, CheckCircle, Scale, Package, Clock, History } from 'lucide-react';
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
    <form onSubmit={handleSubmit} className="space-y-6">
      {isEditMode && initialData ? (
        // Consumption Mode (Step B)
        <div className="space-y-6">
          {/* Summary Box */}
          <div className="bg-muted/40 p-4 rounded-xl border border-border space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Original Issue Details</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-y-3 gap-x-6 text-sm">
              <div>
                <span className="text-muted-foreground block text-xs">Tracker Ref</span>
                <span className="font-semibold">{initialData.trackerNumber}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">Vendor (Supplier)</span>
                <span className="font-semibold">{initialData.supplier?.name}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">Fabric (Item)</span>
                <span className="font-semibold">{initialData.item?.description || initialData.item?.sku}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">Source Store / Warehouse</span>
                <span className="font-semibold">{initialData.warehouse?.name}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs">Issue Date</span>
                <span>{new Date(initialData.issueDate).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-xs font-semibold text-indigo-600">Total Qty Issued</span>
                <span className="font-bold text-indigo-600">{qtyIssuedTotal.toLocaleString()} meters</span>
              </div>
            </div>
          </div>

          {/* Accounted & Remaining Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800">
              <span className="text-xs font-medium block">Previously Used</span>
              <span className="text-lg font-bold font-mono">{prevUsed.toLocaleString()} m</span>
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800">
              <span className="text-xs font-medium block">Previously Returned</span>
              <span className="text-lg font-bold font-mono">{prevReturned.toLocaleString()} m</span>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
              <span className="text-xs font-medium block">Balance Remaining</span>
              <span className="text-lg font-bold font-mono">{remainingBalance.toLocaleString()} m</span>
            </div>
          </div>

          {/* Previous Consumption Logs History Timeline (if any) */}
          {initialData.consumptionLogs && initialData.consumptionLogs.length > 0 && (
            <div className="space-y-2 border-t pt-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <History className="h-4 w-4 text-indigo-500" /> Previous Consumption Logs
              </h4>
              <div className="max-h-36 overflow-y-auto space-y-2 pr-1">
                {initialData.consumptionLogs.map((log, idx) => (
                  <div key={log.id || idx} className="p-2.5 bg-muted/20 border rounded-lg text-xs flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-foreground">
                        Log #{initialData.consumptionLogs!.length - idx} &bull; {new Date(log.consumptionDate || log.createdAt).toLocaleDateString()}
                      </span>
                      {log.notes && <p className="text-muted-foreground italic text-[11px] mt-0.5">{log.notes}</p>}
                    </div>
                    <div className="flex gap-2 font-mono text-[11px]">
                      {Number(log.qtyUsed) > 0 && <Badge variant="outline" className="bg-emerald-50 text-emerald-700">Used: {log.qtyUsed}m</Badge>}
                      {Number(log.qtyReturned) > 0 && <Badge variant="outline" className="bg-blue-50 text-blue-700">Returned: {log.qtyReturned}m</Badge>}
                      {Number(log.qtyShortage) > 0 && <Badge variant="outline" className="bg-red-50 text-red-700">Shortage: {log.qtyShortage}m</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Form to Log New Batch Consumption */}
          <div className="border-t pt-4 space-y-4">
            <h3 className="text-base font-bold flex items-center gap-2 text-indigo-900">
              <Scale className="h-5 w-5 text-indigo-600" />
              Log Consumption & Returns (This Batch)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold flex items-center gap-1.5">
                  Qty Used <span className="text-xs text-muted-foreground">(Meters)</span>
                </label>
                <Input
                  type="number"
                  min="0"
                  max={remainingBalance}
                  step="0.0001"
                  value={newQtyUsed || ''}
                  onChange={(e) => setNewQtyUsed(Number(e.target.value))}
                  placeholder="e.g. 50"
                  className="h-10 font-mono text-base"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold flex items-center gap-1.5">
                  Qty Returned <span className="text-xs text-muted-foreground">(Meters)</span>
                </label>
                <Input
                  type="number"
                  min="0"
                  max={remainingBalance}
                  step="0.0001"
                  value={newQtyReturned || ''}
                  onChange={(e) => setNewQtyReturned(Number(e.target.value))}
                  placeholder="e.g. 10"
                  className="h-10 font-mono text-base"
                />
                <p className="text-[11px] text-muted-foreground">Auto-restocked in store.</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold flex items-center gap-1.5">
                  Qty Shortage <span className="text-xs text-muted-foreground">(Meters)</span>
                </label>
                <Input
                  type="number"
                  min="0"
                  max={remainingBalance}
                  step="0.0001"
                  value={newQtyShortage || ''}
                  onChange={(e) => setNewQtyShortage(Number(e.target.value))}
                  placeholder="e.g. 2"
                  className="h-10 font-mono text-base"
                />
              </div>
            </div>

            {/* Validation & Projected Indicator */}
            <div className="bg-muted/20 p-4 rounded-xl border border-dashed space-y-3">
              <div className="flex justify-between items-center text-sm font-medium">
                <span className="flex items-center gap-2">
                  Accounted After Entry:{' '}
                  <span className="font-mono text-lg font-bold">{projectedTotalAccounted}</span> / {qtyIssuedTotal} m
                </span>
                {thisEntryTotal > remainingBalance + 0.0001 ? (
                  <span className="text-red-600 flex items-center gap-1 text-xs font-semibold">
                    <AlertCircle className="h-4 w-4" /> Exceeds Remaining ({remainingBalance}m)
                  </span>
                ) : isCompleting ? (
                  <span className="text-emerald-600 flex items-center gap-1 text-xs font-semibold">
                    <CheckCircle className="h-4 w-4" /> Will Mark COMPLETED
                  </span>
                ) : (
                  <span className="text-indigo-600 flex items-center gap-1 text-xs font-semibold">
                    <Clock className="h-4 w-4" /> Status: PARTIAL ({projectedRemaining.toFixed(2)}m left)
                  </span>
                )}
              </div>

              {/* Progress Visualizer */}
              <div className="w-full h-3 bg-muted rounded-full overflow-hidden flex">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${(Math.min(projectedTotalAccounted, qtyIssuedTotal) / qtyIssuedTotal) * 100}%` }}
                  title={`Accounted: ${projectedTotalAccounted}m`}
                />
              </div>

              <div className="flex justify-between text-[11px] text-muted-foreground">
                <span>Prev Accounted: {prevTotalAccounted}m</span>
                <span>This Batch: {thisEntryTotal}m</span>
                <span>Remaining: {projectedRemaining > 0 ? projectedRemaining.toFixed(2) : 0}m</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Consumption Date</label>
                <Input
                  type="date"
                  required
                  value={consumptionDate}
                  onChange={(e) => setConsumptionDate(e.target.value)}
                  className="h-10"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold">Log Remarks / Notes</label>
                <Input
                  type="text"
                  value={logNotes}
                  onChange={(e) => setLogNotes(e.target.value)}
                  placeholder="e.g. First 50m used for cutting batch #1"
                  className="h-10"
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

      <div className="flex justify-end gap-3 border-t pt-4">
        <Button variant="outline" type="button" onClick={onClose} disabled={submitting}>
          Cancel
        </Button>
        <Button
          type="submit"
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm transition-all"
          disabled={submitting || (isEditMode && !isValidConsumption)}
        >
          {submitting
            ? 'Saving...'
            : isEditMode
            ? isCompleting
              ? 'Log Consumption & Complete'
              : 'Log Partial Consumption'
            : 'Issue Fabric'}
        </Button>
      </div>
    </form>
  );
}
