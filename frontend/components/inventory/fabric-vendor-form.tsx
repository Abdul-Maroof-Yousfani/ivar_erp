'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { Info, HelpCircle, AlertCircle, CheckCircle, Scale, ChevronRight, Package } from 'lucide-react';
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

  // Form states for Consumption Phase (Step B)
  const [qtyUsed, setQtyUsed] = useState(initialData ? Number(initialData.qtyUsed) : 0);
  const [qtyReturned, setQtyReturned] = useState(initialData ? Number(initialData.qtyReturned) : 0);
  const [qtyShortage, setQtyShortage] = useState(initialData ? Number(initialData.qtyShortage) : 0);
  const [consumptionDate, setConsumptionDate] = useState(
    initialData?.consumptionDate
      ? new Date(initialData.consumptionDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0]
  );

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
      inventoryApi.getStockLevel(itemId, warehouseId)
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
      // Filter items to only show meters / fabric if possible, but let's show all items
      // (or filter items with UOM meter or type fabric if their description/sku mentions it)
      setItems(itemsRes.data || []);
      setWarehouses(warehousesRes || []);
    } catch (error) {
      console.error('Failed to load options', error);
      toast.error('Failed to load form dropdown options');
    } finally {
      setLoadingOptions(false);
    }
  };

  // Real-time calculation and validation
  const sum = qtyUsed + qtyReturned + qtyShortage;
  const difference = isEditMode ? Number(initialData.qtyIssued) - sum : 0;
  const isValid = !isEditMode || Math.abs(difference) < 0.0001;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (isEditMode && initialData) {
        if (!isValid) {
          toast.error(`Sum of Used, Returned, and Shortage must equal Issued Qty (${initialData.qtyIssued})`);
          setSubmitting(false);
          return;
        }

        await fabricVendorTrackerApi.updateConsumption(initialData.id, {
          qtyUsed,
          qtyReturned,
          qtyShortage,
          consumptionDate,
          notes,
        });

        toast.success('Fabric usage and returns logged successfully!');
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
          <div className="bg-muted/40 p-4 rounded-xl border border-border space-y-3">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Original Issue Details</h4>
            <div className="grid grid-cols-2 gap-y-3 gap-x-6 text-sm">
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
                <span className="text-muted-foreground block text-xs font-semibold text-blue-600">Total Qty Issued</span>
                <span className="font-bold text-blue-600">{Number(initialData.qtyIssued).toLocaleString()} meters</span>
              </div>
            </div>
            {initialData.notes && (
              <div className="pt-2 border-t text-xs">
                <span className="text-muted-foreground block">Issue Notes:</span>
                <p className="italic">{initialData.notes}</p>
              </div>
            )}
          </div>

          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Scale className="h-5 w-5 text-indigo-500" />
              Log Consumption & Returns
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold flex items-center gap-1.5">
                  Qty Used <span className="text-xs text-muted-foreground">(Meters)</span>
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.0001"
                  required
                  value={qtyUsed || ''}
                  onChange={(e) => setQtyUsed(Number(e.target.value))}
                  placeholder="e.g. 35"
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
                  step="0.0001"
                  required
                  value={qtyReturned || ''}
                  onChange={(e) => setQtyReturned(Number(e.target.value))}
                  placeholder="e.g. 3"
                  className="h-10 font-mono text-base"
                />
                <p className="text-[11px] text-muted-foreground">Will be auto-restocked in store.</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold flex items-center gap-1.5">
                  Qty Shortage <span className="text-xs text-muted-foreground">(Meters)</span>
                </label>
                <Input
                  type="number"
                  min="0"
                  step="0.0001"
                  required
                  value={qtyShortage || ''}
                  onChange={(e) => setQtyShortage(Number(e.target.value))}
                  placeholder="e.g. 2"
                  className="h-10 font-mono text-base"
                />
              </div>
            </div>
          </div>

          {/* Validation Status Indicator */}
          <div className="bg-muted/20 p-4 rounded-xl border border-dashed space-y-3">
            <div className="flex justify-between items-center text-sm font-medium">
              <span className="flex items-center gap-2">
                Total Accounted: <span className="font-mono text-lg font-bold">{sum}</span> / {Number(initialData.qtyIssued)}
              </span>
              {isValid ? (
                <span className="text-green-600 flex items-center gap-1 text-xs">
                  <CheckCircle className="h-4 w-4" /> Balances Perfectly
                </span>
              ) : (
                <span className="text-amber-600 flex items-center gap-1 text-xs">
                  <AlertCircle className="h-4 w-4" /> Discrepancy: {difference > 0 ? `${difference} remaining` : `${Math.abs(difference)} over`}
                </span>
              )}
            </div>

            {/* Progress Visualizer */}
            <div className="w-full h-3 bg-muted rounded-full overflow-hidden flex">
              <div
                className="h-full bg-green-500 transition-all duration-300"
                style={{ width: `${(qtyUsed / Number(initialData.qtyIssued)) * 100}%` }}
                title={`Used: ${qtyUsed}`}
              />
              <div
                className="h-full bg-blue-500 transition-all duration-300 border-l border-white"
                style={{ width: `${(qtyReturned / Number(initialData.qtyIssued)) * 100}%` }}
                title={`Returned: ${qtyReturned}`}
              />
              <div
                className="h-full bg-red-400 transition-all duration-300 border-l border-white"
                style={{ width: `${(qtyShortage / Number(initialData.qtyIssued)) * 100}%` }}
                title={`Shortage: ${qtyShortage}`}
              />
            </div>

            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-green-500 rounded-sm inline-block" /> Used ({qtyUsed}m)</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-blue-500 rounded-sm inline-block" /> Returned ({qtyReturned}m)</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 bg-red-400 rounded-sm inline-block" /> Shortage ({qtyShortage}m)</span>
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
              <label className="text-sm font-semibold">Remarks / Notes</label>
              <Input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special remarks or comments"
                className="h-10"
              />
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
                placeholder="e.g. 40"
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
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
          disabled={submitting || (isEditMode && !isValid)}
        >
          {submitting ? 'Submitting...' : isEditMode ? 'Log Consumption & Complete' : 'Issue Fabric'}
        </Button>
      </div>
    </form>
  );
}
