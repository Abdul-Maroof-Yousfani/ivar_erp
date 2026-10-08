"use client";

import { useState, useEffect, use, useMemo } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { getReceiptVoucher, updateReceiptVoucherStatus, unapproveReceiptVoucher, ReceiptVoucher } from "@/lib/actions/receipt-voucher";
import { RetailSaleReceiptVoucherPrint, numberToWords } from "../components/retail-sale-receipt-voucher-print";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Printer,
  ArrowLeft,
  Store,
  Building2,
  CalendarDays,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
  Pencil,
  FileCheck,
  RotateCcw,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

function fmt(n: number) {
  return n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function folio(id: string) {
  return id.replace(/-/g, "").slice(-5).toUpperCase();
}

const STATUS_CONFIG: Record<string, { label: string; icon: any; cls: string }> = {
  approved:         { label: "Approved", icon: CheckCircle2, cls: "bg-green-500/10 text-green-600 border-green-200 dark:border-green-800 font-bold" },
  pending_approval: { label: "Pending Approval", icon: Clock, cls: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800 font-bold" },
  pending_check:    { label: "Pending Check", icon: Clock,    cls: "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800 font-bold" },
  pending:          { label: "Pending Check", icon: Clock,    cls: "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800 font-bold" },
  draft:            { label: "Draft", icon: Clock,            cls: "bg-slate-500/10 text-slate-600 border-slate-200 dark:border-slate-800 font-bold" },
  rejected:         { label: "Rejected", icon: XCircle,       cls: "bg-red-500/10 text-red-600 border-red-200 dark:border-red-800 font-bold" },
};

export default function RetailSaleReceiptVoucherDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [voucher, setVoucher] = useState<ReceiptVoucher | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleUpdateStatus = async (newStatus: "draft" | "pending_check" | "pending_approval" | "approved" | "rejected") => {
    if (!voucher) return;
    try {
      setActionPending(true);
      const res = await updateReceiptVoucherStatus(voucher.id, newStatus);
      if (res.status) {
        toast.success(`Retail Sale Receipt Voucher status updated to ${newStatus.replace(/_/g, " ")}`);
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
        toast.error(res.message || "Failed to load Retail Sale Receipt Voucher");
      }
      setLoading(false);
    });
  }, [id]);

  const handleUnapprove = async () => {
    if (!voucher) return;
    try {
      setActionPending(true);
      const res = await unapproveReceiptVoucher(voucher.id);
      if (res.status) {
        toast.success("Retail Sale Receipt Voucher unapproved & unposted successfully");
        setVoucher((prev) => prev ? { ...prev, status: "pending_check" } : null);
      } else {
        toast.error(res.message || "Failed to unapprove voucher");
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setActionPending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground">
        <div className="flex flex-col items-center gap-3">
          <Clock className="h-8 w-8 animate-spin opacity-40 text-blue-600" />
          <span className="text-sm font-medium">Loading Retail Sale Receipt Voucher…</span>
        </div>
      </div>
    );
  }

  if (!voucher) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <XCircle className="h-10 w-10 text-red-400" />
        <p className="text-red-500 font-medium">Retail Sale Receipt Voucher not found.</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/erp/finance/retail-sale-receipt-voucher/list">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to RSRV list
          </Link>
        </Button>
      </div>
    );
  }

  const debitRows = voucher.details.filter((d) => Number(d.debit) > 0).sort((a, b) => Number(b.debit) - Number(a.debit));
  const creditRows = voucher.details.filter((d) => Number(d.credit) > 0).sort((a, b) => Number(b.credit) - Number(a.credit));
  const totalDebit = debitRows.reduce((s, d) => s + (Number(d.debit) || 0), 0) || Number(voucher.debitAmount) || 0;
  const totalCredit = creditRows.reduce((s, d) => s + (Number(d.credit) || 0), 0) || totalDebit;

  const statusKey = (voucher.status || "draft").toLowerCase();
  const statusCfg = STATUS_CONFIG[statusKey] || STATUS_CONFIG.draft;
  const StatusIcon = statusCfg.icon;

  const outletTag = voucher.details?.find(d => d.tagAccountCode || d.tagAccountName);
  const outletCode = outletTag?.tagAccountCode || "";
  const outletName = outletTag?.tagAccountName || "";

  return (
    <div className="flex-1 flex flex-col">
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4 print:hidden">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink href="/erp/finance">Finance</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem className="hidden md:block">
              <BreadcrumbLink href="/erp/finance/retail-sale-receipt-voucher/list">
                Retail Sale Receipt Voucher
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
            <BreadcrumbItem>
              <BreadcrumbPage>{voucher.rvNo}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>

      {/* Screen view */}
      <div className="p-4 md:p-6 space-y-6 max-w-6xl mx-auto print:hidden w-full">

        {/* Top Header & Actions Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" asChild>
              <Link href="/erp/finance/retail-sale-receipt-voucher/list">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back
              </Link>
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-blue-600" />
                  Retail Sale Receipt Voucher (RSRV)
                </h1>
                <Badge variant="outline" className={cn("flex items-center gap-1 py-0.5 px-2", statusCfg.cls)}>
                  <StatusIcon className="h-3.5 w-3.5" />
                  {statusCfg.label}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground font-mono mt-1">
                Voucher #: <span className="font-semibold text-slate-800">{voucher.rvNo}</span> | Date: {voucher.rvDate ? format(new Date(voucher.rvDate), "dd MMM yyyy") : "N/A"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={() => window.print()} size="sm" variant="outline" className="h-9 gap-1.5">
              <Printer className="h-4 w-4" />
              Print RSRV
            </Button>

            {statusKey !== "approved" && (
              <Button size="sm" variant="outline" className="h-9 gap-1.5" asChild>
                <Link href={`/erp/finance/retail-sale-receipt-voucher/${voucher.id}/edit`}>
                  <Pencil className="h-4 w-4 text-amber-600" />
                  Edit RSRV
                </Link>
              </Button>
            )}

            {(statusKey === "draft" || statusKey === "pending_check" || statusKey === "pending") && (
              <Button
                onClick={() => handleUpdateStatus("pending_approval")}
                size="sm"
                disabled={actionPending}
                className="h-9 gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <FileCheck className="h-4 w-4" />
                Verify & Check
              </Button>
            )}

            {statusKey !== "approved" && (
              <Button
                onClick={() => handleUpdateStatus("approved")}
                size="sm"
                disabled={actionPending}
                className="h-9 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
              >
                <CheckCircle2 className="h-4 w-4" />
                Approve RSRV
              </Button>
            )}

            {statusKey !== "rejected" && statusKey !== "approved" && (
              <Button
                onClick={() => handleUpdateStatus("rejected")}
                size="sm"
                variant="destructive"
                disabled={actionPending}
                className="h-9 gap-1.5"
              >
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
            )}

            {statusKey === "approved" && (
              <Button
                onClick={handleUnapprove}
                size="sm"
                variant="outline"
                disabled={actionPending}
                className="h-9 gap-1.5 border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/20"
              >
                <RotateCcw className="h-4 w-4" />
                Unapprove & Unpost
              </Button>
            )}

            {statusKey === "rejected" && (
              <Button
                onClick={() => handleUpdateStatus("draft")}
                size="sm"
                variant="secondary"
                disabled={actionPending}
                className="h-9 gap-1.5"
              >
                <RotateCcw className="h-4 w-4" />
                Re-open / Set to Draft
              </Button>
            )}
          </div>
        </div>

        {/* Summary Meta Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2 border-b bg-gray-50/50">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-blue-600" />
                Voucher Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Voucher Number:</span>
                <span className="font-mono font-bold text-slate-800">{voucher.rvNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Folio Number:</span>
                <span className="font-mono font-medium">{voucher.folio || folio(voucher.id)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Voucher Date:</span>
                <span className="font-medium">{voucher.rvDate ? format(new Date(voucher.rvDate), "dd/MM/yyyy") : "—"}</span>
              </div>
              {voucher.refBillNo && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ref Bill #:</span>
                  <span className="font-medium">{voucher.refBillNo}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2 border-b bg-gray-50/50">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Store className="w-4 h-4 text-emerald-600" />
                Outlet / Location Tag
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Outlet Code:</span>
                <span className="font-mono font-bold text-emerald-700">{outletCode || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Outlet Name:</span>
                <span className="font-semibold text-slate-800">{outletName || "Default Outlet"}</span>
              </div>
              {voucher.debitAccountName && (
                <div className="flex justify-between pt-1 border-t">
                  <span className="text-muted-foreground">Debit Account:</span>
                  <span className="font-medium text-blue-700">{voucher.debitAccountCode ? `[${voucher.debitAccountCode}] ` : ""}{voucher.debitAccountName}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white">
            <CardHeader className="pb-2 border-b border-slate-700">
              <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Financial Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-3 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Debit:</span>
                <span className="font-mono font-bold text-emerald-400">PKR {fmt(totalDebit)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Total Credit:</span>
                <span className="font-mono font-bold text-emerald-400">PKR {fmt(totalCredit)}</span>
              </div>
              <div className="pt-2 border-t border-slate-700">
                <span className="text-[10px] text-slate-400 uppercase tracking-wider block mb-0.5">Amount in Words:</span>
                <span className="text-xs italic text-slate-200 leading-snug block">{numberToWords(totalDebit)}</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Voucher Detail Lines Table */}
        <Card>
          <CardHeader className="pb-3 border-b bg-gray-50/50">
            <CardTitle className="text-sm font-bold flex items-center justify-between">
              <span>Account Breakdown & Detail Entries</span>
              <span className="text-xs font-normal text-muted-foreground">
                {voucher.details?.length || 0} Line item(s)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b">
                  <tr>
                    <th className="py-2.5 px-4">Account Code & Name</th>
                    <th className="py-2.5 px-4">Outlet / Tag Account</th>
                    <th className="py-2.5 px-4">Narration / Description</th>
                    <th className="py-2.5 px-4 text-right">Debit (PKR)</th>
                    <th className="py-2.5 px-4 text-right">Credit (PKR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {debitRows.map((d, i) => (
                    <tr key={`dr-${i}`} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 align-top">
                        <span className="font-mono font-bold text-blue-700 mr-2">[{d.accountCode}]</span>
                        <span className="font-semibold text-slate-800">{d.accountName}</span>
                      </td>
                      <td className="py-3 px-4 align-top">
                        {d.tagAccountCode || d.tagAccountName ? (
                          <div className="flex items-center gap-1 text-slate-700">
                            <Store className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span className="font-mono font-medium">[{d.tagAccountCode}]</span>
                            <span>{d.tagAccountName}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 align-top text-slate-600">
                        {d.narration || voucher.description || "No description"}
                      </td>
                      <td className="py-3 px-4 align-top text-right font-mono font-semibold text-slate-900">
                        {fmt(Number(d.debit))}
                      </td>
                      <td className="py-3 px-4 align-top text-right font-mono text-muted-foreground">
                        —
                      </td>
                    </tr>
                  ))}

                  {creditRows.map((d, i) => (
                    <tr key={`cr-${i}`} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 align-top">
                        <span className="font-mono font-bold text-blue-700 mr-2">[{d.accountCode}]</span>
                        <span className="font-semibold text-slate-800">{d.accountName}</span>
                      </td>
                      <td className="py-3 px-4 align-top">
                        {d.tagAccountCode || d.tagAccountName ? (
                          <div className="flex items-center gap-1 text-slate-700">
                            <Store className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span className="font-mono font-medium">[{d.tagAccountCode}]</span>
                            <span>{d.tagAccountName}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 align-top text-slate-600">
                        {d.narration || voucher.description || "No description"}
                      </td>
                      <td className="py-3 px-4 align-top text-right font-mono text-muted-foreground">
                        —
                      </td>
                      <td className="py-3 px-4 align-top text-right font-mono font-semibold text-slate-900">
                        {fmt(Number(d.credit))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 font-bold border-t border-slate-300">
                  <tr>
                    <td colSpan={3} className="py-3 px-4 text-right uppercase tracking-wider text-slate-700">
                      Total
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-900 text-sm">
                      {fmt(totalDebit)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-900 text-sm">
                      {fmt(totalCredit)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Print preview box */}
        <Card className="mt-6 border border-gray-200">
          <CardHeader className="bg-gray-50/80 border-b py-3 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Printer className="w-4 h-4 text-blue-600" />
              Standard Print Preview
            </CardTitle>
            <Button size="sm" variant="outline" onClick={() => window.print()} className="h-7 text-xs">
              Print Now
            </Button>
          </CardHeader>
          <CardContent className="p-6 bg-slate-100/70 overflow-auto">
            <div className="bg-white p-6 rounded-lg shadow-sm border max-w-4xl mx-auto">
              <RetailSaleReceiptVoucherPrint voucher={voucher} />
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Hidden Print Section for window.print() */}
      {mounted && typeof window !== "undefined" && createPortal(
        <div id="rv-print-section" className="hidden print:block">
          <RetailSaleReceiptVoucherPrint voucher={voucher} />
        </div>,
        document.body
      )}
    </div>
  );
}
