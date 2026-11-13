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
import { Plus, Trash2, Send, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import {
  warehouseApi,
  supplierApi,
  itemApi,
  inventoryApi,
  productionApi,
  bGradeRefreshApi,
  Warehouse,
  Supplier,
  MasterItem,
  BGradeInventoryItem,
} from '@/lib/api';

interface WarehouseQuickStockItem {
  itemId: string;
  sku: string;
  description: string;
  qty: number;
  bUnitValue: number;
  aFinalUnitCost: number;
}

interface StagedSendItem {
  itemId: string;
  sku: string;
  description: string;
  available: number;
  bUnitValue: number;
  aFinalUnitCost: number;
  qtySend: number;
}

interface BGradeSendFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BGradeSendForm({ open, onClose, onSuccess }: BGradeSendFormProps) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [allItems, setAllItems] = useState<MasterItem[]>([]);
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [sentDate, setSentDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  // Stock in warehouse
  const [quickStockItems, setQuickStockItems] = useState<WarehouseQuickStockItem[]>([]);
  const [loadingStock, setLoadingStock] = useState(false);

  // Manual item addition
  const [selectedManualItemId, setSelectedManualItemId] = useState('');
  const [manualStockChecking, setManualStockChecking] = useState(false);

  // Staged lines to send
  const [stagedItems, setStagedItems] = useState<StagedSendItem[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const loadInitialData = useCallback(async () => {
    setLoadingMeta(true);
    try {
      const [whs, sups, itemsRes] = await Promise.all([
        warehouseApi.getAll(),
        supplierApi.getAll(),
        itemApi.getAll({ limit: 500 }).catch(() => ({ data: [] })),
      ]);
      const whList = Array.isArray(whs) ? whs : (Array.isArray((whs as { data?: Warehouse[] })?.data) ? (whs as { data: Warehouse[] }).data : []);
      const supList = Array.isArray(sups?.data)
        ? sups.data
        : Array.isArray(sups)
          ? sups
          : [];
      const itList = Array.isArray(itemsRes?.data)
        ? itemsRes.data
        : Array.isArray(itemsRes)
          ? itemsRes
          : [];

      setWarehouses(whList);
      setSuppliers(supList);
      setAllItems(itList);
    } catch {
      toast.error('Failed to load initial form data');
    } finally {
      setLoadingMeta(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    if (open) {
      queueMicrotask(() => {
        if (!ignore) {
          loadInitialData();
          setSelectedWarehouseId('');
          setSelectedSupplierId('');
          setSentDate(new Date().toISOString().split('T')[0]);
          setNotes('');
          setQuickStockItems([]);
          setStagedItems([]);
          setSelectedManualItemId('');
        }
      });
    }
    return () => {
      ignore = true;
    };
  }, [open, loadInitialData]);

  // Load B-grade items available in the selected warehouse
  const loadWarehouseStock = useCallback(async (warehouseId: string) => {
    setLoadingStock(true);
    setQuickStockItems([]);
    try {
      const bInv = await productionApi.getBGradeInventory();
      const filtered = bInv
        .filter(
          (entry: BGradeInventoryItem) =>
            entry.bGradeWarehouse?.id === warehouseId && entry.qtyRemainingBGrade > 0,
        )
        .map((entry: BGradeInventoryItem) => ({
          itemId: entry.articleItem?.id ?? '',
          sku: entry.articleItem?.sku ?? 'Unknown',
          description: entry.articleItem?.description ?? '',
          qty: Number(entry.qtyRemainingBGrade),
          bUnitValue: Number(entry.bUnitValue),
          aFinalUnitCost: Number(entry.aFinalUnitCost),
        }))
        .filter((x) => x.itemId !== '');

      // Group & aggregate duplicate items
      const aggregated = filtered.reduce<WarehouseQuickStockItem[]>((acc, cur) => {
        const existing = acc.find((x) => x.itemId === cur.itemId);
        if (existing) {
          existing.qty += cur.qty;
        } else {
          acc.push({ ...cur });
        }
        return acc;
      }, []);

      setQuickStockItems(aggregated);
    } catch {
      toast.error('Failed to query stock for this warehouse');
    } finally {
      setLoadingStock(false);
    }
  }, []);

  const handleWarehouseChange = (id: string) => {
    setSelectedWarehouseId(id);
    setStagedItems([]);
    setSelectedManualItemId('');
    if (id) {
      loadWarehouseStock(id);
    } else {
      setQuickStockItems([]);
    }
  };

  // Add from quick list
  const addQuickItem = (item: WarehouseQuickStockItem) => {
    if (stagedItems.some((s) => s.itemId === item.itemId)) {
      toast.info('Item is already in your send list.');
      return;
    }
    setStagedItems((prev) => [
      ...prev,
      {
        itemId: item.itemId,
        sku: item.sku,
        description: item.description,
        available: item.qty,
        bUnitValue: item.bUnitValue,
        aFinalUnitCost: item.aFinalUnitCost,
        qtySend: Math.min(1, item.qty),
      },
    ]);
  };

  // Add manual item via Autocomplete
  const handleAddManualItem = async (itemId: string) => {
    if (!itemId) return;
    if (!selectedWarehouseId) {
      toast.error('Select a B-Grade warehouse first');
      return;
    }
    if (stagedItems.some((s) => s.itemId === itemId)) {
      toast.info('Item is already in your send list.');
      setSelectedManualItemId('');
      return;
    }

    setManualStockChecking(true);
    try {
      const stockRes = await inventoryApi.getStockLevel(itemId, selectedWarehouseId);
      const available = Number(stockRes.totalQuantity) || 0;
      if (available <= 0) {
        toast.warning('This item has 0 stock in the selected warehouse.');
      }
      const itemData = allItems.find((i) => i.id === itemId);
      const unitCost = Number(itemData?.costPrice || 0);

      setStagedItems((prev) => [
        ...prev,
        {
          itemId,
          sku: itemData?.sku || 'Unknown',
          description: itemData?.description || '',
          available,
          bUnitValue: unitCost * 0.5 || unitCost || 0,
          aFinalUnitCost: unitCost || 0,
          qtySend: available > 0 ? 1 : 0,
        },
      ]);
      setSelectedManualItemId('');
    } catch {
      toast.error('Failed to verify stock level for item');
    } finally {
      setManualStockChecking(false);
    }
  };

  const removeStagedItem = (itemId: string) => {
    setStagedItems((prev) => prev.filter((i) => i.itemId !== itemId));
  };

  const updateStagedItemField = (
    itemId: string,
    field: 'qtySend' | 'bUnitValue' | 'aFinalUnitCost',
    value: number,
  ) => {
    setStagedItems((prev) =>
      prev.map((item) => {
        if (item.itemId !== itemId) return item;
        if (field === 'qtySend') {
          return { ...item, qtySend: Math.max(1, Math.min(value, item.available || value)) };
        }
        return { ...item, [field]: Math.max(0, value) };
      }),
    );
  };

  // Autocomplete options
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

  const supplierOptions = useMemo<AutocompleteOption[]>(
    () =>
      Array.isArray(suppliers)
        ? suppliers.map((s) => ({
          value: s.id,
          label: s.code ? `${s.name} (${s.code})` : s.name,
          description: s.code || '',
        }))
        : [],
    [suppliers],
  );

  const itemOptions = useMemo<AutocompleteOption[]>(
    () =>
      Array.isArray(allItems)
        ? allItems.map((i) => ({
          value: i.id,
          label: i.sku,
          description: i.description || '',
        }))
        : [],
    [allItems],
  );

  // Totals
  const totalPieces = stagedItems.reduce((acc, cur) => acc + cur.qtySend, 0);
  const totalBValue = stagedItems.reduce((acc, cur) => acc + cur.qtySend * cur.bUnitValue, 0);

  const handleSubmit = async () => {
    if (!selectedWarehouseId) {
      toast.error('Please select the B-Grade Source Warehouse.');
      return;
    }
    if (!selectedSupplierId) {
      toast.error('Please select the Refresh Vendor.');
      return;
    }
    if (stagedItems.length === 0) {
      toast.error('Please add at least one item to send.');
      return;
    }
    for (const item of stagedItems) {
      if (item.qtySend <= 0) {
        toast.error(`Quantity to send must be > 0 for item ${item.sku}.`);
        return;
      }
      if (item.available > 0 && item.qtySend > item.available) {
        toast.error(`Quantity exceeds available stock for item ${item.sku}.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      await bGradeRefreshApi.createOrder({
        supplierId: selectedSupplierId,
        bGradeWarehouseId: selectedWarehouseId,
        sentDate,
        notes: notes.trim() || undefined,
        items: stagedItems.map((item) => ({
          itemId: item.itemId,
          qtySent: item.qtySend,
          bUnitValue: item.bUnitValue,
          aFinalUnitCost: item.aFinalUnitCost,
        })),
      });

      toast.success('B-Grade Refresh Order created successfully! Stock deducted from warehouse.');
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create refresh order';
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[1020px] w-[96vw]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
            <Send className="h-5 w-5 text-orange-500" />
            Send B-Grade Stock for Refresh (Phase 1)
          </DialogTitle>
          <DialogDescription>
            Select a B-Grade warehouse to load defective items, pick the vendor who will refresh/repair them, and commit the dispatch.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Warehouse, Vendor & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                B-Grade Source Warehouse <span className="text-destructive">*</span>
              </Label>
              <Autocomplete
                options={warehouseOptions}
                value={selectedWarehouseId}
                onValueChange={handleWarehouseChange}
                placeholder="Select Warehouse..."
                searchPlaceholder="Search warehouse..."
                disabled={loadingMeta || submitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Refresh Vendor <span className="text-destructive">*</span>
              </Label>
              <Autocomplete
                options={supplierOptions}
                value={selectedSupplierId}
                onValueChange={setSelectedSupplierId}
                placeholder="Select Vendor..."
                searchPlaceholder="Search vendor..."
                disabled={loadingMeta || submitting}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Dispatch Date <span className="text-destructive">*</span>
              </Label>
              <Input
                type="date"
                value={sentDate}
                onChange={(e) => setSentDate(e.target.value)}
                className="h-9 text-xs tabular-nums"
                disabled={submitting}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">Notes / Alteration Instructions</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Button alteration, collar fix, re-stitch seam..."
              rows={2}
              className="text-xs"
              disabled={submitting}
            />
          </div>

          {/* Stock in Warehouse */}
          {selectedWarehouseId && (
            <div className="space-y-2.5 p-3.5 bg-muted/20 border border-border/80 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                  <Sparkles className="h-4 w-4 text-orange-500" />
                  Available Defective Items in Warehouse
                </div>
                {quickStockItems.length > 0 && (
                  <span className="text-[11px] text-muted-foreground">
                    {quickStockItems.length} articles found
                  </span>
                )}
              </div>

              {loadingStock ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
                  <Loader2 className="h-4 w-4 animate-spin text-orange-500" />
                  Scanning warehouse for B-grade items...
                </div>
              ) : quickStockItems.length === 0 ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-2">
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  No known production B-grade stock in this warehouse. You can search and add any article manually below.
                </div>
              ) : (
                <div className="border border-border/80 rounded-md max-h-44 overflow-y-auto bg-background">
                  <Table>
                    <TableHeader>
                      <TableRow className="text-xs bg-muted/40">
                        <TableHead className="w-[36%] font-semibold">Article / SKU</TableHead>
                        <TableHead className="text-right tabular-nums w-[16%] font-semibold">Stock in WH</TableHead>
                        <TableHead className="text-right tabular-nums w-[16%] font-semibold">B-Unit Value</TableHead>
                        <TableHead className="text-right tabular-nums w-[16%] font-semibold">A-Sound Cost</TableHead>
                        <TableHead className="text-right w-[16%] font-semibold">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {quickStockItems.map((item) => {
                        const isAdded = stagedItems.some((s) => s.itemId === item.itemId);
                        return (
                          <TableRow key={item.itemId} className="text-xs">
                            <TableCell className="py-1.5">
                              <span className="font-semibold text-foreground">{item.sku}</span>
                              {item.description && (
                                <span className="block text-[11px] text-muted-foreground truncate max-w-[240px]">
                                  {item.description}
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-semibold text-foreground py-1.5">
                              {item.qty} pcs
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-amber-600 dark:text-amber-400 font-medium py-1.5">
                              Rs {item.bUnitValue.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400 font-medium py-1.5">
                              Rs {item.aFinalUnitCost.toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="py-1.5 text-right">
                              <Button
                                size="sm"
                                variant={isAdded ? 'secondary' : 'outline'}
                                className="h-7 text-xs px-2"
                                disabled={isAdded || submitting}
                                onClick={() => addQuickItem(item)}
                              >
                                {isAdded ? 'Added' : <><Plus className="h-3 w-3 mr-1" /> Add</>}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Manual Article Selector */}
              <div className="pt-2 border-t border-border/60">
                <Label className="text-xs text-muted-foreground block mb-1">
                  Or search & add any other finished article from warehouse:
                </Label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Autocomplete
                      options={itemOptions}
                      value={selectedManualItemId}
                      onValueChange={setSelectedManualItemId}
                      placeholder="Search article by SKU..."
                      searchPlaceholder="Type SKU..."
                      disabled={loadingMeta || manualStockChecking || submitting}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 text-xs"
                    disabled={!selectedManualItemId || manualStockChecking || submitting}
                    onClick={() => handleAddManualItem(selectedManualItemId)}
                  >
                    {manualStockChecking ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <><Plus className="h-3.5 w-3.5 mr-1" /> Add Article</>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Staged Items Table */}
          {stagedItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground">
                  Items to Send for Refresh ({stagedItems.length})
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  Stock will be deducted from warehouse immediately
                </span>
              </div>

              <div className="border border-border/80 rounded-md bg-background overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs bg-muted/40">
                      <TableHead>Article</TableHead>
                      <TableHead className="text-right tabular-nums">Available</TableHead>
                      <TableHead className="text-center tabular-nums">Qty to Send</TableHead>
                      <TableHead className="text-right tabular-nums">B-Unit Value</TableHead>
                      <TableHead className="text-right tabular-nums">A-Cost (Sound)</TableHead>
                      <TableHead className="text-right tabular-nums">Line B-Value</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stagedItems.map((item) => (
                      <TableRow key={item.itemId} className="text-xs">
                        <TableCell className="py-2">
                          <div className="font-semibold text-foreground">{item.sku}</div>
                          {item.description && (
                            <div className="text-[11px] text-muted-foreground truncate max-w-[200px]">
                              {item.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-foreground font-medium py-2">
                          {item.available} pcs
                        </TableCell>
                        <TableCell className="text-center py-2">
                          <Input
                            type="number"
                            min={1}
                            max={item.available > 0 ? item.available : undefined}
                            value={item.qtySend}
                            onChange={(e) =>
                              updateStagedItemField(
                                item.itemId,
                                'qtySend',
                                parseInt(e.target.value, 10) || 1,
                              )
                            }
                            className="w-20 text-center tabular-nums h-8 text-xs mx-auto"
                            disabled={submitting}
                          />
                        </TableCell>
                        <TableCell className="text-right py-2">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.bUnitValue}
                            onChange={(e) =>
                              updateStagedItemField(
                                item.itemId,
                                'bUnitValue',
                                parseFloat(e.target.value) || 0,
                              )
                            }
                            className="w-24 text-right tabular-nums h-8 text-xs ml-auto"
                            disabled={submitting}
                          />
                        </TableCell>
                        <TableCell className="text-right py-2">
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            value={item.aFinalUnitCost}
                            onChange={(e) =>
                              updateStagedItemField(
                                item.itemId,
                                'aFinalUnitCost',
                                parseFloat(e.target.value) || 0,
                              )
                            }
                            className="w-24 text-right tabular-nums h-8 text-xs ml-auto"
                            disabled={submitting}
                          />
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-semibold text-amber-600 dark:text-amber-400 py-2">
                          Rs {(item.qtySend * item.bUnitValue).toLocaleString('en-PK', {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell className="py-2 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                            onClick={() => removeStagedItem(item.itemId)}
                            disabled={submitting}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Total Banner */}
              <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 rounded-md px-4 py-2.5 text-xs">
                <div className="text-muted-foreground">
                  Sending <strong className="tabular-nums text-foreground">{totalPieces} pcs</strong> across{' '}
                  <strong className="text-foreground">{stagedItems.length} article(s)</strong>
                </div>
                <div className="font-bold tabular-nums text-amber-700 dark:text-amber-300 text-sm">
                  Total Dispatched B-Value: Rs{' '}
                  {totalBValue.toLocaleString('en-PK', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2.5 pt-3 border-t border-border/80">
            <Button variant="outline" onClick={onClose} disabled={submitting} className="text-xs h-9">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={
                submitting ||
                stagedItems.length === 0 ||
                !selectedWarehouseId ||
                !selectedSupplierId
              }
              className="bg-orange-600 hover:bg-orange-700 text-white font-medium text-xs h-9"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  Creating Order...
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  Confirm Dispatch & Send to Vendor
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
