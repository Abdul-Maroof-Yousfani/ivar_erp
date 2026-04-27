"use client";

import { useState, useMemo, useTransition } from "react";
import { format } from "date-fns";
import { Download, Printer, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { getTrialBalance, TrialBalanceResult, TrialBalanceRow } from "@/lib/actions/finance-reports";

const fmt = (n: number) =>
  n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TYPE_COLORS: Record<string, string> = {
  ASSET:     "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  LIABILITY: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  EQUITY:    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  INCOME:    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  EXPENSE:   "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
};

export function TrialBalanceClient({ initialData }: { initialData?: TrialBalanceResult }) {
  const [data, setData] = useState<TrialBalanceResult | undefined>(initialData);
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [toDate, setToDate] = useState<Date | undefined>(undefined);
  const [isPending, startTransition] = useTransition();
  
  // Account type filters
  const [showAssets, setShowAssets] = useState(true);
  const [showLiabilities, setShowLiabilities] = useState(true);
  const [showCapital, setShowCapital] = useState(true);
  const [showExpenses, setShowExpenses] = useState(true);
  const [showRevenue, setShowRevenue] = useState(true);

  const load = (from?: Date, to?: Date) => {
    startTransition(async () => {
      const res = await getTrialBalance(
        from ? format(from, "yyyy-MM-dd") : undefined,
        to   ? format(to,   "yyyy-MM-dd") : undefined,
      );
      if (res.status) setData(res.data);
    });
  };

  // Group rows by account type with filters
  const grouped = useMemo(() => {
    if (!data?.rows) return {} as Record<string, TrialBalanceRow[]>;
    
    const typeFilters: Record<string, boolean> = {
      ASSET: showAssets,
      LIABILITY: showLiabilities,
      EQUITY: showCapital,
      EXPENSE: showExpenses,
      INCOME: showRevenue,
    };
    
    return data.rows.reduce<Record<string, TrialBalanceRow[]>>((acc, row) => {
      if (typeFilters[row.type]) {
        (acc[row.type] ??= []).push(row);
      }
      return acc;
    }, {});
  }, [data, showAssets, showLiabilities, showCapital, showExpenses, showRevenue]);

  const typeOrder = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b flex flex-row items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle>Trial Balance</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {fromDate && toDate
                ? `Period: ${format(fromDate, "dd MMM yyyy")} – ${format(toDate, "dd MMM yyyy")}`
                : "All time (running balances)"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" /> Print
            </Button>
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" /> Export
            </Button>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Filters */}
          <div className="space-y-4 p-4 rounded-lg border dark:border-border">
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Date Range</Label>
                <DateRangePicker
                  initialDateFrom={fromDate}
                  initialDateTo={toDate}
                  onUpdate={(v) => { setFromDate(v.range.from); setToDate(v.range.to); }}
                  align="start"
                  locale="en-GB"
                  showCompare={false}
                />
              </div>
              <Button onClick={() => load(fromDate, toDate)} disabled={isPending}>
                <RefreshCw className={cn("h-4 w-4 mr-2", isPending && "animate-spin")} />
                {isPending ? "Loading…" : "Apply"}
              </Button>
              <Button variant="ghost" onClick={() => { setFromDate(undefined); setToDate(undefined); load(); }}>
                Reset
              </Button>
            </div>
            
            {/* Account Type Filters */}
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Account Types</Label>
              <div className="flex flex-wrap gap-3">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <Checkbox
                    checked={showAssets}
                    onCheckedChange={(checked) => setShowAssets(checked as boolean)}
                  />
                  <span className="text-sm font-medium group-hover:text-primary transition-colors">Assets</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer group">
                  <Checkbox
                    checked={showLiabilities}
                    onCheckedChange={(checked) => setShowLiabilities(checked as boolean)}
                  />
                  <span className="text-sm font-medium group-hover:text-primary transition-colors">Liabilities</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer group">
                  <Checkbox
                    checked={showCapital}
                    onCheckedChange={(checked) => setShowCapital(checked as boolean)}
                  />
                  <span className="text-sm font-medium group-hover:text-primary transition-colors">Capital/Equity</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer group">
                  <Checkbox
                    checked={showExpenses}
                    onCheckedChange={(checked) => setShowExpenses(checked as boolean)}
                  />
                  <span className="text-sm font-medium group-hover:text-primary transition-colors">Expenses</span>
                </label>
                
                <label className="flex items-center gap-2 cursor-pointer group">
                  <Checkbox
                    checked={showRevenue}
                    onCheckedChange={(checked) => setShowRevenue(checked as boolean)}
                  />
                  <span className="text-sm font-medium group-hover:text-primary transition-colors">Revenue/Income</span>
                </label>
              </div>
            </div>
          </div>

          {/* Balance check banner */}
          {data && (
            <div className={cn(
              "flex items-center justify-between px-4 py-2 rounded-md text-sm font-medium",
              data.balanced
                ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300"
                : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300",
            )}>
              <span>{data.balanced ? "✓ Books are balanced" : "⚠ Books are NOT balanced — check for missing entries"}</span>
              <span>Difference: {fmt(Math.abs((data.totalDebit ?? 0) - (data.totalCredit ?? 0)))}</span>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto rounded-lg border dark:border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b dark:border-border">
                  <th rowSpan={2} className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider border-r">Sr.No</th>
                  <th rowSpan={2} className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider border-r">ACC.CODE</th>
                  <th rowSpan={2} className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider border-r">ACCOUNT</th>
                  <th colSpan={2} className="text-center px-4 py-2 font-semibold text-muted-foreground uppercase text-xs tracking-wider border-r border-b">Opening Balance</th>
                  <th colSpan={2} className="text-center px-4 py-2 font-semibold text-muted-foreground uppercase text-xs tracking-wider border-r border-b">Transactions</th>
                  <th colSpan={2} className="text-center px-4 py-2 font-semibold text-muted-foreground uppercase text-xs tracking-wider">Closing Balance</th>
                </tr>
                <tr className="bg-muted/40 border-b dark:border-border">
                  <th className="text-right px-4 py-2 font-semibold text-muted-foreground uppercase text-xs tracking-wider">OPEN.DR</th>
                  <th className="text-right px-4 py-2 font-semibold text-muted-foreground uppercase text-xs tracking-wider border-r">OPEN.CR</th>
                  <th className="text-right px-4 py-2 font-semibold text-muted-foreground uppercase text-xs tracking-wider">TX.DR</th>
                  <th className="text-right px-4 py-2 font-semibold text-muted-foreground uppercase text-xs tracking-wider border-r">TX.CR</th>
                  <th className="text-right px-4 py-2 font-semibold text-muted-foreground uppercase text-xs tracking-wider">CL.DR</th>
                  <th className="text-right px-4 py-2 font-semibold text-muted-foreground uppercase text-xs tracking-wider">CL.CR</th>
                </tr>
              </thead>
              <tbody>
                {typeOrder.map(type => {
                  const rows = grouped[type];
                  if (!rows?.length) return null;
                  
                  let serialNo = 1;
                  
                  // Calculate subtotals for this type
                  const subtotalOpenDr = rows.reduce((s, r) => s + (r.openingDebit || 0), 0);
                  const subtotalOpenCr = rows.reduce((s, r) => s + (r.openingCredit || 0), 0);
                  const subtotalTxDr = rows.reduce((s, r) => s + (r.transactionDebit || 0), 0);
                  const subtotalTxCr = rows.reduce((s, r) => s + (r.transactionCredit || 0), 0);
                  const subtotalClosingDr = rows.reduce((s, r) => s + (r.closingDebit || 0), 0);
                  const subtotalClosingCr = rows.reduce((s, r) => s + (r.closingCredit || 0), 0);
                  
                  return (
                    <>
                      <tr key={`${type}-header`} className="bg-muted/20 border-t dark:border-border">
                        <td colSpan={9} className="px-4 py-2 font-bold text-xs uppercase tracking-widest text-muted-foreground">
                          {type}
                        </td>
                      </tr>
                      {rows.map((row, i) => {
                        return (
                          <tr key={row.id} className={cn("border-b dark:border-border/50 hover:bg-accent/30", i % 2 === 1 && "bg-muted/10")}>
                            <td className="px-4 py-2 text-center font-mono text-xs border-r">{serialNo++}</td>
                            <td className="px-4 py-2 font-mono text-xs text-muted-foreground border-r">{row.code}</td>
                            <td className="px-4 py-2 border-r">
                              <div className="font-medium">{row.name}</div>
                              {row.parent && <div className="text-xs text-muted-foreground">{row.parent.name}</div>}
                            </td>
                            <td className="px-4 py-2 text-right font-mono text-xs">
                              {row.openingDebit > 0 ? fmt(row.openingDebit) : "0.00"}
                            </td>
                            <td className="px-4 py-2 text-right font-mono text-xs border-r">
                              {row.openingCredit > 0 ? fmt(row.openingCredit) : "0.00"}
                            </td>
                            <td className="px-4 py-2 text-right font-mono text-xs">
                              {row.transactionDebit > 0 ? fmt(row.transactionDebit) : "0.00"}
                            </td>
                            <td className="px-4 py-2 text-right font-mono text-xs border-r">
                              {row.transactionCredit > 0 ? fmt(row.transactionCredit) : "0.00"}
                            </td>
                            <td className="px-4 py-2 text-right font-mono text-xs">
                              {row.closingDebit > 0 ? fmt(row.closingDebit) : "0.00"}
                            </td>
                            <td className="px-4 py-2 text-right font-mono text-xs">
                              {row.closingCredit > 0 ? fmt(row.closingCredit) : "0.00"}
                            </td>
                          </tr>
                        );
                      })}
                      <tr key={`${type}-subtotal`} className="bg-muted/30 font-semibold border-t dark:border-border">
                        <td colSpan={3} className="px-4 py-2 text-right text-xs uppercase text-muted-foreground border-r">Subtotal {type}</td>
                        <td className="px-4 py-2 text-right font-mono text-xs">{subtotalOpenDr > 0 ? fmt(subtotalOpenDr) : "0.00"}</td>
                        <td className="px-4 py-2 text-right font-mono text-xs border-r">{subtotalOpenCr > 0 ? fmt(subtotalOpenCr) : "0.00"}</td>
                        <td className="px-4 py-2 text-right font-mono text-xs">{subtotalTxDr > 0 ? fmt(subtotalTxDr) : "0.00"}</td>
                        <td className="px-4 py-2 text-right font-mono text-xs border-r">{subtotalTxCr > 0 ? fmt(subtotalTxCr) : "0.00"}</td>
                        <td className="px-4 py-2 text-right font-mono text-xs">{subtotalClosingDr > 0 ? fmt(subtotalClosingDr) : "0.00"}</td>
                        <td className="px-4 py-2 text-right font-mono text-xs">{subtotalClosingCr > 0 ? fmt(subtotalClosingCr) : "0.00"}</td>
                      </tr>
                    </>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-muted/60 border-t-2 dark:border-border font-bold text-sm">
                  <td colSpan={3} className="px-4 py-3 text-right uppercase tracking-wider border-r">Grand Total</td>
                  <td className="px-4 py-3 text-right font-mono">{fmt(data?.totalOpeningDebit ?? 0)}</td>
                  <td className="px-4 py-3 text-right font-mono border-r">{fmt(data?.totalOpeningCredit ?? 0)}</td>
                  <td className="px-4 py-3 text-right font-mono">{fmt(data?.totalTransactionDebit ?? 0)}</td>
                  <td className="px-4 py-3 text-right font-mono border-r">{fmt(data?.totalTransactionCredit ?? 0)}</td>
                  <td className="px-4 py-3 text-right font-mono">{fmt(data?.totalClosingDebit ?? data?.totalDebit ?? 0)}</td>
                  <td className="px-4 py-3 text-right font-mono">{fmt(data?.totalClosingCredit ?? data?.totalCredit ?? 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
