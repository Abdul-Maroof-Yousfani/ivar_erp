'use client';

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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ProductionBatch } from '@/lib/api';
import {
  Package,
  Layers,
  Scissors,
  Building2,
  FileCheck2,
  ArrowUpRight,
  Calculator,
  RotateCcw,
  Link2,
  Calendar,
  CheckCircle2,
  Boxes,
} from 'lucide-react';
import Link from 'next/link';

interface BatchDetailsModalProps {
  batch: ProductionBatch | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenRefresh?: (item: any) => void;
}

export function BatchDetailsModal({ batch, isOpen, onClose, onOpenRefresh }: BatchDetailsModalProps) {
  if (!batch) return null;

  const fUsed = Number(batch.qtyFabricUsed || 0);
  const fRate = Number(batch.fabricRate || 0);
  const totalFabricCost = fUsed * fRate;
  const totalRecv = Number(batch.qtyTotalReceived || 0);
  const aPieces = Number(batch.qtyAGrade || 0);
  const bPieces = Number(batch.qtyBGrade || 0);
  const cons = Number(batch.consumption || 0);
  const initialNet = Number(batch.initialNetCost || 0);
  const aCost = Number(batch.aFinalUnitCost || 0);
  const bVal = Number(batch.bUnitValue || 0);
  const totalBill = Number(batch.totalBill || 0);
  const refreshed = Number(batch.qtyRefreshed || 0);
  const remainingB = Math.max(0, bPieces - refreshed);
  const defectPct = totalRecv > 0 ? (bPieces / totalRecv) * 100 : 0;

  const items = batch.batchItems && batch.batchItems.length > 0 ? batch.batchItems : [];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        noScroll={true}
        className="sm:max-w-5xl w-[96vw] max-h-[92vh] flex flex-col p-0 gap-0 border border-border shadow-2xl rounded-xl bg-background overflow-hidden"
      >
        {/* ── Dialog Header ── */}
        <DialogHeader className="p-5 pb-4 border-b bg-muted/20 shrink-0">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pr-6">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-lg font-bold tabular-nums tracking-tight text-foreground">
                    {batch.batchNumber}
                  </DialogTitle>
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-medium">
                    {batch.status}
                  </Badge>
                  {items.length > 1 && (
                    <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 text-[10px] font-medium">
                      {items.length} Finished Articles
                    </Badge>
                  )}
                </div>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(batch.productionDate).toLocaleDateString()}
                  </span>
                  <span>•</span>
                  <span>Vendor: <strong className="text-foreground">{batch.supplier?.name}</strong></span>
                  {batch.tracker && (
                    <>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1 text-primary font-medium">
                        <Link2 className="h-3 w-3" />
                        Fabric Issue #{batch.tracker.trackerNumber}
                      </span>
                    </>
                  )}
                </DialogDescription>
              </div>
            </div>

            {batch.purchaseInvoice && (
              <Link
                href="/erp/procurement/purchase-invoice"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors shrink-0"
              >
                <FileCheck2 className="h-3.5 w-3.5" />
                {batch.purchaseInvoice.invoiceNumber}
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* ── KPI Summary Cards (Matching IVAR Theme) ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border border-border/80 shadow-2xs bg-card">
              <CardContent className="p-3.5 space-y-1">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Scissors className="h-3.5 w-3.5 text-primary" /> Fabric Consumed
                </span>
                <div className="text-xl font-bold tracking-tight text-foreground tabular-nums">
                  {fUsed.toLocaleString()} m
                </div>
                <div className="text-xs text-muted-foreground">
                  @ Rs {fRate.toFixed(2)}/m (Rs {totalFabricCost.toLocaleString()})
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/80 shadow-2xs bg-card">
              <CardContent className="p-3.5 space-y-1">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Calculator className="h-3.5 w-3.5 text-primary" /> Consumption (CONS)
                </span>
                <div className="text-xl font-bold tracking-tight text-foreground tabular-nums">
                  {cons.toFixed(4)} m/pc
                </div>
                <div className="text-xs text-muted-foreground">
                  {totalRecv.toLocaleString()} garments produced
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/80 shadow-2xs bg-card">
              <CardContent className="p-3.5 space-y-1">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-amber-500" /> Quality Grading
                </span>
                <div className="text-xl font-bold tracking-tight text-foreground tabular-nums">
                  {totalRecv.toLocaleString()} pcs
                </div>
                <div className="text-xs text-muted-foreground">
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{aPieces.toLocaleString()} Sound (A)</span> •{' '}
                  <span className="text-amber-600 dark:text-amber-400 font-semibold">{bPieces.toLocaleString()} Defect (B)</span> ({defectPct.toFixed(1)}%)
                </div>
              </CardContent>
            </Card>

            <Card className="border border-border/80 shadow-2xs bg-card">
              <CardContent className="p-3.5 space-y-1">
                <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> Batch Recalc A-Cost
                </span>
                <div className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 tabular-nums">
                  Rs {aCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  <span className="text-xs font-normal text-muted-foreground ml-1">/ piece</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  Initial Net: Rs {initialNet.toFixed(2)} / pc
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ── Finished Articles & Itemized Costing Table ── */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <Boxes className="h-4 w-4 text-primary" />
                Finished Article & Per-Item Costing Breakdown
              </h3>
              <span className="text-[11px] text-muted-foreground">
                50% B-grade discount loss absorbed into sound A-grade unit cost
              </span>
            </div>

            <div className="border border-border rounded-lg overflow-x-auto shadow-2xs bg-card">
              <Table className="text-xs w-full min-w-[920px]">
                <TableHeader className="bg-muted/50 border-b border-border">
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="font-bold text-foreground py-3 whitespace-nowrap">Finished Article</TableHead>
                    <TableHead className="font-bold text-foreground text-center whitespace-nowrap">Fabric (m)</TableHead>
                    <TableHead className="font-bold text-foreground text-center whitespace-nowrap">CONS (m/pc)</TableHead>
                    <TableHead className="font-bold text-foreground text-center whitespace-nowrap">Total Recv</TableHead>
                    <TableHead className="font-bold text-amber-700 dark:text-amber-400 text-center whitespace-nowrap">Defect (B)</TableHead>
                    <TableHead className="font-bold text-foreground text-center whitespace-nowrap">Sound (A)</TableHead>
                    <TableHead className="font-bold text-foreground text-right whitespace-nowrap">Vendor CMT</TableHead>
                    <TableHead className="font-bold text-foreground text-right whitespace-nowrap">Initial Net</TableHead>
                    <TableHead className="font-bold text-emerald-700 dark:text-emerald-400 text-right whitespace-nowrap">
                      Recalc A-Grade Cost
                    </TableHead>
                    <TableHead className="font-bold text-foreground text-right whitespace-nowrap pr-4">Total Line Bill</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length > 0 ? (
                    items.map((it, idx) => {
                      const itTot = Number(it.qtyTotalReceived || 0);
                      const itA = Number(it.qtyAGrade || 0);
                      const itB = Number(it.qtyBGrade || 0);
                      const itCmt = Number(it.cmtCostPerPc || 0);
                      const itFabricUsed =
                        it.qtyFabricUsed !== undefined && it.qtyFabricUsed !== null
                          ? Number(it.qtyFabricUsed)
                          : items.length === 1
                          ? fUsed
                          : itTot > 0 && totalRecv > 0
                          ? (itTot / totalRecv) * fUsed
                          : 0;
                      const itCons =
                        it.consumption !== undefined && it.consumption !== null
                          ? Number(it.consumption)
                          : itTot > 0
                          ? itFabricUsed / itTot
                          : cons;
                      const itNet = Number(it.initialNetCost || 0);
                      const itACost = Number(it.aFinalUnitCost || 0);
                      const itTotalAmount = Number(it.totalLineAmount || itNet * itTot || 0);
                      const itBVal = Number(it.bUnitValue || itNet * 0.5);

                      return (
                        <TableRow key={it.id || idx} className="hover:bg-muted/30 transition-colors">
                          <TableCell className="py-3">
                            <div className="font-semibold text-foreground flex items-center gap-1.5 whitespace-nowrap">
                              <span>{it.articleItem?.sku}</span>
                              {it.sizeName && it.sizeName !== 'Standard' && (
                                <Badge variant="outline" className="text-[10px] py-0 px-1 font-medium">
                                  Size {it.sizeName}
                                </Badge>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground max-w-[240px] truncate" title={it.articleItem?.description}>
                              {it.articleItem?.description || 'Finished Article'}
                            </div>
                          </TableCell>

                          <TableCell className="text-center font-medium tabular-nums text-foreground whitespace-nowrap">
                            {itFabricUsed.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} m
                          </TableCell>

                          <TableCell className="text-center tabular-nums whitespace-nowrap">
                            <Badge variant="outline" className="text-[11px] font-semibold tabular-nums bg-primary/5 text-primary border-primary/20">
                              {itCons.toFixed(4)} m/pc
                            </Badge>
                          </TableCell>

                          <TableCell className="text-center font-semibold tabular-nums text-foreground whitespace-nowrap">
                            {itTot.toLocaleString()} pcs
                          </TableCell>

                          <TableCell className="text-center tabular-nums text-amber-600 dark:text-amber-400 font-medium whitespace-nowrap">
                            <div>{itB.toLocaleString()} pcs</div>
                            <div className="text-[10px] text-muted-foreground font-normal">
                              @ Rs {itBVal.toFixed(2)}
                            </div>
                          </TableCell>

                          <TableCell className="text-center font-semibold tabular-nums text-foreground whitespace-nowrap">
                            {itA.toLocaleString()} pcs
                          </TableCell>

                          <TableCell className="text-right tabular-nums text-foreground whitespace-nowrap">
                            Rs {itCmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>

                          <TableCell className="text-right tabular-nums text-muted-foreground whitespace-nowrap">
                            Rs {itNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>

                          <TableCell className="text-right whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 tabular-nums">
                              Rs {itACost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </TableCell>

                          <TableCell className="text-right font-semibold tabular-nums text-foreground whitespace-nowrap pr-4">
                            Rs {itTotalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    <TableRow className="hover:bg-muted/30">
                      <TableCell className="py-3">
                        <div className="font-semibold text-foreground">{batch.articleItem?.sku}</div>
                        <div className="text-[11px] text-muted-foreground">{batch.articleItem?.description}</div>
                      </TableCell>
                      <TableCell className="text-center font-medium tabular-nums text-foreground whitespace-nowrap">{fUsed.toLocaleString()} m</TableCell>
                      <TableCell className="text-center tabular-nums whitespace-nowrap">
                        <Badge variant="outline" className="text-[11px] font-semibold tabular-nums bg-primary/5 text-primary border-primary/20">
                          {cons.toFixed(4)} m/pc
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-semibold tabular-nums text-foreground whitespace-nowrap">{totalRecv.toLocaleString()} pcs</TableCell>
                      <TableCell className="text-center tabular-nums text-amber-600 dark:text-amber-400 font-medium whitespace-nowrap">{bPieces.toLocaleString()} pcs</TableCell>
                      <TableCell className="text-center font-semibold tabular-nums text-foreground whitespace-nowrap">{aPieces.toLocaleString()} pcs</TableCell>
                      <TableCell className="text-right tabular-nums text-foreground whitespace-nowrap">Rs {Number(batch.cmtCostPerPc || 0).toFixed(2)}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground whitespace-nowrap">Rs {initialNet.toFixed(2)}</TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 tabular-nums">
                          Rs {aCost.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums text-foreground whitespace-nowrap pr-4">Rs {totalBill.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    </TableRow>
                  )}

                  {/* ── Summary Footer Row ── */}
                  <TableRow className="bg-muted/40 font-semibold border-t-2 border-border text-xs">
                    <TableCell className="py-3 font-bold text-foreground whitespace-nowrap">
                      Batch Totals & Averages
                    </TableCell>
                    <TableCell className="text-center font-bold tabular-nums text-foreground whitespace-nowrap">
                      {fUsed.toLocaleString()} m
                    </TableCell>
                    <TableCell className="text-center tabular-nums whitespace-nowrap">
                      <Badge variant="outline" className="text-[11px] font-semibold tabular-nums bg-primary/10 text-primary border-primary/30">
                        {cons.toFixed(4)} m/pc
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-bold tabular-nums text-foreground whitespace-nowrap">
                      {totalRecv.toLocaleString()} pcs
                    </TableCell>
                    <TableCell className="text-center font-bold tabular-nums text-amber-600 dark:text-amber-400 whitespace-nowrap">
                      {bPieces.toLocaleString()} pcs
                    </TableCell>
                    <TableCell className="text-center font-bold tabular-nums text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                      {aPieces.toLocaleString()} pcs
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground whitespace-nowrap">
                      —
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground whitespace-nowrap">
                      Rs {initialNet.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 tabular-nums">
                        Rs {aCost.toFixed(2)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-bold tabular-nums text-foreground whitespace-nowrap pr-4">
                      Rs {totalBill.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </div>

          {/* ── Logistics Warehouses & Financial Accounting Row ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Warehouses */}
            <Card className="border border-border/80 shadow-2xs bg-card">
              <CardContent className="p-4 space-y-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-primary" />
                  Warehouse Stock Routing
                </span>
                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/60">
                    <span className="text-muted-foreground">Raw Fabric Source:</span>
                    <span className="font-semibold text-foreground">
                      [{batch.fabricWarehouse?.code}] {batch.fabricWarehouse?.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/60">
                    <span className="text-muted-foreground">Sound Stock Warehouse (A):</span>
                    <span className="font-semibold text-foreground">
                      [{batch.aGradeWarehouse?.code}] {batch.aGradeWarehouse?.name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/60">
                    <span className="text-muted-foreground">Defective Stock Warehouse (B):</span>
                    <span className="font-semibold text-foreground">
                      [{batch.bGradeWarehouse?.code}] {batch.bGradeWarehouse?.name}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* B-Grade Stock & Refresh Status */}
            <Card className="border border-border/80 shadow-2xs bg-card">
              <CardContent className="p-4 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    <RotateCcw className="h-4 w-4 text-amber-500" />
                    B-Grade Stock Settlement & Refresh
                  </span>
                  {remainingB > 0 && onOpenRefresh && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[11px] border-primary/30 text-primary hover:bg-primary/10"
                      onClick={() => {
                        onClose();
                        onOpenRefresh({
                          batchId: batch.id,
                          batchNumber: batch.batchNumber,
                          articleItemId: batch.articleItemId,
                          articleSku: batch.articleItem?.sku,
                          articleDescription: batch.articleItem?.description,
                          supplierName: batch.supplier?.name,
                          qtyBGradeTotal: bPieces,
                          qtyRefreshed: refreshed,
                          qtyRemainingBGrade: remainingB,
                          bUnitValue: bVal,
                          productionDate: batch.productionDate,
                        });
                      }}
                    >
                      Refresh into A-Stock
                    </Button>
                  )}
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/60">
                    <span className="text-muted-foreground">Total B-Grade Defective Pieces:</span>
                    <span className="font-semibold text-amber-600 dark:text-amber-400 tabular-nums">{bPieces} pcs</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/60">
                    <span className="text-muted-foreground">Refreshed / Restocked to A-Stock:</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">{refreshed} pcs</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 border border-border/60">
                    <span className="text-muted-foreground font-medium">Pending in B-Grade Warehouse:</span>
                    <span className="font-bold text-foreground tabular-nums">{remainingB} pcs</span>
                  </div>
                </div>

                {batch.notes && (
                  <div className="text-[11px] text-muted-foreground pt-1">
                    <strong>Notes:</strong> {batch.notes}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ── Dialog Footer ── */}
        <div className="p-3.5 border-t bg-muted/20 flex items-center justify-end shrink-0">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs font-semibold px-4">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
