"use client";

import { useState, useEffect, use, useMemo } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { getPaymentVoucher, updatePaymentVoucherStatus, updatePaymentVoucherCpr, PaymentVoucher } from "@/lib/actions/payment-voucher";
import { PaymentVoucherPrint, numberToWords } from "../components/payment-voucher-print";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  FileEdit,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,

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
export default function PaymentVoucherDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [voucher, setVoucher] = useState<PaymentVoucher | null>(null);
  const [mounted, setMounted] = useState(false);
  const [sortField, setSortField] = useState<"debit" | "credit" | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const handleSort = (field: "debit" | "credit") => {
    if (sortField === field) {
      if (sortOrder === "asc") {
        setSortOrder("desc");
      } else {
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  // CPR states
  const [isCprModalOpen, setIsCprModalOpen] = useState(false);
  const [cprValues, setCprValues] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleUpdateStatus = async (newStatus: "approved" | "rejected") => {
    if (!voucher) return;
    try {
      setActionPending(true);
      const res = await updatePaymentVoucherStatus(voucher.id, newStatus);
      if (res.status) {
        toast.success(`Payment Voucher ${newStatus} successfully`);
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

  const handleUpdateCpr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voucher) return;

    try {
      setActionPending(true);
      const detailsPayload = Object.entries(cprValues).map(([id, cprNo]) => ({
        id,
        cprNo: cprNo.trim() || null,
      }));

      const res = await updatePaymentVoucherCpr(voucher.id, detailsPayload);
      if (res.status) {
        toast.success("CPR numbers updated successfully");
        setIsCprModalOpen(false);
        setVoucher((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            details: prev.details.map(d => ({
              ...d,
              cprNo: cprValues[d.id] || null,
            })),
          };
        });
      } else {
        toast.error(res.message || "Failed to update CPR numbers");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setActionPending(false);
    }
  };

  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);

  useEffect(() => {
    getPaymentVoucher(id).then((res) => {
      if (res.status && res.data) {
        setVoucher(res.data);
        const values: { [key: string]: string } = {};
        res.data.details.forEach((d) => {
          values[d.id] = d.cprNo || "";
        });
        setCprValues(values);
      } else {
        toast.error(res.message || "Failed to load voucher");
      }
      setLoading(false);
    });
  }, [id]);

  const sortedDetails = useMemo(() => {
    if (!voucher) return [];
    const list = [...voucher.details];
    if (sortField) {
      list.sort((a, b) => {
        const valA = Number(a[sortField]) || 0;
        const valB = Number(b[sortField]) || 0;
        return sortOrder === "asc" ? valA - valB : valB - valA;
      });
    }
    return list;
  }, [voucher, sortField, sortOrder]);

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
          <Link href="/erp/finance/payment-voucher/list" transitionTypes={["nav-back"]}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to list
          </Link>
        </Button>
      </div>
    );
  }

  const isBank = voucher.type === "bank";
  const totalDebit = voucher.details.reduce((s, d) => s + (Number(d.debit) || 0), 0);
  const totalCredit = Number(voucher.creditAmount) || totalDebit;
  const statusCfg = STATUS_CONFIG[voucher.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = statusCfg.icon;

  // Split detail lines by type
  const debitRows  = voucher.details.filter((d) => Number(d.debit)  > 0);
  const creditRows = voucher.details.filter((d) => Number(d.credit) > 0);

  return (
    <>
      {/* ── Print styles ── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          html, body {
            height: auto !important;
            overflow: visible !important;
            background: white !important;
            color: black !important;
          }
          body > *:not(#pv-print-section) {
            display: none !important;
          }
          #pv-print-section, #pv-print-section * {
            visibility: visible !important;
          }
          #pv-print-section {
            display: block !important;
            position: relative !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            color: black !important;
            z-index: 99999 !important;
          }
          tr {
            page-break-inside: avoid;
            break-inside: avoid;
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
        }
      `}} />

      {/* ══════════════════════════════════════════════════════════════
          SCREEN VIEW
      ══════════════════════════════════════════════════════════════ */}
      <div className="p-6 space-y-6 max-w-5xl mx-auto print:hidden">

        {/* ── Top bar ── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link href="/erp/finance/payment-voucher/list" transitionTypes={["nav-back"]}>
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
                {isBank ? "Bank" : "Cash"} Payment Voucher
              </h1>
              <p className="text-sm text-muted-foreground font-mono mt-0.5">{voucher.pvNo}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => window.print()} size="sm" variant="outline">
              <Printer className="h-4 w-4 mr-2" />
              Print Voucher
            </Button>
            {voucher.status === "approved" && (
              <Button onClick={() => setIsCprModalOpen(true)} size="sm" variant="outline">
                <FileEdit className="h-4 w-4 mr-2" />
                Update CPR Numbers
              </Button>
            )}
            {voucher.status === "pending" && (
              <>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/erp/finance/payment-voucher/${voucher.id}/edit`}>
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

              {/* PV Number */}
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                  <Hash className="h-3 w-3" /> Voucher No.
                </p>
                <p className="font-mono font-semibold text-sm">{voucher.pvNo}</p>
              </div>

              {/* Date */}
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                  <CalendarDays className="h-3 w-3" /> Date
                </p>
                <p className="font-semibold text-sm">
                  {voucher.pvDate ? format(new Date(voucher.pvDate), "dd MMM yyyy") : "—"}
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

              {/* Tax Type */}
              <div className="space-y-1">
                <p className="text-[10px] uppercase font-bold text-muted-foreground">Tax Type</p>
                <p className="text-sm font-semibold">{voucher.taxType ?? "Taxable"}</p>
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
                <tr className="bg-muted/60 border-b dark:border-border text-muted-foreground select-none">
                  <th className="px-4 py-2.5 text-left font-semibold text-[11px] uppercase tracking-wide w-[40%]">
                    Account Head
                  </th>
                  <th className="px-4 py-2.5 text-left font-semibold text-[11px] uppercase tracking-wide">
                    Narration
                  </th>
                  <th 
                    className="px-4 py-2.5 text-right font-semibold text-[11px] uppercase tracking-wide w-[14%] cursor-pointer hover:bg-muted/80"
                    onClick={() => handleSort("debit")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Debit</span>
                      {sortField === "debit" ? (
                        sortOrder === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-muted-foreground/30" />
                      )}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-2.5 text-right font-semibold text-[11px] uppercase tracking-wide w-[14%] cursor-pointer hover:bg-muted/80"
                    onClick={() => handleSort("credit")}
                  >
                    <div className="flex items-center justify-end gap-1">
                      <span>Credit</span>
                      {sortField === "credit" ? (
                        sortOrder === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-muted-foreground/30" />
                      )}
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-border">
                {sortField ? (
                  sortedDetails.map((d, i) => {
                    const isDebit = Number(d.debit) > 0;
                    return (
                      <tr key={d.id || i} className="hover:bg-muted/30 transition-colors">
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
                              <span className="text-xs text-foreground/80 uppercase">{d.tagAccountName}</span>
                            </div>
                          )}

                          {(d.refBillNo || d.taxType || d.cprNo || voucher.refBillNo || voucher.taxType) && (
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <span className="font-bold text-foreground/70">Ref#</span>
                              {(d.taxType ?? voucher.taxType) && (
                                <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">
                                  {d.taxType ?? voucher.taxType}
                                </span>
                              )}
                              {(d.refBillNo || voucher.refBillNo) && (
                                <span className="font-mono">{d.refBillNo || voucher.refBillNo}</span>
                              )}
                              {d.cprNo && (
                                <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">
                                  CPR: {d.cprNo}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top text-muted-foreground text-xs leading-relaxed">
                          {d.narration || voucher.description}
                        </td>
                        <td className={cn(
                          "px-4 py-3 text-right align-top font-mono tabular-nums",
                          isDebit ? "font-bold text-blue-600 dark:text-blue-400" : "text-muted-foreground/50"
                        )}>
                          {isDebit ? fmt(Number(d.debit)) : "—"}
                        </td>
                        <td className={cn(
                          "px-4 py-3 text-right align-top font-mono tabular-nums",
                          !isDebit ? "font-bold text-green-600 dark:text-green-400" : "text-muted-foreground/50"
                        )}>
                          {!isDebit ? fmt(Number(d.credit)) : "—"}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <>
                    {/* Debit rows */}
                    {debitRows.map((d, i) => (
                      <tr key={`dr-${i}`} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 align-top">
                          {/* ── Main account line ── */}
                          <div className="flex items-baseline gap-2 font-medium">
                            {d.accountCode && (
                              <span className="font-mono text-xs font-bold text-muted-foreground shrink-0">
                                {d.accountCode}
                              </span>
                            )}
                            <span className="uppercase text-sm font-semibold">{d.accountName}</span>
                          </div>

                          {/* ── Tag account sub-line (indented) ── */}
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

                          {/* ── Ref# line ── */}
                          {(d.refBillNo || d.taxType || d.cprNo || voucher.refBillNo || voucher.taxType) && (
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <span className="font-bold text-foreground/70">Ref#</span>
                              {(d.taxType ?? voucher.taxType) && (
                                <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">
                                  {d.taxType ?? voucher.taxType}
                                </span>
                              )}
                              {(d.refBillNo || voucher.refBillNo) && (
                                <span className="font-mono">{d.refBillNo || voucher.refBillNo}</span>
                              )}
                              {d.cprNo && (
                                <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">
                                  CPR: {d.cprNo}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top text-muted-foreground text-xs leading-relaxed">
                          {d.narration || voucher.description}
                        </td>
                        {/* Debit amount — bold blue */}
                        <td className="px-4 py-3 text-right align-top font-mono font-bold tabular-nums text-blue-600 dark:text-blue-400">
                          {Number(d.debit) > 0 ? fmt(Number(d.debit)) : "—"}
                        </td>
                        {/* Credit — dash */}
                        <td className="px-4 py-3 text-right align-top font-mono tabular-nums text-muted-foreground/50">
                          —
                        </td>
                      </tr>
                    ))}

                    {/* Credit rows */}
                    {creditRows.map((d, i) => (
                      <tr key={`cr-${i}`} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 align-top">
                          {/* ── Main account line ── */}
                          <div className="flex items-baseline gap-2 font-medium">
                            {d.accountCode && (
                              <span className="font-mono text-xs font-bold text-muted-foreground shrink-0">
                                {d.accountCode}
                              </span>
                            )}
                            <span className="uppercase text-sm font-semibold">{d.accountName}</span>
                          </div>

                          {/* ── Tag account sub-line (indented) ── */}
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

                          {/* ── Ref# line ── */}
                          {(d.refBillNo || d.taxType || d.cprNo) && (
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                              <span className="font-bold text-foreground/70">Ref#</span>
                              {d.taxType && (
                                <span className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">
                                  {d.taxType}
                                </span>
                              )}
                              {d.refBillNo && (
                                <span className="font-mono">{d.refBillNo}</span>
                              )}
                              {d.cprNo && (
                                <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">
                                  CPR: {d.cprNo}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 align-top text-muted-foreground text-xs leading-relaxed">
                          {d.narration || voucher.description}
                        </td>
                        {/* Debit — dash */}
                        <td className="px-4 py-3 text-right align-top font-mono tabular-nums text-muted-foreground/50">
                          —
                        </td>
                        {/* Credit amount — bold green */}
                        <td className="px-4 py-3 text-right align-top font-mono font-bold tabular-nums text-green-600 dark:text-green-400">
                          {Number(d.credit) > 0 ? fmt(Number(d.credit)) : "—"}
                        </td>
                      </tr>
                    ))}

                    {/* Fallback: no credit detail rows → show creditAccount from voucher header */}
                    {creditRows.length === 0 && voucher.creditAccountName && (
                      <tr className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3 align-top">
                          <div className="flex items-baseline gap-2">
                            {voucher.creditAccountCode && (
                              <span className="font-mono text-xs font-bold text-muted-foreground shrink-0">
                                {voucher.creditAccountCode}
                              </span>
                            )}
                            <span className="uppercase text-sm font-semibold">{voucher.creditAccountName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 align-top text-muted-foreground text-xs leading-relaxed">
                          {voucher.description}
                        </td>
                        {/* Debit — dash */}
                        <td className="px-4 py-3 text-right align-top font-mono tabular-nums text-muted-foreground/50">
                          —
                        </td>
                        {/* Credit amount — bold green */}
                        <td className="px-4 py-3 text-right align-top font-mono font-bold tabular-nums text-green-600 dark:text-green-400">
                          {fmt(totalCredit)}
                        </td>
                      </tr>
                    )}
                  </>
                )}
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

      {mounted && typeof window !== "undefined" && createPortal(
        <div 
          id="pv-print-section" 
          style={{
            position: "fixed",
            left: "-9999px",
            top: 0,
            pointerEvents: "none",
          }}
          aria-hidden="true"
        >
          <PaymentVoucherPrint voucher={voucher} />
        </div>,
        document.body
      )}

      <Dialog open={isCprModalOpen} onOpenChange={setIsCprModalOpen}>
        <DialogContent className="max-w-md">
          <form onSubmit={handleUpdateCpr}>
            <DialogHeader>
              <DialogTitle>Update CPR Numbers</DialogTitle>
              <DialogDescription>
                Enter the FBR CPR (Computerized Payment Receipt) numbers for each detail row of this Payment Voucher.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 my-4 max-h-[300px] overflow-y-auto pr-2">
              {voucher.details.map((d) => (
                <div key={d.id} className="space-y-1.5 border-b pb-3 last:border-0 last:pb-0">
                  <div className="flex justify-between items-baseline text-xs text-muted-foreground">
                    <span className="font-semibold uppercase truncate max-w-[250px]">
                      {d.accountCode ? `${d.accountCode} - ` : ""}{d.accountName}
                    </span>
                    <span className="font-mono">
                      {Number(d.debit) > 0 ? `Dr: ${fmt(Number(d.debit))}` : `Cr: ${fmt(Number(d.credit))}`}
                    </span>
                  </div>
                  {d.tagAccountName && (
                    <div className="text-[10px] text-muted-foreground pl-2 border-l">
                      Tag: {d.tagAccountName}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`cpr-${d.id}`} className="text-xs shrink-0 w-16">CPR No</Label>
                    <Input
                      id={`cpr-${d.id}`}
                      placeholder="e.g. CPR2026..."
                      value={cprValues[d.id] || ""}
                      onChange={(e) => setCprValues(prev => ({ ...prev, [d.id]: e.target.value }))}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCprModalOpen(false)} disabled={actionPending}>
                Cancel
              </Button>
              <Button type="submit" disabled={actionPending} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                {actionPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
