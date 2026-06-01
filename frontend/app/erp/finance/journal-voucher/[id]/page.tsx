"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { getJournalVoucher, updateJournalVoucher, JournalVoucher } from "@/lib/actions/journal-voucher";
import { JournalVoucherPrint, numberToWords } from "../components/journal-voucher-print";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Printer,
  ArrowLeft,
  Hash,
  CalendarDays,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  Receipt,
  FileCheck2,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── helpers ─────────────────────────────────────────────────────────────────
function fmt(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function folio(id: string) {
  return id.replace(/-/g, "").slice(-5).toUpperCase();
}

const STATUS_CONFIG = {
  approved: { label: "Approved", icon: CheckCircle2, cls: "bg-green-500/10 text-green-600 border-green-200 dark:border-green-800" },
  pending:  { label: "Pending",  icon: Clock,         cls: "bg-yellow-500/10 text-yellow-600 border-yellow-200 dark:border-yellow-800" },
  rejected: { label: "Rejected", icon: XCircle,       cls: "bg-red-500/10 text-red-600 border-red-200 dark:border-red-800" },
} as const;

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function JournalVoucherDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [voucher, setVoucher] = useState<JournalVoucher | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);

  useEffect(() => {
    getJournalVoucher(id).then((res) => {
      if (res.status && res.data) {
        setVoucher(res.data);
      } else {
        toast.error(res.message || "Failed to load journal voucher");
      }
      setLoading(false);
    });
  }, [id]);

  const handleUpdateStatus = async (newStatus: "approved" | "rejected") => {
    if (!voucher) return;
    try {
      setActionPending(true);
      const res = await updateJournalVoucher(voucher.id, { status: newStatus });
      if (res.status) {
        toast.success(`Journal Voucher ${newStatus} successfully`);
        setVoucher((prev) => prev ? { ...prev, status: newStatus } : null);
      } else {
        toast.error(res.message || `Failed to update status to ${newStatus}`);
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setActionPending(false);
    }
  };

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <Receipt className="h-8 w-8 animate-pulse opacity-40" />
          <span className="text-sm">Loading journal voucher…</span>
        </div>
      </div>
    );
  }

  // ── Not found ──
  if (!voucher) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <XCircle className="h-10 w-10 text-red-400" />
        <p className="text-red-500 font-medium">Journal Voucher not found.</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/erp/finance/journal-voucher/list" transitionTypes={["nav-back"]}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to list
          </Link>
        </Button>
      </div>
    );
  }

  const debitRows = voucher.details.filter((d) => Number(d.debit) > 0);
  const creditRows = voucher.details.filter((d) => Number(d.credit) > 0);
  const totalDebit = debitRows.reduce((s, d) => s + (Number(d.debit) || 0), 0);
  const totalCredit = creditRows.reduce((s, c) => s + (Number(c.credit) || 0), 0);
  const statusCfg = STATUS_CONFIG[voucher.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = statusCfg.icon;

  return (
    <>
      {/* ── Print styles ── */}
      <style jsx global>{`
        @media print {
          body { visibility: hidden; }
          #jv-print-section {
            visibility: visible;
            position: fixed;
            top: 0; left: 0;
            width: 100vw;
            margin: 0; padding: 0;
            background: white;
            z-index: 9999;
          }
          #jv-print-section * { visibility: visible; }
          @page { margin: 0; size: A4 portrait; }
          header, nav, footer, aside { display: none !important; }
        }
      `}</style>

      {/* ══════════════════════════════════════════════════════════════
          SCREEN VIEW
      ══════════════════════════════════════════════════════════════ */}
      <div className="p-6 space-y-6 max-w-5xl mx-auto print:hidden">

        {/* ── Top bar ── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link href="/erp/finance/journal-voucher/list" transitionTypes={["nav-back"]}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                <FileCheck2 className="h-5 w-5 text-indigo-500" />
                Journal Voucher Details
              </h1>
              <p className="text-sm text-muted-foreground font-mono mt-0.5">{voucher.jvNo}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => window.print()} size="sm" variant="outline">
              <Printer className="h-4 w-4 mr-2" />
              Print Voucher
            </Button>
            {voucher.status === "pending" && (
              <>
                <Button
                  onClick={() => handleUpdateStatus("approved")}
                  size="sm"
                  disabled={actionPending}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  Approve
                </Button>
                <Button
                  onClick={() => handleUpdateStatus("rejected")}
                  size="sm"
                  variant="destructive"
                  disabled={actionPending}
                >
                  Reject
                </Button>
              </>
            )}
          </div>
        </div>

        {/* ── Meta info card ── */}
        <Card>
          <CardHeader className="border-b dark:border-border pb-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              General Info
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-5">

              {/* JV Number */}
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                  <Hash className="h-3 w-3" /> Voucher No.
                </p>
                <p className="font-mono font-semibold text-sm">{voucher.jvNo}</p>
              </div>

              {/* Date */}
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" /> Date
                </p>
                <p className="font-semibold text-sm">
                  {voucher.jvDate ? format(new Date(voucher.jvDate), "dd MMM yyyy") : "—"}
                </p>
              </div>

              {/* Folio */}
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                  <FileText className="h-3 w-3" /> Folio
                </p>
                <p className="font-mono font-semibold text-sm">{folio(voucher.id)}</p>
              </div>

              {/* Status */}
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Status</p>
                <Badge
                  variant="outline"
                  className={cn("text-[11px] font-semibold gap-1 px-2 py-0.5", statusCfg.cls)}
                >
                  <StatusIcon className="h-3 w-3" />
                  {statusCfg.label}
                </Badge>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* ── Details table ── */}
        <Card className="gap-0 pb-0">
          <CardHeader className="border-b dark:border-border pb-3!">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Journal Entries
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 py-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/60 border-b dark:border-border text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-semibold text-[11px] uppercase tracking-wide w-[40%]">
                    Account Head
                  </th>
                  <th className="px-4 py-2.5 text-left font-semibold text-[11px] uppercase tracking-wide">
                    Narration
                  </th>
                  <th className="px-4 py-2.5 text-right font-semibold text-[11px] uppercase tracking-wide w-[14%]">
                    Debit
                  </th>
                  <th className="px-4 py-2.5 text-right font-semibold text-[11px] uppercase tracking-wide w-[14%]">
                    Credit
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-border">
                {/* Debit rows */}
                {debitRows.map((d, i) => (
                  <tr key={`dr-${i}`} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-baseline gap-2 font-medium">
                        {d.accountCode && (
                          <span className="font-mono text-xs font-bold text-muted-foreground shrink-0">
                            {d.accountCode}
                          </span>
                        )}
                        <span className="uppercase text-sm font-semibold">{d.accountName}</span>
                      </div>

                      {/* Tag account sub-line */}
                      {(d.tagAccountCode || d.tagAccountName) && (
                        <div className="flex items-baseline gap-2 mt-0.5 pl-3 border-l-2 border-muted ml-1">
                          {d.tagAccountCode && (
                            <span className="font-mono text-xs font-bold text-muted-foreground shrink-0">
                              {d.tagAccountCode}
                            </span>
                          )}
                          <span className="text-xs text-foreground/80">{d.tagAccountName}</span>
                        </div>
                      )}

                      {/* Ref# line */}
                      {(d.refBillNo || d.isTaxApplicable) && (
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span className="font-bold text-foreground/70">Ref#</span>
                          {d.isTaxApplicable && (
                            <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">
                              TAXABLE
                            </span>
                          )}
                          {d.refBillNo && (
                            <span className="font-mono">{d.refBillNo}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-muted-foreground text-xs leading-relaxed">
                      {d.narration || voucher.description}
                    </td>
                    <td className="px-4 py-3 text-right align-top font-mono font-bold tabular-nums text-blue-600 dark:text-blue-400">
                      {fmt(Number(d.debit))}
                    </td>
                    <td className="px-4 py-3 text-right align-top font-mono tabular-nums text-muted-foreground/50">
                      —
                    </td>
                  </tr>
                ))}

                {/* Credit rows */}
                {creditRows.map((d, i) => (
                  <tr key={`cr-${i}`} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-baseline gap-2 font-medium">
                        {d.accountCode && (
                          <span className="font-mono text-xs font-bold text-muted-foreground shrink-0">
                            {d.accountCode}
                          </span>
                        )}
                        <span className="uppercase text-sm font-semibold">{d.accountName}</span>
                      </div>

                      {/* Tag account sub-line */}
                      {(d.tagAccountCode || d.tagAccountName) && (
                        <div className="flex items-baseline gap-2 mt-0.5 pl-3 border-l-2 border-muted ml-1">
                          {d.tagAccountCode && (
                            <span className="font-mono text-xs font-bold text-muted-foreground shrink-0">
                              {d.tagAccountCode}
                            </span>
                          )}
                          <span className="text-xs text-foreground/80">{d.tagAccountName}</span>
                        </div>
                      )}

                      {/* Ref# line */}
                      {(d.refBillNo || d.isTaxApplicable) && (
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span className="font-bold text-foreground/70">Ref#</span>
                          {d.isTaxApplicable && (
                            <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">
                              TAXABLE
                            </span>
                          )}
                          {d.refBillNo && (
                            <span className="font-mono">{d.refBillNo}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-muted-foreground text-xs leading-relaxed">
                      {d.narration || voucher.description}
                    </td>
                    <td className="px-4 py-3 text-right align-top font-mono tabular-nums text-muted-foreground/50">
                      —
                    </td>
                    <td className="px-4 py-3 text-right align-top font-mono font-bold tabular-nums text-green-600 dark:text-green-400">
                      {fmt(Number(d.credit))}
                    </td>
                  </tr>
                ))}
              </tbody>

              {/* Totals footer */}
              <tfoot>
                <tr className="border-t-2 border-border bg-muted/40 font-bold">
                  <td
                    colSpan={2}
                    className="px-4 py-2.5 text-xs text-muted-foreground italic"
                  >
                    {numberToWords(totalDebit)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-sm">
                    {fmt(totalDebit)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono tabular-nums text-sm">
                    {fmt(totalCredit)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>

        {/* ── Amount summary strip ── */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="border-blue-200 dark:border-blue-900">
            <CardContent className="pt-4 pb-3">
              <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">
                Total Debit
              </p>
              <p className="font-bold text-xl tabular-nums font-mono text-blue-600 dark:text-blue-400">
                {fmt(totalDebit)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-green-200 dark:border-green-900">
            <CardContent className="pt-4 pb-3">
              <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">
                Total Credit
              </p>
              <p className="font-bold text-xl tabular-nums font-mono text-green-600 dark:text-green-400">
                {fmt(totalCredit)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* ── Description / Narration ── */}
        {voucher.description && (
          <Card className="px-0 border-0 shadow-none gap-0">
            <CardHeader className="border-b dark:border-border py-0!">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Remarks / Description
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <p className="text-sm leading-relaxed">{voucher.description}</p>
            </CardContent>
          </Card>
        )}

      </div>

      {/* ══════════════════════════════════════════════════════════════
          PRINT VIEW
      ══════════════════════════════════════════════════════════════ */}
      <div id="jv-print-section" className="hidden print:block">
        <JournalVoucherPrint voucher={voucher} />
      </div>
    </>
  );
}
