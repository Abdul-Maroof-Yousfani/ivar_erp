"use client";

import { useState, useTransition } from "react";
import { format, parseISO } from "date-fns";
import { Download, Printer, RefreshCw, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { cn } from "@/lib/utils";
import { getIncomeStatement, IncomeStatementResult } from "@/lib/actions/finance-reports";

const fmt = (n: number) =>
  n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function AccountSection({
  title,
  rows,
  total,
  colorClass,
}: {
  title: string;
  rows: { id: string; code: string; name: string; amount: number; parent?: { name: string } | null }[];
  total: number;
  colorClass: string;
}) {
  return (
    <div className="rounded-lg border dark:border-border overflow-hidden">
      <div className={cn("px-4 py-3 font-bold text-sm uppercase tracking-wider", colorClass)}>
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

export function ProfitLossClient({
  initialData,
  defaultFrom,
  defaultTo,
}: {
  initialData?: IncomeStatementResult;
  defaultFrom?: string;
  defaultTo?: string;
}) {
  const [data, setData] = useState<IncomeStatementResult | undefined>(initialData);
  const [fromDate, setFromDate] = useState<Date | undefined>(defaultFrom ? parseISO(defaultFrom) : undefined);
  const [toDate,   setToDate]   = useState<Date | undefined>(defaultTo   ? parseISO(defaultTo)   : undefined);
  const [isPending, startTransition] = useTransition();

  const load = (from?: Date, to?: Date) => {
    startTransition(async () => {
      const res = await getIncomeStatement(
        from ? format(from, "yyyy-MM-dd") : undefined,
        to   ? format(to,   "yyyy-MM-dd") : undefined,
      );
      if (res.status) setData(res.data);
    });
  };

  const netProfit = data?.netProfit ?? 0;
  const NetIcon = netProfit > 0 ? TrendingUp : netProfit < 0 ? TrendingDown : Minus;
  const netColor = netProfit > 0
    ? "text-green-700 dark:text-green-400"
    : netProfit < 0
    ? "text-red-700 dark:text-red-400"
    : "text-muted-foreground";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b flex flex-row items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle>Profit &amp; Loss Statement</CardTitle>
            {fromDate && toDate && (
              <p className="text-sm text-muted-foreground mt-1">
                {format(fromDate, "dd MMM yyyy")} – {format(toDate, "dd MMM yyyy")}
              </p>
            )}
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
          </div>

          {/* Summary KPIs */}
          {data && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="rounded-lg border dark:border-border p-4 bg-green-50 dark:bg-green-900/10">
                <p className="text-xs uppercase font-semibold text-muted-foreground">Total Income</p>
                <p className="text-2xl font-bold mt-1 font-mono text-green-700 dark:text-green-400">{fmt(data.totalIncome)}</p>
              </div>
              <div className="rounded-lg border dark:border-border p-4 bg-orange-50 dark:bg-orange-900/10">
                <p className="text-xs uppercase font-semibold text-muted-foreground">Total Expenses</p>
                <p className="text-2xl font-bold mt-1 font-mono text-orange-700 dark:text-orange-400">{fmt(data.totalExpense)}</p>
              </div>
              <div className="rounded-lg border dark:border-border p-4">
                <p className="text-xs uppercase font-semibold text-muted-foreground">Net Profit / Loss</p>
                <p className={cn("text-2xl font-bold mt-1 font-mono flex items-center gap-2", netColor)}>
                  <NetIcon className="h-5 w-5" />
                  {fmt(Math.abs(netProfit))}
                  <span className="text-sm font-normal">{netProfit < 0 ? "(Loss)" : ""}</span>
                </p>
              </div>
            </div>
          )}

          {data && (
            <div className="space-y-6">
              <AccountSection
                title="Income"
                rows={data.income}
                total={data.totalIncome}
                colorClass="bg-green-100 text-green-900 dark:bg-green-900/20 dark:text-green-300"
              />
              <AccountSection
                title="Expenses"
                rows={data.expense}
                total={data.totalExpense}
                colorClass="bg-orange-100 text-orange-900 dark:bg-orange-900/20 dark:text-orange-300"
              />

              {/* Net Profit row */}
              <div className={cn(
                "flex items-center justify-between px-6 py-4 rounded-lg font-bold text-lg",
                netProfit >= 0
                  ? "bg-green-100 text-green-900 dark:bg-green-900/20 dark:text-green-300"
                  : "bg-red-100 text-red-900 dark:bg-red-900/20 dark:text-red-300",
              )}>
                <span className="flex items-center gap-2">
                  <NetIcon className="h-5 w-5" />
                  {netProfit >= 0 ? "Net Profit" : "Net Loss"}
                </span>
                <span className="font-mono">{fmt(Math.abs(netProfit))}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
