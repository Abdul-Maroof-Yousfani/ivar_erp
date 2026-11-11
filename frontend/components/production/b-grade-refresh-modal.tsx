'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { productionApi, BGradeInventoryItem } from '@/lib/api';
import { RefreshCw, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';

interface BGradeRefreshModalProps {
  item: BGradeInventoryItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BGradeRefreshModal({ item, isOpen, onClose, onSuccess }: BGradeRefreshModalProps) {
  const [qtyToRefresh, setQtyToRefresh] = useState<number | ''>('');
  const [refreshRate, setRefreshRate] = useState<number | ''>(0);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!item) return null;

  const available = item.qtyRemainingBGrade;
  const numQty = Number(qtyToRefresh || 0);
  const numRate = Number(refreshRate || 0);
  const totalRefreshBill = numQty * numRate;
  const isValid = numQty > 0 && numQty <= available;

  const handleMaxClick = () => {
    setQtyToRefresh(available);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      toast.error(`Please enter a valid quantity between 1 and ${available}.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await productionApi.refreshBGrade({
        batchId: item.batchId,
        batchItemId: item.batchItemId || undefined,
        qtyRefreshed: numQty,
        refreshRate: numRate,
        notes,
      });

      toast.success(res.message || `Successfully refreshed ${numQty} pieces into A-grade stock!`);
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Failed to refresh B-grade pieces:', error);
      toast.error(error?.message || 'Failed to execute B-grade refresh.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-indigo-600" />
            <DialogTitle className="text-xl">Send B-Grade Stock for Refresh</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Move altered or repaired B-grade pieces into sound A-grade inventory as specified in Stage 7 of the IVAR flow.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Batch & Item Overview */}
          <div className="bg-muted/40 p-3.5 rounded-lg border space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Production Batch:</span>
              <span className="tabular-nums font-bold text-foreground">{item.batchNumber}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Article / Garment:</span>
              <div className="text-right">
                <span className="font-semibold text-foreground">{item.articleItem?.sku}</span>
                {item.sizeName && item.sizeName !== 'Standard' && (
                  <Badge variant="outline" className="ml-1.5 text-[10px] py-0 px-1 tabular-nums font-semibold">
                    Size: {item.sizeName}
                  </Badge>
                )}
                <div className="text-[11px] text-muted-foreground">{item.articleItem?.description}</div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">CMT Vendor:</span>
              <span className="font-medium text-foreground">{item.supplier?.name}</span>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-2">
              <span className="text-amber-700 dark:text-amber-400 font-semibold">Available in B-Warehouse:</span>
              <Badge variant="outline" className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 tabular-nums font-semibold">
                {available} pieces remaining
              </Badge>
            </div>
          </div>

          {/* Form Fields */}
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <Label htmlFor="qtyRefreshed" className="text-xs font-medium">
                  Quantity to Refresh & Transfer to A-Grade *
                </Label>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={handleMaxClick}
                  className="h-auto p-0 text-xs text-indigo-600 dark:text-indigo-400 font-medium"
                >
                  Use Max ({available})
                </Button>
              </div>
              <Input
                id="qtyRefreshed"
                type="number"
                min="1"
                max={available}
                required
                value={qtyToRefresh}
                onChange={(e) => setQtyToRefresh(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                placeholder={`1 to ${available}`}
                className="mt-1 tabular-nums font-semibold bg-background"
              />
            </div>

            <div>
              <Label htmlFor="refreshRate" className="text-xs font-medium flex items-center justify-between">
                <span>Vendor Refresh / Alteration Rate per Piece (PKR)</span>
                <span className="text-[10px] text-muted-foreground font-normal">0 if free alteration</span>
              </Label>
              <Input
                id="refreshRate"
                type="number"
                min="0"
                step="0.01"
                value={refreshRate}
                onChange={(e) => setRefreshRate(e.target.value === '' ? '' : parseFloat(e.target.value))}
                placeholder="0"
                className="mt-1 tabular-nums bg-background"
              />
            </div>

            <div>
              <Label htmlFor="refreshNotes" className="text-xs font-medium">
                Refresh Notes
              </Label>
              <Input
                id="refreshNotes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Button alteration, hem repaired"
                className="mt-1 bg-background"
              />
            </div>
          </div>

          {/* Transfer Preview Card */}
          <div className="bg-emerald-500/10 dark:bg-emerald-500/15 border border-emerald-500/30 rounded-lg p-3 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-semibold text-emerald-800 dark:text-emerald-300">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>Stock & Valuation Routing:</span>
            </div>
            <div className="text-foreground/90 space-y-1">
              <div>
                • Deducts <strong className="tabular-nums font-bold text-foreground">{numQty || 0} pcs</strong> of <strong>{item.articleItem?.sku}</strong> from{' '}
                <strong>{item.bGradeWarehouse?.name || 'B Grade Warehouse'}</strong> (valued @ Rs {Number(item.bUnitValue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}).
              </div>
              <div>
                • Inbounds <strong className="tabular-nums font-bold text-emerald-700 dark:text-emerald-400">{numQty || 0} pcs</strong> into{' '}
                <strong>{item.aGradeWarehouse?.name || 'A Grade Stock'}</strong> at item recalculated A-cost (
                <strong className="tabular-nums font-bold text-emerald-700 dark:text-emerald-400">Rs {Number(item.aFinalUnitCost).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>).
              </div>
              {numRate > 0 && (
                <div className="text-indigo-700 dark:text-indigo-300 font-semibold pt-1 border-t border-emerald-500/20">
                  • Raises separate Refresh Purchase Invoice for Rs {totalRefreshBill.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({numQty} pcs × Rs {numRate.toFixed(2)}) in vendor&apos;s name.
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || !isValid}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
            >
              {submitting ? 'Transferring...' : `Confirm & Move ${numQty || 0} pcs to A-Stock`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

