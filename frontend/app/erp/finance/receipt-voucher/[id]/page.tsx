"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { getReceiptVoucher, updateReceiptVoucherStatus, ReceiptVoucher } from "@/lib/actions/receipt-voucher";
import { ReceiptVoucherPrint, numberToWords } from "../components/receipt-voucher-print";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Printer,
  ArrowLeft,
  CreditCard,
  Wallet,
  Hash,
  CalendarDays,
  FileText,
  Landmark,
  CheckCircle2,
  Clock,
  XCircle,
  Receipt,
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
export default function ReceiptVoucherDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [voucher, setVoucher] = useState<ReceiptVoucher | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);

  const handleUpdateStatus = async (newStatus: "approved" | "rejected") => {
    if (!voucher) return;
    try {
      setActionPending(true);
      const res = await updateReceiptVoucherStatus(voucher.id, newStatus);
      if (res.status) {
        toast.success(`Receipt Voucher ${newStatus} successfully`);
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

  useEffect(() => {
    getReceiptVoucher(id).then((res) => {
      if (res.status && res.data) {
        setVoucher(res.data);
      } else {
        toast.error(res.message || "Failed to load voucher");
      }
      setLoading(false);
    });
  }, [id]);

  // ── Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <Receipt className="h-8 w-8 animate-pulse opacity-40" />
          <span className="text-sm">Loading voucher…</span>
        </div>
      </div>
    );
  }

  // ── Not found ──
  if (!voucher) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <XCircle className="h-10 w-10 text-red-400" />
        <p className="text-red-500 font-medium">Voucher not found.</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/erp/finance/receipt-voucher/list" transitionTypes={["nav-back"]}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to list
          </Link>
        </Button>
      </div>
    );
  }

  const isBank = voucher.type === "bank";
  const debitRows = voucher.details.filter((d) => Number(d.debit) > 0);
  const creditRows = voucher.details.filter((d) => Number(d.credit) > 0);
  const totalDebit = debitRows.reduce((s, d) => s + (Number(d.debit) || 0), 0) || Number(voucher.debitAmount) || 0;
  const totalCredit = creditRows.reduce((s, d) => s + (Number(d.credit) || 0), 0) || totalDebit;
  const statusCfg = STATUS_CONFIG[voucher.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = statusCfg.icon;

  return (
    <>
      {/* ── Print styles ── */}
      <style jsx global>{`
        @media print {
          body {
            visibility: hidden;
            background: white;
          }
          #rv-print-section, #rv-print-section * {
            visibility: visible;
          }
          #rv-print-section {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            background: white;
            z-index: 9999;
          }
          tr {
            page-break-inside: avoid;
          }
          thead {
            display: table-header-group;
          }
          tfoot {
            display: table-footer-group;
          }
          @page {
            margin: 10mm;
            size: A4 portrait;
          }
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
              <Link href="/erp/finance/receipt-voucher/list" transitionTypes={["nav-back"]}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
                {isBank ? (
                  <CreditCard className="h-5 w-5 text-blue-500" />
                ) : (
                  <Wallet className="h-5 w-5 text-green-500" />
                )}
                {isBank ? "Bank" : "Cash"} Receipt Voucher
              </h1>
              <p className="text-sm text-muted-foreground font-mono mt-0.5">{voucher.rvNo}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => window.print()} size="sm" variant="outline">
              <Printer className="h-4 w-4 mr-2" />
              Print Voucher
            </Button>
            {voucher.status === "pending" && (
              <>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/erp/finance/receipt-voucher/${voucher.id}/edit`}>
                    Edit Voucher
                  </Link>
                </Button>
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
              Voucher Details
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-5">

              {/* RV Number */}
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                  <Hash className="h-3 w-3" /> Voucher No.
                </p>
                <p className="font-mono font-semibold text-sm">{voucher.rvNo}</p>
              </div>

              {/* Date */}
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" /> Date
                </p>
                <p className="font-semibold text-sm">
                  {voucher.rvDate ? format(new Date(voucher.rvDate), "dd MMM yyyy") : "—"}
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

              {/* Type */}
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Type</p>
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  {isBank ? (
                    <CreditCard className="h-3.5 w-3.5 text-blue-500" />
                  ) : (
                    <Wallet className="h-3.5 w-3.5 text-green-500" />
                  )}
                  {isBank ? "Bank" : "Cash"}
                </div>
              </div>

              {/* Cheque (bank only) */}
              {isBank && voucher.chequeNo && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                    <Landmark className="h-3 w-3" /> Cheque #
                  </p>
                  <p className="font-mono font-semibold text-sm">{voucher.chequeNo}</p>
                </div>
              )}

              {/* Ref Bill No */}
              {voucher.refBillNo && (
                <div className="space-y-1">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Ref / Bill No.</p>
                  <p className="font-mono text-sm">{voucher.refBillNo}</p>
                </div>
              )}

              {/* Tax applicable */}
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Tax Applicable</p>
                <p className="text-sm font-semibold">{voucher.isTaxApplicable ? "Yes" : "No"}</p>
              </div>

              {/* Advance */}
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Advance</p>
                <p className="text-sm font-semibold">{voucher.isAdvance ? "Yes" : "No"}</p>
              </div>

            </div>
          </CardContent>
        </Card>

        {/* ── Journal entries table ── */}
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
                    Account
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
                    </td>
                    <td className="px-4 py-3 align-top text-muted-foreground text-xs leading-relaxed">
                      {d.narration || voucher.description}
                    </td>
                    <td className="px-4 py-3 text-right align-top font-mono font-bold tabular-nums text-blue-600 dark:text-blue-400">
                      {Number(d.debit) > 0 ? fmt(Number(d.debit)) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right align-top font-mono tabular-nums text-muted-foreground/50">
                      —
                    </td>
                  </tr>
                ))}

                {/* Fallback debit row */}
                {debitRows.length === 0 && voucher.debitAccountName && (
                  <tr className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 align-top">
                      <div className="flex items-baseline gap-2">
                        {voucher.debitAccountCode && (
                          <span className="font-mono text-xs font-bold text-muted-foreground shrink-0">
                            {voucher.debitAccountCode}
                          </span>
                        )}
                        <span className="uppercase text-sm font-semibold">{voucher.debitAccountName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-muted-foreground text-xs leading-relaxed">
                      {voucher.description}
                    </td>
                    <td className="px-4 py-3 text-right align-top font-mono font-bold tabular-nums text-blue-600 dark:text-blue-400">
                      {fmt(totalDebit)}
                    </td>
                    <td className="px-4 py-3 text-right align-top font-mono tabular-nums text-muted-foreground/50">
                      —
                    </td>
                  </tr>
                )}

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

                      {(d.refBillNo || d.isTaxApplicable || voucher.refBillNo || voucher.isTaxApplicable) && (
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <span className="font-bold text-foreground/70">Ref#</span>
                          {(d.isTaxApplicable ?? voucher.isTaxApplicable) && (
                            <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">
                              TAXABLE
                            </span>
                          )}
                          {(d.refBillNo || voucher.refBillNo) && (
                            <span className="font-mono">{d.refBillNo || voucher.refBillNo}</span>
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
                      {Number(d.credit) > 0 ? fmt(Number(d.credit)) : "—"}
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
                Description / Narration
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
      <div id="rv-print-section" className="hidden print:block">
        <ReceiptVoucherPrint voucher={voucher} />
      </div>
    </>
  );
}
