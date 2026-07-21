"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  Download,
  Printer,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  BookOpen,
  ArrowUpDown,
  Filter,
  Calendar,
  ExternalLink,
  Info,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { ChartOfAccountSelect } from "@/components/ui/chart-of-account-select";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { Autocomplete } from "@/components/ui/autocomplete";
import { ChartOfAccount } from "@/lib/actions/chart-of-account";
import {
  getGeneralLedger,
  GeneralLedgerResult,
  queueGeneralLedgerExport,
} from "@/lib/actions/finance-reports";
import { numberToWords } from "../../journal-voucher/components/journal-voucher-print";
import Link from "next/link";
import { toast } from "sonner";

const fmt = (n: number) => {
  if (n < 0) {
    const absVal = Math.abs(n).toLocaleString("en-PK", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `(${absVal})`;
  }
  return n.toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const getLocalStartOfDayISO = (d: Date) => {
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
};

const getLocalEndOfDayISO = (d: Date) => {
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return end.toISOString();
};

const SOURCE_LABELS: Record<string, string> = {
  PURCHASE_INVOICE: "PI",
  PAYMENT_VOUCHER: "PV",
  RECEIPT_VOUCHER: "RV",
  JOURNAL_VOUCHER: "JV",
  ADVANCE_APPLICATION: "Advance Application",
  SALES_INVOICE: "SI",
};

const SOURCE_BADGES: Record<string, string> = {
  PURCHASE_INVOICE:
    "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/20 dark:text-orange-300 dark:border-orange-900/30",
  PAYMENT_VOUCHER:
    "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-300 dark:border-rose-900/30",
  RECEIPT_VOUCHER:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-900/30",
  JOURNAL_VOUCHER:
    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-300 dark:border-blue-900/30",
  ADVANCE_APPLICATION:
    "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-300 dark:border-indigo-900/30",
  SALES_INVOICE:
    "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/20 dark:text-purple-300 dark:border-purple-900/30",
};

const getSourceLink = (sourceType: string, sourceId: string) => {
  switch (sourceType) {
    case "JOURNAL_VOUCHER":
      return `/erp/finance/journal-voucher/${sourceId}`;
    case "PAYMENT_VOUCHER":
      return `/erp/finance/payment-voucher/${sourceId}`;
    case "RECEIPT_VOUCHER":
      return `/erp/finance/receipt-voucher/${sourceId}`;
    case "SALES_INVOICE":
      return `/erp/sales/invoices/${sourceId}`;
    case "PURCHASE_INVOICE":
      return `/erp/procurement/purchase-invoice/${sourceId}`;
    default:
      return null;
  }
};

export function GeneralLedgerClient({
  accounts,
}: {
  accounts: ChartOfAccount[];
}) {
  const [accountId, setAccountId] = React.useState("");
  const [tagAccountId, setTagAccountId] = React.useState("");
  const [fromDate, setFromDate] = React.useState<Date | undefined>(
    new Date(new Date().getFullYear(), 0, 1),
  );
  const [toDate, setToDate] = React.useState<Date | undefined>(new Date());
  const [sourceType, setSourceType] = React.useState<string>("all");

  const [data, setData] = React.useState<GeneralLedgerResult | undefined>();
  const [isPending, startTransition] = React.useTransition();
  const [isExporting, setIsExporting] = React.useState(false);

  // Find selected account in the tree to check for children (sub-accounts)
  const selectedAccountInTree = React.useMemo(() => {
    if (!accountId || accounts.length === 0) return null;
    const findInTree = (
      nodes: ChartOfAccount[],
      id: string,
    ): ChartOfAccount | undefined => {
      for (const node of nodes) {
        if (node.id === id) return node;
        if (node.children?.length) {
          const found = findInTree(node.children, id);
          if (found) return found;
        }
      }
      return undefined;
    };
    return findInTree(accounts, accountId);
  }, [accountId, accounts]);

  const subAccounts = selectedAccountInTree?.children ?? [];

  // Pagination states
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(50);

  const load = (targetPage = page, targetLimit = limit) => {
    const targetAccountId = tagAccountId || accountId;
    if (!targetAccountId) return;
    startTransition(async () => {
      const res = await getGeneralLedger(targetAccountId, {
        from: fromDate ? getLocalStartOfDayISO(fromDate) : undefined,
        to: toDate ? getLocalEndOfDayISO(toDate) : undefined,
        page: targetPage,
        limit: targetLimit,
        sourceType: sourceType === "all" ? undefined : sourceType,
      });
      if (res.status && res.data) {
        setData(res.data);
      }
    });
  };

  // Handle pagination/limit updates
  React.useEffect(() => {
    if (data) {
      load(page, limit);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit]);

  const handleLoadClick = () => {
    setPage(1);
    load(1, limit);
  };

  // Dynamic Normal balance checks for account layout
  const isDebitNormal =
    data?.account.type === "ASSET" || data?.account.type === "EXPENSE";

  // Client-side CSV export
  const exportToCSV = () => {
    if (!data) return;
    const headers = [
      "Date",
      "VOH No.",
      "VOH TYPE",
      "Cheque No",
      "Ref 1",
      "Ref 2",
      "Narration",
      "Debit",
      "Credit",
      "Running Balance",
    ];

    // Convert rows to plain values
    const rows = data.rows.map((r) => [
      format(new Date(r.transactionDate), "yyyy-MM-dd"),
      r.sourceRef,
      SOURCE_LABELS[r.sourceType] ?? r.sourceType,
      r.chequeNo ?? "",
      r.refBillNo ?? "",
      r.refBillNo2 ?? "",
      r.narration || r.description || "",
      r.debit > 0 ? r.debit.toFixed(2) : "0.00",
      r.credit > 0 ? r.credit.toFixed(2) : "0.00",
      r.runningBalance.toFixed(2),
    ]);

    // Build the CSV structure
    const csvContent = [
      [`General Ledger Report - ${data.account.code} - ${data.account.name}`],
      [
        `Period: ${fromDate ? format(fromDate, "dd-MMM-yyyy") : "Beginning"} to ${toDate ? format(toDate, "dd-MMM-yyyy") : "Present"}`,
      ],
      [
        `Normal Balance Type: ${isDebitNormal ? "Debit Normal" : "Credit Normal"}`,
      ],
      [],
      headers,
      ["", "", "Opening Balance", "", "", "", "Balance brought forward", "", "", data.openingBalance.toFixed(2)],
      ...rows,
      [
        "",
        "",
        "Closing Balance",
        "",
        "",
        "",
        "",
        data.rangeTotalDebit.toFixed(2),
        data.rangeTotalCredit.toFixed(2),
        data.rangeClosingBalance.toFixed(2),
      ],
    ]
      .map((row) =>
        row
          .map((val) => {
            const strVal = val ? val.toString() : "";
            return `"${strVal.replace(/"/g, '""')}"`;
          })
          .join(","),
      )
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `general-ledger-${data.account.code}-${format(new Date(), "yyyyMMdd")}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Dispatch Background Excel queue export
  const handleQueueExport = () => {
    const targetAccountId = tagAccountId || accountId;
    if (!targetAccountId) return;
    setIsExporting(true);

    toast.promise(
      queueGeneralLedgerExport(targetAccountId, {
        from: fromDate ? getLocalStartOfDayISO(fromDate) : undefined,
        to: toDate ? getLocalEndOfDayISO(toDate) : undefined,
        sourceType: sourceType === "all" ? undefined : sourceType,
      }),
      {
        loading: "Queueing Excel export job...",
        success: (res) => {
          setIsExporting(false);
          if (res && res.status) {
            return "Export queued! We will notify you when your workbook is ready.";
          } else {
            throw new Error(res?.message || "Failed to queue export");
          }
        },
        error: (err) => {
          setIsExporting(false);
          return err.message || "Failed to trigger background export.";
        },
      },
    );
  };

  return (
    <>
      {/* ─── SCREEN VIEW (HIDDEN ON PRINT) ─── */}
      <div className="space-y-6 animate-in fade-in duration-300 print:hidden">
        <Card className="border-border/50 shadow-lg dark:bg-card/45 dark:backdrop-blur-md">
          <CardHeader className="border-b dark:border-border/50 flex flex-row items-center justify-between flex-wrap gap-4 py-5 bg-muted/20">
            <div>
              <CardTitle className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-indigo-500 bg-clip-text text-transparent">
                General Ledger
              </CardTitle>
              {data && (
                <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground flex-wrap">
                  <span className="font-semibold px-2 py-0.5 bg-muted rounded-full border dark:border-border/40">
                    {data.account.code} — {data.account.name}
                  </span>
                  <span className="text-muted-foreground/60">•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {fromDate && toDate
                      ? `${format(fromDate, "dd MMM yyyy")} – ${format(toDate, "dd MMM yyyy")}`
                      : "All Time"}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                disabled={!data}
                className="h-9 hover:bg-accent border-border/70 text-xs"
              >
                <Printer className="h-3.5 w-3.5 mr-2 text-muted-foreground" />{" "}
                Print / PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportToCSV}
                disabled={!data}
                className="h-9 hover:bg-accent border-border/70 text-xs"
              >
                <Download className="h-3.5 w-3.5 mr-2 text-muted-foreground" />{" "}
                Export (CSV)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleQueueExport}
                disabled={!data || isExporting}
                className="h-9 hover:bg-accent border-border/70 text-xs"
              >
                <RefreshCw
                  className={cn(
                    "h-3.5 w-3.5 mr-2 text-muted-foreground",
                    isExporting && "animate-spin",
                  )}
                />{" "}
                Queue Excel
              </Button>
            </div>
          </CardHeader>

          <CardContent className="pt-6 space-y-6">
            {/* Filters Bar */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end p-5 rounded-xl border border-border bg-muted/10 dark:bg-muted/5 shadow-sm">
              <div
                className={cn(
                  "space-y-2",
                  subAccounts.length > 0 ? "md:col-span-3" : "md:col-span-4",
                )}
              >
                <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <BookOpen className="h-3 w-3 text-primary/70" /> Chart of
                  Account
                </Label>
                <ChartOfAccountSelect
                  accounts={accounts}
                  value={accountId}
                  onValueChange={(val) => {
                    setAccountId(val);
                    setTagAccountId(""); // Reset sub-account when main account changes
                  }}
                  placeholder="Select Account..."
                  allowGroups={true}
                  excludeTags
                  className="h-10 text-sm shadow-sm"
                />
              </div>

              {subAccounts.length > 0 && (
                <div className="space-y-2 md:col-span-3">
                  <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Tag className="h-3 w-3 text-primary/70" /> Sub-account /
                    Tag
                  </Label>
                  <Autocomplete
                    options={[
                      { value: "all", label: "All Sub-accounts" },
                      ...subAccounts.map((child) => ({
                        value: child.id,
                        label: `${child.code} - ${child.name}`,
                      })),
                    ]}
                    value={tagAccountId || "all"}
                    onValueChange={(value) =>
                      setTagAccountId(value === "all" ? "" : value)
                    }
                    placeholder="Select Sub-account..."
                    searchPlaceholder="Search sub-account..."
                    className="h-10 text-sm shadow-sm"
                  />
                </div>
              )}

              <div
                className={cn(
                  "space-y-2",
                  subAccounts.length > 0 ? "md:col-span-2" : "md:col-span-3",
                )}
              >
                <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3 w-3 text-primary/70" /> Date Range
                </Label>
                <DateRangePicker
                  initialDateFrom={fromDate}
                  initialDateTo={toDate}
                  onUpdate={(v) => {
                    setFromDate(v.range.from);
                    setToDate(v.range.to);
                  }}
                  align="start"
                  locale="en-GB"
                  showCompare={false}
                  triggerClassName="h-10 text-sm w-full shadow-sm"
                />
              </div>

              <div
                className={cn(
                  "space-y-2",
                  subAccounts.length > 0 ? "md:col-span-2" : "md:col-span-3",
                )}
              >
                <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Filter className="h-3 w-3 text-primary/70" /> Document Type
                </Label>
                <Select value={sourceType} onValueChange={setSourceType}>
                  <SelectTrigger className="h-10 text-sm shadow-sm">
                    <SelectValue placeholder="All Documents" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Documents</SelectItem>
                    {Object.entries(SOURCE_LABELS).map(([key, val]) => (
                      <SelectItem key={key} value={key}>
                        {val}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-2">
                <Button
                  onClick={handleLoadClick}
                  disabled={isPending || !accountId}
                  className="h-10 w-full font-medium text-sm shadow-md transition-all hover:translate-y-[-1px] active:translate-y-[0px] hover:shadow-lg bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/95 hover:to-indigo-600/95"
                >
                  <RefreshCw
                    className={cn("h-4 w-4 mr-2", isPending && "animate-spin")}
                  />
                  {isPending ? "Loading..." : "Load Ledger"}
                </Button>
              </div>
            </div>

            {!data && (
              <div className="flex flex-col items-center justify-center h-52 text-muted-foreground border border-dashed rounded-xl p-8 bg-muted/5">
                <BookOpen className="h-10 w-10 text-muted-foreground/35 mb-3 stroke-[1.5]" />
                <p className="text-sm font-medium">No account selected</p>
                <p className="text-xs text-muted-foreground/70 mt-1 max-w-[280px] text-center">
                  Select a chart of account head and specify a date range, then
                  click "Load Ledger" to inspect transaction records.
                </p>
              </div>
            )}

            {data && (
              <>
                {/* Premium KPI Summary Blocks */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    {
                      label: "Opening Balance",
                      value: data.openingBalance,
                      desc: isDebitNormal ? "Debit normal" : "Credit normal",
                      color: "text-foreground",
                      badge: data.openingBalance >= 0 ? "Dr" : "Cr",
                      gradient:
                        "from-slate-50 to-slate-100 dark:from-slate-900/30 dark:to-slate-800/20 border-slate-200/60 dark:border-slate-800/40",
                    },
                    {
                      label: "Period Debit",
                      value: data.rangeTotalDebit,
                      desc: "Total period volume",
                      color: "text-indigo-600 dark:text-indigo-400",
                      badge: "Dr",
                      gradient:
                        "from-blue-50/70 to-indigo-50/50 dark:from-blue-950/10 dark:to-indigo-950/10 border-indigo-100/50 dark:border-indigo-950/20",
                    },
                    {
                      label: "Period Credit",
                      value: data.rangeTotalCredit,
                      desc: "Total period volume",
                      color: "text-rose-600 dark:text-rose-400",
                      badge: "Cr",
                      gradient:
                        "from-amber-50/70 to-rose-50/50 dark:from-amber-950/10 dark:to-rose-950/10 border-rose-100/50 dark:border-rose-950/20",
                    },
                    {
                      label: "Closing Balance",
                      value: data.rangeClosingBalance,
                      desc: `Net ${isDebitNormal ? "Dr" : "Cr"} normal`,
                      color:
                        (isDebitNormal ? data.rangeClosingBalance >= 0 : data.rangeClosingBalance <= 0)
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-rose-600 dark:text-rose-400",
                      badge: data.rangeClosingBalance >= 0 ? "Dr" : "Cr",
                      gradient:
                        (isDebitNormal ? data.rangeClosingBalance >= 0 : data.rangeClosingBalance <= 0)
                          ? "from-emerald-50/70 to-teal-50/50 dark:from-emerald-950/10 dark:to-teal-950/10 border-emerald-100/50 dark:border-emerald-950/20"
                          : "from-amber-50/70 to-rose-50/50 dark:from-amber-950/10 dark:to-rose-950/10 border-rose-100/50 dark:border-rose-950/20",
                    },
                  ].map((c) => (
                    <div
                      key={c.label}
                      className={cn(
                        "rounded-xl border p-4 shadow-sm relative overflow-hidden bg-gradient-to-br transition-all hover:shadow-md",
                        c.gradient,
                      )}
                    >
                      <div className="flex justify-between items-start gap-1">
                        <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground/80">
                          {c.label}
                        </p>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-muted/80 border dark:border-border/30 text-muted-foreground select-none">
                          {c.badge}
                        </span>
                      </div>
                      <p
                        className={cn(
                          "text-lg sm:text-xl font-bold mt-1.5 font-mono tracking-tight",
                          c.color,
                        )}
                      >
                        {fmt(c.value)}
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1 flex items-center gap-1 italic">
                        <Info className="h-2.5 w-2.5 shrink-0" />
                        {c.desc}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Transactions Table Layout */}
                <div className="overflow-x-auto rounded-xl border dark:border-border/60 shadow-sm bg-card">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-muted/30 border-b border-border text-muted-foreground/90 font-medium">
                        <th className="text-left px-4 py-3.5 font-bold uppercase text-[10px] tracking-wider border-r dark:border-border/50 w-28">
                          Date
                        </th>
                        <th className="text-left px-4 py-3.5 font-bold uppercase text-[10px] tracking-wider border-r dark:border-border/50 w-36">
                          VOH No.
                        </th>
                        <th className="text-left px-4 py-3.5 font-bold uppercase text-[10px] tracking-wider border-r dark:border-border/50 w-28">
                          VOH TYPE
                        </th>
                        <th className="text-left px-4 py-3.5 font-bold uppercase text-[10px] tracking-wider border-r dark:border-border/50 w-28">
                          Cheque No.
                        </th>
                        <th className="text-left px-4 py-3.5 font-bold uppercase text-[10px] tracking-wider border-r dark:border-border/50 w-28">
                          Ref 1
                        </th>
                        <th className="text-left px-4 py-3.5 font-bold uppercase text-[10px] tracking-wider border-r dark:border-border/50 w-28">
                          Ref 2
                        </th>
                        <th className="text-left px-4 py-3.5 font-bold uppercase text-[10px] tracking-wider border-r dark:border-border/50">
                          Narration
                        </th>
                        <th className="text-right px-4 py-3.5 font-bold uppercase text-[10px] tracking-wider border-r dark:border-border/50 w-32">
                          Debit
                        </th>
                        <th className="text-right px-4 py-3.5 font-bold uppercase text-[10px] tracking-wider border-r dark:border-border/50 w-32">
                          Credit
                        </th>
                        <th className="text-right px-4 py-3.5 font-bold uppercase text-[10px] tracking-wider w-36">
                          Running Balance
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* Opening Balance Row */}
                      <tr className="bg-muted/10 border-b dark:border-border/40 font-medium text-xs text-muted-foreground">
                        <td className="px-4 py-2.5 border-r dark:border-border/40 font-mono italic">
                          —
                        </td>
                        <td className="px-4 py-2.5 border-r dark:border-border/40 font-mono italic">
                          —
                        </td>
                        <td className="px-4 py-2.5 border-r dark:border-border/40 text-xs italic">
                          Opening Balance
                        </td>
                        <td className="px-4 py-2.5 border-r dark:border-border/40 font-mono italic">
                          —
                        </td>
                        <td className="px-4 py-2.5 border-r dark:border-border/40 font-mono italic">
                          —
                        </td>
                        <td className="px-4 py-2.5 border-r dark:border-border/40 font-mono italic">
                          —
                        </td>
                        <td className="px-4 py-2.5 border-r dark:border-border/40 text-xs italic">
                          Balance brought forward
                        </td>
                        <td className="px-4 py-2.5 text-right border-r dark:border-border/40 font-mono">
                          —
                        </td>
                        <td className="px-4 py-2.5 text-right border-r dark:border-border/40 font-mono">
                          —
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold text-foreground/80 bg-muted/5">
                          {fmt(data.openingBalance)}
                        </td>
                      </tr>

                      {data.rows.length === 0 && (
                        <tr>
                          <td
                            colSpan={10}
                            className="px-4 py-12 text-center text-muted-foreground font-medium bg-muted/5 border-b"
                          >
                            No accounting transactions recorded in this period.
                          </td>
                        </tr>
                      )}

                      {data.rows.map((row, i) => {
                        const drillDownLink = getSourceLink(
                          row.sourceType,
                          row.sourceId,
                        );
                        return (
                          <tr
                            key={row.id}
                            className={cn(
                              "border-b border-border/50 hover:bg-accent/40 transition-colors text-xs",
                              i % 2 === 1 && "bg-muted/5",
                            )}
                          >
                            {/* Date */}
                            <td className="px-4 py-3 border-r dark:border-border/40 whitespace-nowrap text-muted-foreground font-mono">
                              {format(
                                new Date(row.transactionDate),
                                "dd-MMM-yyyy",
                              )}
                            </td>

                            {/* Reference & Drill down */}
                            <td className="px-4 py-3 border-r dark:border-border/40 font-mono font-semibold text-xs">
                              {drillDownLink ? (
                                <Link
                                  href={drillDownLink}
                                  className="inline-flex items-center text-primary hover:underline hover:text-indigo-600 transition-colors gap-1"
                                >
                                  {row.sourceRef}
                                  <ExternalLink className="h-2.5 w-2.5 text-primary/50" />
                                </Link>
                              ) : (
                                row.sourceRef
                              )}
                            </td>

                            {/* Source Badge */}
                            <td className="px-4 py-3 border-r dark:border-border/40 whitespace-nowrap">
                              <span
                                className={cn(
                                  "px-2 py-0.5 rounded text-[10px] font-bold border",
                                  SOURCE_BADGES[row.sourceType] ??
                                    "bg-slate-100 border-slate-200",
                                )}
                              >
                                {SOURCE_LABELS[row.sourceType] ??
                                  row.sourceType}
                              </span>
                            </td>

                            {/* Cheque No */}
                            <td className="px-4 py-3 border-r dark:border-border/40 font-mono text-xs text-muted-foreground">
                              {row.chequeNo || "—"}
                            </td>

                            {/* Ref 1 */}
                            <td className="px-4 py-3 border-r dark:border-border/40 font-mono text-xs text-muted-foreground">
                              {row.refBillNo || "—"}
                            </td>

                            {/* Ref 2 */}
                            <td className="px-4 py-3 border-r dark:border-border/40 font-mono text-xs text-muted-foreground">
                              {row.refBillNo2 || "—"}
                            </td>

                            {/* Narration */}
                            <td className="px-4 py-3 border-r dark:border-border/40 max-w-[240px] truncate text-muted-foreground/90">
                              <div className="font-medium truncate">
                                {row.narration || row.description || "—"}
                              </div>
                            </td>

                            {/* Debit */}
                            <td className="px-4 py-3 text-right border-r dark:border-border/40 font-mono text-xs">
                              {row.debit > 0 ? (
                                <span className="font-medium text-foreground">
                                  {fmt(row.debit)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/30">
                                  —
                                </span>
                              )}
                            </td>

                            {/* Credit */}
                            <td className="px-4 py-3 text-right border-r dark:border-border/40 font-mono text-xs">
                              {row.credit > 0 ? (
                                <span className="font-medium text-foreground">
                                  {fmt(row.credit)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/30">
                                  —
                                </span>
                              )}
                            </td>

                            {/* Running Balance */}
                            <td
                              className={cn(
                                "px-4 py-3 text-right font-mono font-bold text-xs bg-muted/5",
                                row.runningBalance >= 0
                                  ? "text-emerald-700 dark:text-emerald-400"
                                  : "text-rose-700 dark:text-rose-400",
                              )}
                            >
                              {fmt(row.runningBalance)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>

                    {/* Totals Footer Row */}
                    <tfoot>
                      <tr className="bg-muted/40 border-t-2 border-border font-bold text-xs text-foreground">
                        <td
                          colSpan={7}
                          className="px-4 py-3.5 text-right border-r dark:border-border/40 uppercase tracking-wider font-extrabold text-[10px] text-muted-foreground"
                        >
                          Total Activity / Range Net
                        </td>
                        <td className="px-4 py-3.5 text-right border-r dark:border-border/40 font-mono text-xs text-indigo-600 dark:text-indigo-400">
                          {fmt(data.rangeTotalDebit)}
                        </td>
                        <td className="px-4 py-3.5 text-right border-r dark:border-border/40 font-mono text-xs text-rose-600 dark:text-rose-400">
                          {fmt(data.rangeTotalCredit)}
                        </td>
                        <td
                          className={cn(
                            "px-4 py-3.5 text-right font-mono text-xs font-extrabold bg-muted/10",
                            data.rangeClosingBalance >= 0
                              ? "text-emerald-700 dark:text-emerald-400 border-l-2 border-emerald-500/50"
                              : "text-rose-700 dark:text-rose-400 border-l-2 border-rose-500/50",
                          )}
                        >
                          {fmt(data.rangeClosingBalance)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Advanced Pagination UI Block */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border border-border/80 bg-muted/10 dark:bg-muted/5">
                  <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                    <span>
                      Showing{" "}
                      <span className="font-semibold text-foreground">
                        {data.pagination.total === 0
                          ? 0
                          : (data.pagination.page - 1) * data.pagination.limit +
                            1}
                      </span>{" "}
                      to{" "}
                      <span className="font-semibold text-foreground">
                        {Math.min(
                          data.pagination.page * data.pagination.limit,
                          data.pagination.total,
                        )}
                      </span>{" "}
                      of{" "}
                      <span className="font-semibold text-foreground">
                        {data.pagination.total}
                      </span>{" "}
                      transactions
                    </span>
                    <span className="text-muted-foreground/45">•</span>
                    <span className="font-semibold px-2 py-0.5 bg-muted rounded-md text-foreground border dark:border-border/40">
                      Page {data.pagination.page} of{" "}
                      {data.pagination.totalPages || 1}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 flex-wrap">
                    {/* Rows Limit size selector */}
                    <div className="flex items-center gap-2">
                      <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground whitespace-nowrap">
                        Rows per page
                      </Label>
                      <Select
                        value={limit.toString()}
                        onValueChange={(val) => {
                          setLimit(Number(val));
                          setPage(1);
                        }}
                      >
                        <SelectTrigger className="h-8 w-20 text-xs shadow-sm">
                          <SelectValue placeholder="50" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                          <SelectItem value="250">250</SelectItem>
                          <SelectItem value="500">500</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Page Navigator buttons */}
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 hover:bg-accent"
                        onClick={() => setPage(1)}
                        disabled={page === 1}
                        title="First Page"
                      >
                        <ChevronsLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 hover:bg-accent"
                        onClick={() => setPage((p) => Math.max(p - 1, 1))}
                        disabled={page === 1}
                        title="Previous Page"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>

                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 hover:bg-accent"
                        onClick={() =>
                          setPage((p) =>
                            Math.min(p + 1, data.pagination.totalPages),
                          )
                        }
                        disabled={page >= data.pagination.totalPages}
                        title="Next Page"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 hover:bg-accent"
                        onClick={() => setPage(data.pagination.totalPages)}
                        disabled={page >= data.pagination.totalPages}
                        title="Last Page"
                      >
                        <ChevronsRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── GORGEOUS PRINT/PDF VIEW CONTAINER (HIDDEN ON SCREEN, SHOWN IN PRINT) ─── */}
      {data && (
        <div
          id="general-ledger-print-section"
          className="hidden print:block font-sans text-black p-4 bg-white min-h-screen leading-normal w-full max-w-[1000px] mx-auto box-border"
        >
          <style
            dangerouslySetInnerHTML={{
              __html: `
            @media print {
              body * {
                visibility: hidden !important;
              }
              #general-ledger-print-section,
              #general-ledger-print-section * {
                visibility: visible !important;
              }
              #general-ledger-print-section {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                margin: 0 !important;
                padding: 10px !important;
                box-sizing: border-box !important;
              }
            }
          `,
            }}
          />
          {/* Header */}
          <div className="flex justify-between mb-3 gap-4 items-start border-b pb-2 border-gray-300">
            <div className="w-[15%] flex flex-col items-start justify-center">
              <img
                src="/image.png"
                alt="Logo"
                className="w-20 object-contain"
              />
            </div>

            <div className="w-[55%] flex flex-col justify-center text-center">
              <div className="bg-[#eef2f6] text-black w-full text-center py-1.5 text-md font-bold print:bg-[#eef2f6] [-webkit-print-color-adjust:exact] [color-adjust:exact] uppercase tracking-wider rounded">
                General Ledger Report
              </div>
              <p className="text-[10px] font-bold text-gray-700 mt-1">
                Account Head: {data.account.code} — {data.account.name}
              </p>
            </div>

            <div className="w-[30%] bg-[#f8fafc] text-[8px] sm:text-[9px] p-1.5 border border-gray-300 print:bg-[#f8fafc] [-webkit-print-color-adjust:exact] [color-adjust:exact] flex flex-col gap-0.5 rounded">
              <div className="flex justify-between">
                <span className="font-bold">Period From:</span>
                <span>
                  {fromDate ? format(fromDate, "dd/MM/yyyy") : "Beginning"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold">Period To:</span>
                <span>{toDate ? format(toDate, "dd/MM/yyyy") : "Present"}</span>
              </div>

              <div className="flex justify-between border-t pt-0.5 mt-0.5 border-gray-200">
                <span className="font-bold">Printed:</span>
                <span>{format(new Date(), "dd/MM/yyyy HH:mm")}</span>
              </div>
            </div>
          </div>

          {/* Table */}
          <table className="w-full text-[9px] mb-2 border-collapse table-fixed">
            <thead>
              <tr className="border-y border-black font-bold text-left">
                <th className="py-1 pr-1 w-[8%] text-[9px]">Date</th>
                <th className="py-1 pr-1 w-[11%] text-[9px]">VOH No.</th>
                <th className="py-1 pr-1 w-[10%] text-[9px]">VOH TYPE</th>
                <th className="py-1 pr-1 w-[10%] text-[9px]">Cheque No.</th>
                <th className="py-1 pr-1 w-[9%] text-[9px]">Ref. 1</th>
                <th className="py-1 pr-1 w-[9%] text-[9px]">Ref. 2</th>
                <th className="py-1 pr-1 w-[19%] text-[9px]">Narration</th>
                <th className="py-1 pr-1 text-right w-[8%] text-[9px]">
                  Debit
                </th>
                <th className="py-1 pr-1 text-right w-[8%] text-[9px]">
                  Credit
                </th>
                <th className="py-1 text-right w-[9%] text-[9px]">Balance</th>
              </tr>
            </thead>
            <tbody>
              {/* Opening Balance Row */}
              <tr className="border-b border-gray-300 align-top italic text-gray-600 font-medium bg-gray-50/50">
                <td className="py-1 pr-1">—</td>
                <td className="py-1 pr-1">—</td>
                <td className="py-1 pr-1">Opening Balance</td>
                <td className="py-1 pr-1">—</td>
                <td className="py-1 pr-1">—</td>
                <td className="py-1 pr-1">—</td>
                <td className="py-1 pr-1">Balance brought forward</td>
                <td className="py-1 pr-1 text-right">—</td>
                <td className="py-1 pr-1 text-right">—</td>
                <td className="py-1 text-right font-mono font-semibold">
                  {fmt(data.openingBalance)}
                </td>
              </tr>

              {data.rows.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="py-4 text-center text-gray-500 border-b"
                  >
                    No transactions recorded in this period.
                  </td>
                </tr>
              )}

              {data.rows.map((row) => (
                <tr key={row.id} className="border-b border-gray-200 align-top">
                  <td className="py-1 pr-1 font-mono text-[8px] whitespace-nowrap">
                    {format(new Date(row.transactionDate), "dd/MM/yyyy")}
                  </td>
                  <td className="py-1 pr-1 font-mono font-semibold text-[8px]">
                    {row.sourceRef}
                  </td>
                  <td className="py-1 pr-1 text-[8px]">
                    {SOURCE_LABELS[row.sourceType] ?? row.sourceType}
                  </td>
                  <td className="py-1 pr-1 text-[8px] font-mono">
                    {row.chequeNo || "—"}
                  </td>
                  <td className="py-1 pr-1 text-[8px] font-mono">
                    {row.refBillNo || "—"}
                  </td>
                  <td className="py-1 pr-1 text-[8px] font-mono">
                    {row.refBillNo2 || "—"}
                  </td>
                  <td className="py-1 pr-1 text-[8px] leading-tight break-words">
                    <div>{row.narration || row.description || "—"}</div>
                  </td>
                  <td className="py-1 pr-1 text-right font-mono text-[8px]">
                    {row.debit > 0 ? fmt(row.debit) : ""}
                  </td>
                  <td className="py-1 pr-1 text-right font-mono text-[8px]">
                    {row.credit > 0 ? fmt(row.credit) : ""}
                  </td>
                  <td className="py-1 text-right font-mono font-semibold text-[8px]">
                    {fmt(row.runningBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td
                  colSpan={7}
                  className="py-2 px-0 align-bottom border-b border-black"
                >
                  <div className="flex gap-2 font-bold text-[9px] leading-tight flex-wrap">
                    <span className="whitespace-nowrap">
                      Closing Balance in Words:
                    </span>
                    <span className="underline decoration-dashed decoration-gray-400 underline-offset-2 break-words">
                      {numberToWords(Math.abs(data.rangeClosingBalance))}{" "}
                      {data.rangeClosingBalance >= 0 ? "(Debit)" : "(Credit)"}
                    </span>
                  </div>
                </td>
                <td className="py-1 pr-1 text-right align-bottom border-b border-black">
                  <div
                    className="ml-auto border-t border-black pb-0.5"
                    style={{ borderBottom: "2px double black" }}
                  >
                    <span className="tabular-nums font-mono text-[8px] block pt-0.5">
                      {fmt(data.rangeTotalDebit)}
                    </span>
                  </div>
                </td>
                <td className="py-1 pr-1 text-right align-bottom border-b border-black">
                  <div
                    className="ml-auto border-t border-black pb-0.5"
                    style={{ borderBottom: "2px double black" }}
                  >
                    <span className="tabular-nums font-mono text-[8px] block pt-0.5">
                      {fmt(data.rangeTotalCredit)}
                    </span>
                  </div>
                </td>
                <td className="py-1 text-right align-bottom border-b border-black">
                  <div
                    className="ml-auto border-t border-black pb-0.5"
                    style={{ borderBottom: "2px double black" }}
                  >
                    <span className="tabular-nums font-mono font-bold text-[8px] block pt-0.5">
                      {fmt(data.rangeClosingBalance)}
                    </span>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>

          {/* Remarks */}
          <div className="mt-2 mb-4">
            <div className="font-bold text-[10px]">
              General Ledger Summary Remarks
            </div>
            <p className="text-[9px] mt-0.5 text-gray-700 leading-tight">
              This statement represents verified transaction ledger history for
              Account Head {data.account.code} ({data.account.name}). The
              opening balance of {fmt(data.openingBalance)} is compiled from
              postings preceding{" "}
              {fromDate ? format(fromDate, "dd-MM-yyyy") : "inception"}. Net
              closing balance is {fmt(data.rangeClosingBalance)}.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
