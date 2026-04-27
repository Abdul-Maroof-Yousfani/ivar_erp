"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { Download, Printer, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Autocomplete } from "@/components/ui/autocomplete";
import { cn } from "@/lib/utils";
import { ChartOfAccount } from "@/lib/actions/chart-of-account";
import { getGeneralLedger, GeneralLedgerResult } from "@/lib/actions/finance-reports";

const fmt = (n: number) =>
  n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const SOURCE_LABELS: Record<string, string> = {
  PURCHASE_INVOICE:  "Purchase Invoice",
  PAYMENT_VOUCHER:   "Payment Voucher",
  RECEIPT_VOUCHER:   "Receipt Voucher",
  JOURNAL_VOUCHER:   "Journal Voucher",
  ADVANCE_APPLICATION: "Advance Application",
  SALES_INVOICE:     "Sales Invoice",
};

export function GeneralLedgerClient({ accounts }: { accounts: ChartOfAccount[] }) {
  const [accountId, setAccountId] = useState("");
  const [fromDate, setFromDate] = useState<Date | undefined>(
    new Date(new Date().getFullYear(), 0, 1),
  );
  const [toDate, setToDate] = useState<Date | undefined>(new Date());
  const [data, setData] = useState<GeneralLedgerResult | undefined>();
  const [isPending, startTransition] = useTransition();

  const load = () => {
    if (!accountId) return;
    startTransition(async () => {
      const res = await getGeneralLedger(accountId, {
        from: fromDate ? format(fromDate, "yyyy-MM-dd") : undefined,
        to:   toDate   ? format(toDate,   "yyyy-MM-dd") : undefined,
        limit: 500,
      });
      if (res.status) setData(res.data);
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b flex flex-row items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle>General Ledger</CardTitle>
            {data && (
              <p className="text-sm text-muted-foreground mt-1">
                {data.account.code} — {data.account.name}
                {fromDate && toDate && ` | ${format(fromDate, "dd MMM yyyy")} – ${format(toDate, "dd MMM yyyy")}`}
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end p-4 rounded-lg border dark:border-border">
            <div className="space-y-2 md:col-span-2">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Account</Label>
              <Autocomplete
                options={accounts.map(a => ({ value: a.id, label: `${a.code} — ${a.name}` }))}
                value={accountId}
                onValueChange={setAccountId}
                placeholder="Select account…"
              />
            </div>
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
            <Button onClick={load} disabled={isPending || !accountId}>
              <RefreshCw className={cn("h-4 w-4 mr-2", isPending && "animate-spin")} />
              {isPending ? "Loading…" : "Load"}
            </Button>
          </div>

          {!data && (
            <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
              Select an account and click Load to view the ledger.
            </div>
          )}

          {data && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Opening Balance", value: data.openingBalance, color: "text-foreground" },
                  { label: "Total Debit",     value: data.rows.reduce((s, r) => s + r.debit,  0), color: "text-blue-600 dark:text-blue-400" },
                  { label: "Total Credit",    value: data.rows.reduce((s, r) => s + r.credit, 0), color: "text-red-600 dark:text-red-400" },
                  { label: "Closing Balance", value: data.closingBalance, color: data.closingBalance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400" },
                ].map(c => (
                  <div key={c.label} className="rounded-lg border dark:border-border p-4">
                    <p className="text-xs uppercase font-semibold text-muted-foreground">{c.label}</p>
                    <p className={cn("text-xl font-bold mt-1 font-mono", c.color)}>{fmt(c.value)}</p>
                  </div>
                ))}
              </div>

              {/* Transactions table */}
              <div className="overflow-x-auto rounded-lg border dark:border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-b dark:border-border">
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider">Date</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider">Reference</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider">Source</th>
                      <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider">Description</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider">Debit</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider">Credit</th>
                      <th className="text-right px-4 py-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Opening balance row */}
                    <tr className="bg-muted/20 border-b dark:border-border/50 italic text-muted-foreground">
                      <td className="px-4 py-2" colSpan={6}>Opening Balance</td>
                      <td className="px-4 py-2 text-right font-mono font-semibold">{fmt(data.openingBalance)}</td>
                    </tr>
                    {data.rows.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No transactions in this period.</td>
                      </tr>
                    )}
                    {data.rows.map((row, i) => (
                      <tr key={row.id} className={cn("border-b dark:border-border/50 hover:bg-accent/30", i % 2 === 1 && "bg-muted/10")}>
                        <td className="px-4 py-2 whitespace-nowrap">{format(new Date(row.transactionDate), "dd-MMM-yyyy")}</td>
                        <td className="px-4 py-2 font-mono text-xs font-semibold">{row.sourceRef}</td>
                        <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                          {SOURCE_LABELS[row.sourceType] ?? row.sourceType}
                        </td>
                        <td className="px-4 py-2 text-xs max-w-[200px] truncate">{row.description ?? "—"}</td>
                        <td className="px-4 py-2 text-right font-mono">{row.debit  > 0 ? fmt(row.debit)  : "—"}</td>
                        <td className="px-4 py-2 text-right font-mono">{row.credit > 0 ? fmt(row.credit) : "—"}</td>
                        <td className={cn("px-4 py-2 text-right font-mono font-semibold",
                          row.runningBalance >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
                        )}>
                          {fmt(row.runningBalance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted/60 border-t-2 dark:border-border font-bold">
                      <td colSpan={4} className="px-4 py-3 text-right uppercase text-xs tracking-wider">Closing Balance</td>
                      <td className="px-4 py-3 text-right font-mono">{fmt(data.rows.reduce((s, r) => s + r.debit,  0))}</td>
                      <td className="px-4 py-3 text-right font-mono">{fmt(data.rows.reduce((s, r) => s + r.credit, 0))}</td>
                      <td className={cn("px-4 py-3 text-right font-mono",
                        data.closingBalance >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
                      )}>
                        {fmt(data.closingBalance)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {data.pagination.total > data.rows.length && (
                <p className="text-xs text-muted-foreground text-center">
                  Showing {data.rows.length} of {data.pagination.total} transactions.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
