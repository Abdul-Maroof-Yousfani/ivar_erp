"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { Download, Printer, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { cn } from "@/lib/utils";
import { getBalanceSheet, BalanceSheetResult, BalanceSheetAccount } from "@/lib/actions/finance-reports";
import { parseISO } from "date-fns";

const fmt = (n: number) =>
  n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Section({
  title,
  rows,
  total,
  headerClass,
}: {
  title: string;
  rows: BalanceSheetAccount[];
  total: number;
  headerClass: string;
}) {
  return (
    <div className="rounded-lg border dark:border-border overflow-hidden">
      <div className={cn("px-4 py-3 font-bold text-sm uppercase tracking-wider", headerClass)}>
        {title}
      </div>
      <table className="w-full text-sm">
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id} className={cn("border-b dark:border-border/50 hover:bg-accent/30", i % 2 === 1 && "bg-muted/10")}>
              <td className="px-4 py-2 font-mono text-xs text-muted-foreground w-28">{row.code}</td>
              <td className="px-4 py-2">
                <div>{row.name}</div>
                {row.parent && <div className="text-xs text-muted-foreground">{row.parent.name}</div>}
              </td>
              <td className="px-4 py-2 text-right font-mono">{fmt(row.amount)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-muted/40 font-bold border-t dark:border-border">
            <td colSpan={2} className="px-4 py-3 text-right uppercase text-xs tracking-wider">Total {title}</td>
            <td className="px-4 py-3 text-right font-mono">{fmt(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function BalanceSheetClient({ initialData }: { initialData?: BalanceSheetResult }) {
  const [data, setData] = useState<BalanceSheetResult | undefined>(initialData);
  const [asOf, setAsOf] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const load = (dateStr?: string) => {
    startTransition(async () => {
      const res = await getBalanceSheet(dateStr || undefined);
      if (res.status) setData(res.data);
    });
  };

  const asOfDisplay = asOf ? format(parseISO(asOf), "dd MMM yyyy") : "Current (running balances)";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b flex flex-row items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle>Balance Sheet</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{asOfDisplay}</p>
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
          <div className="flex flex-wrap items-end gap-4 p-4 rounded-lg border dark:border-border">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">As of Date</Label>
              <DatePicker value={asOf} onChange={setAsOf} placeholder="Current balances" />
            </div>
            <Button onClick={() => load(asOf)} disabled={isPending}>
              <RefreshCw className={cn("h-4 w-4 mr-2", isPending && "animate-spin")} />
              {isPending ? "Loading…" : "Apply"}
            </Button>
            <Button variant="ghost" onClick={() => { setAsOf(""); load(); }}>
              Reset
            </Button>
          </div>

          {/* Balance check */}
          {data && (
            <div className={cn(
              "flex items-center justify-between px-4 py-2 rounded-md text-sm font-medium",
              data.balanced
                ? "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300"
                : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300",
            )}>
              <span>{data.balanced ? "✓ Balance sheet balances" : "⚠ Balance sheet does NOT balance"}</span>
              <span>Assets: {fmt(data.totalAssets)} | Liabilities + Equity: {fmt(data.totalLiabilitiesAndEquity)}</span>
            </div>
          )}

          {data && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Assets */}
              <Section
                title="Assets"
                rows={data.assets}
                total={data.totalAssets}
                headerClass="bg-blue-100 text-blue-900 dark:bg-blue-900/20 dark:text-blue-300"
              />

              {/* Right: Liabilities + Equity */}
              <div className="space-y-6">
                <Section
                  title="Liabilities"
                  rows={data.liabilities}
                  total={data.totalLiabilities}
                  headerClass="bg-red-100 text-red-900 dark:bg-red-900/20 dark:text-red-300"
                />
                <Section
                  title="Equity"
                  rows={data.equity}
                  total={data.totalEquity}
                  headerClass="bg-purple-100 text-purple-900 dark:bg-purple-900/20 dark:text-purple-300"
                />

                {/* Total L+E */}
                <div className="flex items-center justify-between px-6 py-4 rounded-lg border dark:border-border font-bold bg-muted/30">
                  <span className="uppercase text-sm tracking-wider">Total Liabilities + Equity</span>
                  <span className="font-mono text-lg">{fmt(data.totalLiabilitiesAndEquity)}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
