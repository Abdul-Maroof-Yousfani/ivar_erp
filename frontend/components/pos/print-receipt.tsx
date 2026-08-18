"use client";

import { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Printer,
  Receipt,
  Loader2,
  FileSpreadsheet,
  Download,
  FileText,
} from "lucide-react";
import type { CartItem } from "@/components/pos/new-sale/cart-table";
import type { PosSettings } from "@/hooks/use-pos-settings";
import { POS_SETTINGS_DEFAULTS } from "@/hooks/use-pos-settings";
import { useAuth } from "@/components/providers/auth-provider";
import { COMPANY_NAME, cn } from "@/lib/utils";
import { printThermal } from "@/lib/utils/print";
import jsPDF from "jspdf";
import * as htmlToImage from "html-to-image";
import { toast } from "sonner";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(";").shift() || "";
  return "";
}

function fmt(val: number) {
  return val.toLocaleString("en-PK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function fmtDec(val: number) {
  return Math.round(val).toLocaleString("en-PK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function fmtDate(dateStr?: string | null): string {
  const d = dateStr ? new Date(dateStr) : new Date();
  return [
    String(d.getDate()).padStart(2, "0"),
    String(d.getMonth() + 1).padStart(2, "0"),
    d.getFullYear(),
  ].join("-");
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Tender {
  method: string;
  amount: number;
  cardLast4?: string;
  slipNo?: string;
  voucherFaceValue?: number;
}

interface PrintReceiptProps {
  order: any;
  cartItems?: CartItem[];
  tenders: Tender[];
  discountMode?: string;
  selectedPromo?: any;
  appliedCoupon?: any;
  selectedAlliance?: any;
  settings?: Partial<PosSettings>;
  isLoading?: boolean;
  creditVouchers?: {
    code: string;
    faceValue: number;
    expiresAt: Date | null;
  }[];
  onClose: () => void;
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function ReceiptSkeleton() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[400px] gap-6 select-none">
      {/* Animated receipt illustration */}
      <div className="relative flex flex-col items-center">
        {/* Glow ring */}
        <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl scale-150 animate-pulse" />

        {/* Receipt icon with spin */}
        <div className="relative z-10 flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 shadow-lg shadow-primary/10">
          <Receipt className="h-9 w-9 text-primary animate-pulse" />
        </div>

        {/* Orbiting dot */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full">
          <div
            className="absolute w-2.5 h-2.5 rounded-full bg-primary shadow-md shadow-primary/40"
            style={{
              top: "50%",
              left: "50%",
              transformOrigin: "0 0",
              animation: "orbit 1.4s linear infinite",
              marginTop: "-5px",
              marginLeft: "-5px",
            }}
          />
        </div>
      </div>

      {/* Text */}
      <div className="text-center space-y-1.5">
        <p className="text-base font-bold tracking-tight">Generating Receipt</p>
        <p className="text-sm text-muted-foreground">
          Fetching order details, please wait…
        </p>
      </div>

      {/* Skeleton lines mimicking a receipt */}
      <div className="w-64 space-y-2 opacity-40">
        <div className="h-2.5 bg-muted rounded-full w-3/4 mx-auto animate-pulse" />
        <div className="h-2 bg-muted rounded-full w-1/2 mx-auto animate-pulse delay-75" />
        <div className="h-px bg-border w-full my-3" />
        {[80, 60, 90, 55, 70].map((w, i) => (
          <div
            key={i}
            className="h-2 bg-muted rounded-full animate-pulse"
            style={{ width: `${w}%`, animationDelay: `${i * 60}ms` }}
          />
        ))}
        <div className="h-px bg-border w-full my-3" />
        <div className="h-3 bg-muted rounded-full w-2/3 mx-auto animate-pulse" />
      </div>

      <style>{`
                @keyframes orbit {
                    from { transform: rotate(0deg) translateX(44px) rotate(0deg); }
                    to   { transform: rotate(360deg) translateX(44px) rotate(-360deg); }
                }
            `}</style>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PrintReceipt({
  order,
  cartItems: propCartItems,
  tenders,
  discountMode,
  selectedPromo,
  appliedCoupon,
  selectedAlliance,
  settings: settingsOverride,
  isLoading = false,
  creditVouchers,
  onClose,
}: PrintReceiptProps) {
  const settings: PosSettings = {
    ...POS_SETTINGS_DEFAULTS,
    ...settingsOverride,
  };
  const { user } = useAuth();
  const isGiftReceipt = order?.isGiftReceipt || false;
  const [mounted, setMounted] = useState(false);

  // Default layout selection to A4 if invoice grand total >= 1,000,000 PKR
  const defaultLayout =
    (Number(order?.grandTotal ?? 0) ||
      Number(
        order?.items?.reduce(
          (acc: number, item: any) => acc + Number(item.lineTotal ?? 0),
          0,
        ) ?? 0,
      ) ||
      Number(
        propCartItems?.reduce(
          (acc, item) => acc + item.price * item.quantity,
          0,
        ) ?? 0,
      )) >= 1000000
      ? "a4"
      : "thermal";

  const [layout, setLayout] = useState<"thermal" | "a4">(defaultLayout);
  const [isDownloading, setIsDownloading] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isLoading && settings.receiptAutoPrint) {
      if (layout === "thermal") {
        const timer = setTimeout(
          () => printThermal("receipt-print-root", settings),
          400,
        );
        return () => clearTimeout(timer);
      } else {
        const timer = setTimeout(() => window.print(), 400);
        return () => clearTimeout(timer);
      }
    }
  }, [isLoading, settings.receiptAutoPrint, settings, layout]);

  const handlePrint = () => {
    if (layout === "thermal") {
      printThermal("receipt-print-root", settings);
    } else {
      window.print();
    }
  };

  const handleDownloadPdf = async () => {
    if (isLoading) return;
    setIsDownloading(true);
    const toastId = toast.loading("Generating Invoice PDF...");

    try {
      // Give time for layout updates
      await new Promise((resolve) => setTimeout(resolve, 300));

      if (reportRef.current) {
        const dataUrl = await htmlToImage.toPng(reportRef.current, {
          backgroundColor: "#ffffff",
          pixelRatio: 2,
          style: {
            position: "relative",
            left: "0",
            top: "0",
          },
        });

        const imgProps = new jsPDF().getImageProperties(dataUrl);
        const pdfWidth = layout === "thermal" ? 80 : 210;
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: [pdfWidth, pdfHeight],
        });

        pdf.addImage(dataUrl, "PNG", 0, 0, pdfWidth, pdfHeight);
        const docName = order?.orderNumber || `invoice-${Date.now()}`;
        pdf.save(`${docName}.pdf`);
        toast.success("PDF downloaded successfully", { id: toastId });
      } else {
        toast.error("Failed to capture report content", { id: toastId });
      }
    } catch (error) {
      console.error("PDF download error:", error);
      toast.error("An error occurred while downloading the PDF", {
        id: toastId,
      });
    } finally {
      setIsDownloading(false);
    }
  };

  // ── Store info ────────────────────────────────────────────────────
  const storeName =
    settings.receiptStoreName ||
    (typeof user?.terminal?.location?.name === "string"
      ? user.terminal.location.name
      : "") ||
    getCookie("companyName") ||
    "Store";

  const storeAddress =
    settings.receiptAddress ||
    (typeof user?.terminal?.location?.address === "string"
      ? user.terminal.location.address
      : "") ||
    "";
  const storePhone =
    settings.receiptPhone ||
    (typeof user?.terminal?.location?.phone === "string"
      ? user.terminal.location.phone
      : "") ||
    "";
  const companyName =
    settings.receiptCompanyName ||
    (typeof user?.terminal?.location?.fbrSellerName === "string"
      ? user.terminal.location.fbrSellerName
      : "") ||
    (typeof (user as any)?.company?.name === "string"
      ? (user as any).company.name
      : "") ||
    getCookie("companyName") ||
    "YAFEEZ & SONS (PRIVATE) LIMITED";

  const storeNTN =
    settings.receiptNTN ||
    (typeof user?.terminal?.location?.fbrNtn === "string"
      ? user.terminal.location.fbrNtn
      : "") ||
    "";
  const storeSTRN = settings.receiptSTRN || "";
  const terminalName =
    (typeof user?.terminal?.name === "string" ? user.terminal.name : "") ||
    (typeof user?.terminal?.code === "string" ? user.terminal.code : "") ||
    "";

  const cashierName =
    order?.cashierName ||
    order?.cashier?.name ||
    order?.cashierUser?.name ||
    (user ? `${user.firstName} ${user.lastName}`.trim() : "");

  // ── Normalise items ───────────────────────────────────────────────
  // Always prefer order.items (from database) over propCartItems (from cart)
  // because order.items has the final calculated values after all discounts
  const items: any[] =
    order?.items && order.items.length > 0
      ? order.items.map((oi: any) => ({
          id: oi.id,
          name: oi.item?.description || oi.item?.sku || "Item",
          sku: oi.item?.sku || "",
          upc: oi.item?.upc || oi.upc || "",
          size:
            typeof oi.item?.size === "object"
              ? oi.item?.size?.name
              : oi.item?.size || oi.size || "",
          price: Number(oi.unitPrice),
          quantity: Number(oi.quantity),
          discountPercent: Number(oi.discountPercent ?? 0),
          overrideDiscountPercent:
            oi.overrideDiscountPercent != null
              ? Number(oi.overrideDiscountPercent)
              : undefined,
          discountAmount: Number(oi.discountAmount ?? 0),
          taxPercent: Number(oi.taxPercent ?? 0),
          taxAmount: Number(oi.taxAmount ?? 0),
          lineTotal: oi.lineTotal != null ? Number(oi.lineTotal) : undefined,
        }))
      : (propCartItems ?? []);

  // ── Totals ────────────────────────────────────────────────────────
  // Subtotal should be sum of WOST (not retail price × quantity)
  // Always calculate from items, don't trust backend subtotal
  const isSavedOrder = !!(order && order.id);

  const subtotal = isSavedOrder
    ? Number(order.subtotal)
    : items.reduce((s, i) => {
        const taxDivisor = 1 + (i.taxPercent ?? 0) / 100;
        const wostPerUnit = i.price / taxDivisor;
        return s + wostPerUnit * i.quantity;
      }, 0);

  const itemDiscountsRaw = items.reduce(
    (s, i) => s + (i.discountAmount ?? 0),
    0,
  );
  const orderDiscount = Number(order?.globalDiscountAmount ?? 0);

  // Order-level discount suppression logic: if alliance OR manual discount is active and >= item discounts, item discounts are zeroed
  // and the order discount is distributed proportionally across items
  const isAlliance =
    discountMode === "alliance" || !!order?.alliance || !!order?.allianceId;
  const isManualDiscount =
    discountMode === "manual" ||
    (!isAlliance && !order?.promo && !order?.coupon && orderDiscount > 0);
  const suppressItemDiscounts =
    (isAlliance || isManualDiscount) &&
    Math.round(orderDiscount) >= Math.round(itemDiscountsRaw) &&
    orderDiscount > 0;
  const suppressLabel = isAlliance ? "Alliance Disc" : "Manual Disc";

  // Always calculate totalTax from items (don't trust backend taxAmount)
  // using the exact same logic as printed per-item sales tax
  const totalTax = isSavedOrder
    ? Number(order.taxAmount)
    : items.reduce((s, i) => {
        const taxPct = i.taxPercent ?? 0;
        const taxDivisor = 1 + taxPct / 100;
        const wostPerUnit = i.price / taxDivisor;
        const totalWost = wostPerUnit * i.quantity;

        const itemDiscPct = i.overrideDiscountPercent ?? i.discountPercent ?? 0;
        const rawDisc = totalWost * (itemDiscPct / 100);

        const disc = suppressItemDiscounts ? 0 : rawDisc;
        let displayDisc = disc;

        if (suppressItemDiscounts && subtotal > 0) {
          displayDisc = Math.min(
            (orderDiscount * totalWost) / subtotal,
            totalWost,
          );
        }

        const amtAfterDisc =
          totalWost - (suppressItemDiscounts ? displayDisc : disc);
        const tax = amtAfterDisc * (taxPct / 100);
        return s + tax;
      }, 0);

  const totalDiscount = isSavedOrder
    ? Number(order.discountAmount)
    : (suppressItemDiscounts ? 0 : itemDiscountsRaw) + orderDiscount;

  const valueForSales = subtotal - totalDiscount;
  const grandTotal = isSavedOrder
    ? Number(order.grandTotal)
    : valueForSales + totalTax;

  const hasFbrInfo = !!(
    (user?.terminal?.location?.fbrEnabled &&
      (user?.terminal?.location?.fbrNtn || settings.receiptNTN)) ||
    order?.fbrInvoiceNumber
  );

  const fbrPosFee = hasFbrInfo ? Number(order?.fbrPosFee ?? 0) || 1 : 0;
  const finalGrandTotal = isSavedOrder ? grandTotal : grandTotal + fbrPosFee;
  const changeAmount = Number(order?.changeAmount ?? 0);
  const totalPaid = tenders.reduce(
    (s, t) =>
      s +
      (t.method === "voucher" && t.voucherFaceValue
        ? t.voucherFaceValue
        : t.amount),
    0,
  );

  // Alliance distribution for display - proportional to item value
  const calculateProportionalDiscount = (
    itemValue: number,
    totalValue: number,
    totalDiscount: number,
  ): number => {
    if (totalValue === 0) return 0;
    return Math.round((totalDiscount * itemValue) / totalValue);
  };

  const orderDiscountLabel = (() => {
    if (discountMode === "promo")
      return `Promo: ${selectedPromo?.code ?? order?.promo?.code ?? ""}`;
    if (discountMode === "coupon")
      return `Coupon: ${appliedCoupon?.code ?? order?.coupon?.code ?? ""}`;
    if (discountMode === "alliance")
      return `Alliance: ${selectedAlliance?.code ?? order?.alliance?.code ?? ""}`;
    if (discountMode === "manual") return "Manual Discount";
    if (order?.promo?.code) return `Promo: ${order.promo.code}`;
    if (order?.coupon?.code) return `Coupon: ${order.coupon.code}`;
    if (order?.alliance?.code) return `Alliance: ${order.alliance.code}`;
    return "Order Discount";
  })();

  const fbrInvoiceNum = order?.fbrInvoiceNumber || "";
  const fbrVerifyUrl =
    order?.fbrQrCode ||
    order?.fbrInvoiceUrl ||
    (fbrInvoiceNum
      ? `https://taxasaan.fbr.gov.pk/verify?inv=${encodeURIComponent(fbrInvoiceNum)}`
      : `https://taxasaan.fbr.gov.pk/verify?inv=${encodeURIComponent(order?.orderNumber ?? "")}`);

  const bodyProps: ReceiptBodyProps = {
    isGiftReceipt,
    storeName,
    companyName,
    storeAddress,
    storePhone,
    storeNTN,
    storeSTRN,
    terminalName,
    cashierName,
    order,
    items,
    subtotal,
    totalTax,
    orderDiscount,
    totalDiscount,
    valueForSales,
    grandTotal,
    fbrPosFee,
    finalGrandTotal,
    changeAmount,
    totalPaid,
    tenders,
    orderDiscountLabel,
    fbrVerifyUrl,
    settings,
    suppressItemDiscounts,
    suppressLabel,
    creditVouchers,
    hasFbrInfo,
  };

  return (
    <>
      <style>{`
                /* Ensure print root and its descendants are rendered in solid black and white for standard/PDF rendering */
                #receipt-print-root,
                #receipt-print-root * {
                    color: #000 !important;
                    border-color: #000 !important;
                }

                @media print {
                    body *:not(#receipt-print-root):not(#receipt-print-root *) {
                        visibility: hidden !important;
                        height: 0 !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        border: none !important;
                    }

                    #receipt-print-root,
                    #receipt-print-root * {
                        visibility: visible !important;
                        color: #000 !important;
                        border-color: #000 !important;
                    }

                    #receipt-print-root {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: ${layout === "thermal" ? "72.1mm" : "100%"} !important;
                        max-width: ${layout === "thermal" ? "72.1mm" : "210mm"} !important;
                        padding: ${layout === "thermal" ? "2mm 1mm" : "12mm"} !important;
                        background: #fff !important;
                        color: #000 !important;
                        font-family: ${layout === "thermal" ? "'Courier New', Courier, monospace" : "inherit"} !important;
                        font-size: ${layout === "thermal" ? "9pt" : "10.5pt"} !important;
                        line-height: 1.35 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    #receipt-print-root .rpt-grid-hdr span,
                    #receipt-print-root .rpt-grid-item span:not(:first-child),
                    #receipt-print-root .rpt-grid-hdr-g span,
                    #receipt-print-root .rpt-grid-gift span:not(:first-child) {
                        white-space: nowrap !important;
                    }

                    @page {
                        margin: ${layout === "thermal" ? "0" : "15mm"};
                        size: ${layout === "thermal" ? "80mm auto" : "A4 portrait"};
                    }
                    #receipt-print-root > div > * { page-break-inside: avoid; break-inside: avoid; }
                    tr {
                        page-break-inside: avoid;
                        break-inside: avoid;
                    }
                }
            `}</style>

      {/* ── Screen: dialog preview ────────────────────────────────── */}
      <Dialog open onOpenChange={onClose}>
        <DialogContent
          className={cn(
            "h-[92vh] flex flex-col p-0 gap-0 transition-all duration-300",
            layout === "thermal" ? "max-w-2xl w-full" : "max-w-5xl w-full",
          )}
        >
          <DialogHeader className="px-5 pt-4 pb-3 border-b shrink-0 flex flex-row items-center gap-4">
            <div className="flex items-center gap-2">
              {isLoading && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
              <DialogTitle className="flex items-center gap-2 text-base font-bold">
                <FileText className="w-5 h-5 text-primary" />
                Receipt Preview
              </DialogTitle>
            </div>

            {/* Format Switcher */}
            {!isLoading && (
              <div className="flex items-center gap-1 bg-muted p-1 rounded-full border ml-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLayout("thermal")}
                  className={cn(
                    "rounded-full h-7 px-3 text-xs font-semibold gap-1 transition-all",
                    layout === "thermal"
                      ? "bg-background shadow text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Receipt className="w-3.5 h-3.5" />
                  Thermal (80mm)
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLayout("a4")}
                  className={cn(
                    "rounded-full h-7 px-3 text-xs font-semibold gap-1 transition-all",
                    layout === "a4"
                      ? "bg-background shadow text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  A4 Premium
                </Button>
              </div>
            )}
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-4 py-4 bg-muted/20 dark:bg-zinc-950/20 shadow-inner flex justify-center">
            {isLoading ? (
              <ReceiptSkeleton />
            ) : (
              <div
                className={
                  layout === "thermal"
                    ? "w-[320px] bg-white border shadow-md p-4 rounded-md h-fit"
                    : "w-full max-w-[210mm] h-fit shadow-lg border rounded-sm overflow-hidden bg-white"
                }
              >
                {layout === "thermal" ? (
                  <ReceiptBody {...bodyProps} />
                ) : (
                  <A4InvoiceBody {...bodyProps} />
                )}
              </div>
            )}
          </div>

          <DialogFooter className="px-5 py-3 border-t shrink-0 gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Close
            </Button>
            <Button
              onClick={handleDownloadPdf}
              variant="outline"
              className="flex-1 gap-2 border-zinc-300 text-zinc-700 hover:bg-zinc-100"
              disabled={isLoading || isDownloading}
            >
              {isDownloading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />{" "}
                  Generating PDF…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" /> Download PDF
                </>
              )}
            </Button>
            <Button
              onClick={handlePrint}
              className="flex-1 gap-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Preparing…
                </>
              ) : (
                <>
                  <Printer className="h-4 w-4" /> Print Invoice
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Print target — off-screen but rendered, visible only on print ── */}
      {!isLoading &&
        mounted &&
        createPortal(
          <div
            id="receipt-print-root"
            ref={reportRef}
            style={{
              position: "fixed",
              left: "-9999px",
              top: 0,
              width: layout === "thermal" ? "72.1mm" : "100%",
              maxWidth: layout === "thermal" ? "72.1mm" : "210mm",
              pointerEvents: "none",
            }}
            aria-hidden="true"
          >
            {layout === "thermal" ? (
              <ReceiptBody {...bodyProps} />
            ) : (
              <A4InvoiceBody {...bodyProps} />
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

// ── ReceiptBody ───────────────────────────────────────────────────────────────

interface ReceiptBodyProps {
  isGiftReceipt: boolean;
  storeName: string;
  companyName?: string;
  storeAddress: string;
  storePhone: string;
  storeNTN: string;
  storeSTRN: string;
  terminalName: string;
  cashierName: string;
  order: any;
  items: any[];
  subtotal: number;
  totalTax: number;
  orderDiscount: number;
  totalDiscount: number;
  valueForSales: number;
  grandTotal: number;
  fbrPosFee: number;
  finalGrandTotal: number;
  changeAmount: number;
  totalPaid: number;
  tenders: Tender[];
  orderDiscountLabel: string;
  fbrVerifyUrl: string;
  settings: PosSettings;
  suppressItemDiscounts: boolean;
  suppressLabel?: string;
  creditVouchers?: {
    code: string;
    faceValue: number;
    expiresAt: Date | null;
  }[];
  hasFbrInfo?: boolean;
}

function ReceiptBody({
  isGiftReceipt,
  storeName,
  companyName,
  storeAddress,
  storePhone,
  storeNTN,
  storeSTRN,
  terminalName,
  cashierName,
  order,
  items,
  subtotal,
  totalTax,
  orderDiscount,
  totalDiscount,
  valueForSales,
  grandTotal,
  fbrPosFee,
  finalGrandTotal,
  changeAmount,
  totalPaid,
  tenders,
  orderDiscountLabel,
  fbrVerifyUrl,
  settings,
  suppressItemDiscounts,
  suppressLabel = "Alliance Disc",
  creditVouchers,
  hasFbrInfo,
}: ReceiptBodyProps) {
  const isSavedOrder = !!(order && order.id);

  // Calculate total WOST value for proportional discount
  const totalWostValue = items.reduce((sum, item) => {
    const taxPct = item.taxPercent ?? 0;
    const taxDivisor = 1 + taxPct / 100;
    // Retail price is item.price (not adding tax)
    const retailPrice = item.price;
    const wostPerUnit = retailPrice / taxDivisor;
    return sum + wostPerUnit * item.quantity;
  }, 0);

  // Proportional discount calculation for alliance/coupon
  const calculateProportionalDiscount = (
    itemValue: number,
    totalValue: number,
    totalDiscount: number,
  ): number => {
    if (totalValue === 0) return 0;
    const proportionalDisc = Math.round(
      (totalDiscount * itemValue) / totalValue,
    );
    // Safety: discount cannot exceed item value
    return Math.min(proportionalDisc, itemValue);
  };

  const Row = ({
    label,
    value,
    bold = false,
    indent = false,
  }: {
    label: string;
    value: string;
    bold?: boolean;
    indent?: boolean;
  }) => (
    <div
      className="rpt-flex flex justify-between text-[11px]"
      style={{
        paddingLeft: indent ? "12px" : undefined,
        fontWeight: bold ? "bold" : undefined,
      }}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );

  return (
    <div
      className="font-mono text-[10px] w-full max-w-[72.1mm] mx-auto"
      style={{ lineHeight: 1.25 }}
    >
      {/* ── Store Header ── */}
      <div className="text-center pb-1 border-b border-zinc-400">
        <div className="flex justify-center mb-1.5">
          <Image
            src={
              typeof window !== "undefined"
                ? `${window.location.origin}/image-v2.png`
                : "/image-v2.png"
            }
            alt="Store Logo"
            width={120}
            height={40}
            className="object-contain"
            unoptimized
            priority
          />
        </div>
        <p className="font-black text-[13px] leading-tight uppercase tracking-wide">
          {storeName}
        </p>
        {(storeAddress || storePhone) && (
          <p className="text-[9px] leading-snug">
            {storeAddress}
            {storeAddress && storePhone ? " | " : ""}
            {storePhone}
          </p>
        )}
        {companyName && (
          <p className="text-[9.5px] font-bold uppercase tracking-wide leading-tight mt-0.5">
            {companyName}
          </p>
        )}
        {storeNTN && (
          <p className="text-[9px]">
            NTN: {storeNTN}
            {storeSTRN ? ` | STRN: ${storeSTRN}` : ""}
          </p>
        )}
      </div>

      {/* ── Invoice Title + Meta ── */}
      <div className="py-1 border-b border-dashed border-zinc-400">
        <p className="text-center font-bold text-[10px] uppercase tracking-widest">
          {isGiftReceipt ? "Gift Receipt" : "Sales Tax Invoice"}
        </p>
        <p className="text-center font-black text-[15px] tracking-wider leading-tight">
          {order?.orderNumber ?? ""}
        </p>
        <div className="mt-0.5 space-y-0 text-[9px]">
          <Row label="Date" value={fmtDate(order?.createdAt)} />
          {cashierName && <Row label="Sales By" value={cashierName} />}
          {terminalName && <Row label="Terminal" value={terminalName} />}
          <Row
            label="Customer"
            value={
              order?.customer?.name || order?.customerName || "Walk-in Customer"
            }
            bold
          />
          {(order?.customer?.phone ||
            order?.customerPhone ||
            order?.customerMobile) &&
            (order?.customer?.phone ||
              order?.customerPhone ||
              order?.customerMobile) !== "N/A" && (
              <Row
                label="Phone"
                value={
                  order?.customer?.phone ||
                  order?.customerPhone ||
                  order?.customerMobile
                }
              />
            )}
        </div>
      </div>

      {/* ── Column headers ── */}
      {!isGiftReceipt ? (
        <div
          className="rpt-grid-hdr text-[9px] font-bold border-b border-zinc-400 py-0.5"
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 0.5fr 0.4fr 0.8fr 0.8fr",
            gap: "0 3px",
          }}
        >
          <span>Item / SKU</span>
          <span style={{ textAlign: "center" }}>Sz</span>
          <span style={{ textAlign: "center" }}>Qty</span>
          <span style={{ textAlign: "right" }}>WOST</span>
          <span style={{ textAlign: "right" }}>Net</span>
        </div>
      ) : (
        <div
          className="rpt-grid-hdr-g text-[9px] font-bold border-b border-zinc-400 py-0.5"
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 0.5fr 0.5fr",
            gap: "0 3px",
          }}
        >
          <span>Item / SKU</span>
          <span style={{ textAlign: "center" }}>Sz</span>
          <span style={{ textAlign: "center" }}>Qty</span>
        </div>
      )}

      {/* ── Item lines ── */}
      {items.map((item: any, idx: number) => {
        const taxPct = item.taxPercent ?? 0;
        const taxDivisor = 1 + taxPct / 100; // e.g., 1.18 for 18%, 1.25 for 25%

        // Step 1: Retail price is the unit price (item.price)
        const retailPrice = item.price;

        // Step 2: WOST = Retail / (1 + tax%) - this removes the tax to get the base price
        const wostPerUnit = retailPrice / taxDivisor;
        const totalWost = wostPerUnit * item.quantity;

        let displayDisc = 0;
        let displayDiscPct = 0;
        let amtAfterDisc = 0;
        let tax = 0;
        let valueIncludingTax = 0;

        if (isSavedOrder) {
          displayDisc = item.discountAmount ?? 0;
          displayDiscPct = item.discountPercent ?? 0;
          amtAfterDisc = totalWost - displayDisc;
          tax = item.taxAmount ?? 0;
          valueIncludingTax = item.lineTotal ?? amtAfterDisc + tax;
        } else {
          // Step 3: Discount % from item (use override if present)
          const itemDiscPct =
            item.overrideDiscountPercent ?? item.discountPercent ?? 0;
          // Discount Amount = Total WOST × Discount %
          const rawDisc = totalWost * (itemDiscPct / 100);

          // If alliance/coupon suppressed item discount, calculate proportional discount
          let disc = suppressItemDiscounts ? 0 : rawDisc;
          displayDisc = disc;
          displayDiscPct = suppressItemDiscounts ? 0 : itemDiscPct;

          if (suppressItemDiscounts) {
            // Proportional discount: (orderDiscount × itemWOST) / totalWOST
            displayDisc = calculateProportionalDiscount(
              totalWost,
              totalWostValue,
              orderDiscount,
            );
            displayDiscPct =
              totalWost > 0
                ? Math.round((displayDisc / totalWost) * 100 * 100) / 100
                : 0;
          }

          // Step 4: Amount after Discount
          amtAfterDisc =
            totalWost - (suppressItemDiscounts ? displayDisc : disc);

          // Step 5: Tax = Amount after Discount × tax%
          tax = amtAfterDisc * (taxPct / 100);

          // Step 6: Value Including Tax
          valueIncludingTax = amtAfterDisc + tax;
        }

        const uniqueNo = item.sku || item.upc || "—";

        return (
          <div
            key={item.id ?? idx}
            className="border-b border-dashed border-zinc-300 py-0.5"
          >
            <p className="font-bold text-[10px] leading-tight">{item.name}</p>

            {!isGiftReceipt ? (
              <div
                className="rpt-grid-item text-[9px]"
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 0.5fr 0.4fr 0.8fr 0.8fr",
                  gap: "0 3px",
                }}
              >
                <span className="truncate text-zinc-600">{uniqueNo}</span>
                <span style={{ textAlign: "center" }}>{item.size || "—"}</span>
                <span style={{ textAlign: "center", fontWeight: "bold" }}>
                  {item.quantity}
                </span>
                <span style={{ textAlign: "right" }}>
                  {fmtDec(wostPerUnit)}
                </span>
                <span style={{ textAlign: "right", fontWeight: "bold" }}>
                  {fmtDec(valueIncludingTax)}
                </span>
              </div>
            ) : (
              <div
                className="rpt-grid-gift text-[9px]"
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 0.5fr 0.5fr",
                  gap: "0 3px",
                }}
              >
                <span className="truncate text-zinc-600">{uniqueNo}</span>
                <span style={{ textAlign: "center" }}>{item.size || "—"}</span>
                <span style={{ textAlign: "center", fontWeight: "bold" }}>
                  {item.quantity}
                </span>
              </div>
            )}

            {!isGiftReceipt && (displayDisc > 0 || taxPct > 0) && (
              <p className="text-[9px] text-zinc-500 leading-tight">
                {displayDisc > 0 &&
                  `${suppressItemDiscounts ? suppressLabel : "Disc"}: -${fmtDec(displayDisc)}`}
                {displayDisc > 0 && taxPct > 0 && " | "}
                {taxPct > 0 && `Tax ${taxPct}%: +${fmtDec(tax)}`}
              </p>
            )}
          </div>
        );
      })}

      {/* ── Summary totals ── */}
      {!isGiftReceipt ? (
        <div className="py-1 border-b border-zinc-400 space-y-0 text-[9px]">
          <Row
            label={`Subtotal Excl. Tax (${items.length})`}
            value={fmt(Math.round(subtotal))}
          />
          {totalDiscount > 0 && (
            <Row
              label="Total Discount"
              value={`-${fmt(Math.round(totalDiscount))}`}
            />
          )}
          <Row label="Value for Sales" value={fmt(Math.round(valueForSales))} />
          {settings.receiptShowTax && (
            <Row label="Sales Tax" value={fmt(Math.round(totalTax))} />
          )}
          <Row
            label="Total Incl. Tax"
            value={fmt(Math.round(finalGrandTotal - fbrPosFee))}
            bold
          />
          {hasFbrInfo && fbrPosFee > 0 && (
            <Row label="FBR POS Fee" value={fmt(Math.round(fbrPosFee))} />
          )}
          <Row
            label="GRAND TOTAL"
            value={fmt(Math.round(finalGrandTotal))}
            bold
          />
        </div>
      ) : (
        <p className="text-center text-[9px] py-1 border-b border-zinc-400">
          Price info omitted — gift receipt.
        </p>
      )}

      {/* ── Payment ── */}
      {!isGiftReceipt && (
        <div className="py-1 border-b border-dashed border-zinc-400 space-y-0 text-[9px]">
          {tenders.map((t, i) => (
            <Row
              key={i}
              label={`${t.method.replace(/_/g, " ")}${t.cardLast4 ? ` ••••${t.cardLast4}` : ""}${t.slipNo ? (t.method === "voucher" ? ` #${t.slipNo}` : ` (${t.slipNo})`) : ""}`}
              value={
                t.method === "voucher" && t.voucherFaceValue
                  ? fmt(t.voucherFaceValue)
                  : fmt(t.amount)
              }
            />
          ))}
          {totalPaid > 0 && totalPaid !== finalGrandTotal && (
            <Row label="Total Paid" value={fmt(totalPaid)} />
          )}
          {changeAmount > 0 && (
            <Row label="Change" value={fmt(changeAmount)} bold />
          )}
        </div>
      )}

      {/* ── Credit Vouchers ── */}
      {creditVouchers && creditVouchers.length > 0 && (
        <div className="py-1 border-b border-dashed border-zinc-400 text-[9px] text-center space-y-0.5">
          <p className="font-bold uppercase tracking-wide">
            Credit Voucher Issued
          </p>
          {creditVouchers.map((voucher, idx) => (
            <div key={idx}>
              <p className="font-black text-[13px] tracking-widest">
                {voucher.code}
              </p>
              <p>
                Rs. {fmt(Number(voucher.faceValue))}
                {voucher.expiresAt
                  ? ` · Exp: ${new Date(voucher.expiresAt).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" })}`
                  : ""}
              </p>
            </div>
          ))}
          <p className="text-[8px]">Use on next purchase</p>
        </div>
      )}

      {/* ── FBR QR ── */}
      {!isGiftReceipt && hasFbrInfo && (
        <div className="py-1 border-b border-dashed border-zinc-400 flex items-center gap-2">
          <div style={{ flexShrink: 0 }}>
            <Image
              src={
                typeof window !== "undefined"
                  ? `${window.location.origin}/fbr_pos.png`
                  : "/fbr_pos.png"
              }
              alt="FBR"
              width={36}
              height={36}
              className="object-contain"
              unoptimized
            />
          </div>
          <div className="flex-1 text-left">
            <p className="text-[8px] leading-tight">
              Verified by FBR POS. SMS <strong>9966</strong> to verify &amp; win
              prizes.
            </p>
            {order?.fbrInvoiceNumber && (
              <p className="text-[8px] font-mono font-bold text-black mt-0.5">
                FBR Inv #: {order.fbrInvoiceNumber}
              </p>
            )}
          </div>
          <div style={{ flexShrink: 0, textAlign: "center" }}>
            <QRCodeSVG value={fbrVerifyUrl} size={44} level="M" />
            <p className="text-[7px]">Scan</p>
          </div>
        </div>
      )}

      {/* ── Terms ── */}
      <div className="py-1 border-b border-dashed border-zinc-400 text-[8px] leading-snug">
        <p className="font-bold text-[9px] uppercase">Exchange &amp; Refund Policy</p>
        <ul className="list-disc pl-3 space-y-0.5 mt-0.5">
          <li>Exchange is allowed within 15 days of the purchase date with the original invoice and tags attached.</li>
          <li>Refunds are only applicable for items confirmed by the company to have a manufacturing defect. Approved refunds will be processed within 15 working days.</li>
          <li>Items that are used, washed, altered, damaged, or without original tags/invoice are not eligible for exchange or refund.</li>
          <li>Only one exchange is allowed per purchase. Exchanged items cannot be exchanged again.</li>
          <li>Sale, promotional, and discounted items are not eligible for exchange or refund unless a manufacturing defect is confirmed.</li>
          <li>The company's quality inspection and final decision regarding exchange or refund shall be final.</li>
        </ul>
      </div>

      {/* ── Footer ── */}
      <div className="text-center text-[9px] pt-1 pb-1 space-y-0">
        <p>{settings.receiptFooter || "*** THANK YOU FOR SHOPPING ***"}</p>
        <p className="tracking-widest font-bold">{order?.orderNumber}</p>
      </div>
    </div>
  );
}

function A4InvoiceBody({
  isGiftReceipt,
  storeName,
  companyName,
  storeAddress,
  storePhone,
  storeNTN,
  storeSTRN,
  terminalName,
  cashierName,
  order,
  items,
  subtotal,
  totalTax,
  orderDiscount,
  totalDiscount,
  valueForSales,
  grandTotal,
  fbrPosFee,
  finalGrandTotal,
  changeAmount,
  totalPaid,
  tenders,
  orderDiscountLabel,
  fbrVerifyUrl,
  settings,
  suppressItemDiscounts,
  suppressLabel = "Alliance Disc",
  creditVouchers,
  hasFbrInfo,
}: ReceiptBodyProps) {
  const isSavedOrder = !!(order && order.id);

  // Normalize customer details
  const customerName =
    order?.customer?.name || order?.customerName || "Walk-in Customer";
  const customerPhone =
    order?.customer?.phone ||
    order?.customerPhone ||
    order?.customerMobile ||
    "N/A";
  const customerEmail = order?.customer?.email || order?.customerEmail || "";
  const customerAddress =
    order?.customer?.address || order?.customerAddress || "";

  // Calculate total WOST value for proportional discount
  const totalWostValue = items.reduce((sum, item) => {
    const taxPct = item.taxPercent ?? 0;
    const taxDivisor = 1 + taxPct / 100;
    const retailPrice = item.price;
    const wostPerUnit = retailPrice / taxDivisor;
    return sum + wostPerUnit * item.quantity;
  }, 0);

  const calculateProportionalDiscount = (
    itemValue: number,
    totalValue: number,
    totalDiscount: number,
  ): number => {
    if (totalValue === 0) return 0;
    const proportionalDisc = Math.round(
      (totalDiscount * itemValue) / totalValue,
    );
    return Math.min(proportionalDisc, itemValue);
  };

  return (
    <div className="font-sans text-[11px] text-zinc-900 w-full max-w-[210mm] mx-auto p-10 bg-white flex flex-col justify-between min-h-[297mm]">
      {/* Top Header Section */}
      <div>
        <div className="flex justify-between items-start border-b-2 border-zinc-800 pb-5 mb-6">
          <div className="space-y-1">
            <h1 className="text-xl font-extrabold tracking-tight uppercase text-zinc-900">
              {storeName}
            </h1>
            <p className="text-xs text-zinc-650 max-w-md leading-relaxed">
              {storeAddress}
            </p>
            <div className="text-[10px] text-zinc-550 space-y-0.5 pt-1">
              {storePhone && <p>Phone: {storePhone}</p>}
              {companyName && <p className="font-semibold text-zinc-800 uppercase">{companyName}</p>}
              {storeNTN && <p>NTN: {storeNTN}</p>}
              {storeSTRN && <p>STRN: {storeSTRN}</p>}
            </div>
          </div>

          <div className="text-right space-y-1.5">
            <h2 className="text-lg font-black tracking-widest text-zinc-850 uppercase">
              {isGiftReceipt ? "GIFT RECEIPT" : "TAX INVOICE"}
            </h2>
            <div className="text-xs font-mono bg-zinc-100 px-3 py-1 rounded text-zinc-800 font-bold inline-block border border-zinc-200">
              #{order?.orderNumber ?? ""}
            </div>
            <div className="text-[10px] text-zinc-500 space-y-0.5 pt-1">
              <p>
                <span className="font-semibold text-zinc-700">Date:</span>{" "}
                {fmtDate(order?.createdAt)}
              </p>
              {cashierName && (
                <p>
                  <span className="font-semibold text-zinc-700">Salesman:</span>{" "}
                  {cashierName}
                </p>
              )}
              {terminalName && (
                <p>
                  <span className="font-semibold text-zinc-700">Terminal:</span>{" "}
                  {terminalName}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Customer Information Section */}
        <div className="mb-6 bg-zinc-50 border border-zinc-200 rounded-lg p-4 grid grid-cols-2 gap-4">
          <div>
            <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
              Customer Details (Bill To)
            </h3>
            <p className="font-bold text-xs text-zinc-800">{customerName}</p>
            {customerPhone && customerPhone !== "N/A" && (
              <p className="text-zinc-650">Phone: {customerPhone}</p>
            )}
            {customerEmail && (
              <p className="text-zinc-655">Email: {customerEmail}</p>
            )}
          </div>
          {customerAddress && (
            <div>
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                Billing Address
              </h3>
              <p className="text-zinc-650 leading-relaxed">{customerAddress}</p>
            </div>
          )}
        </div>

        {/* Items Table */}
        <table className="w-full text-left text-[11px] leading-normal border-collapse mb-8">
          <thead>
            <tr className="border-b border-zinc-800 text-[10px] font-extrabold uppercase text-zinc-700 tracking-wider">
              <th className="py-2.5 px-2 w-[5%]">S.No</th>
              <th className="py-2.5 px-2 w-[40%]">Item Description</th>
              <th className="py-2.5 px-2 text-center w-[8%]">Size</th>
              <th className="py-2.5 px-2 text-center w-[8%]">Qty</th>
              {!isGiftReceipt && (
                <>
                  <th className="py-2.5 px-2 text-right w-[11%]">Retail</th>
                  <th className="py-2.5 px-2 text-right w-[11%]">WOST</th>
                  <th className="py-2.5 px-2 text-right w-[11%]">Tax %</th>
                  <th className="py-2.5 px-2 text-right w-[11%]">Total</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {items.map((item: any, idx: number) => {
              const taxPct = item.taxPercent ?? 0;
              const taxDivisor = 1 + taxPct / 100;
              const retailPrice = item.price;
              const wostPerUnit = retailPrice / taxDivisor;
              const totalWost = wostPerUnit * item.quantity;

              let displayDisc = 0;
              let displayDiscPct = 0;
              let amtAfterDisc = 0;
              let tax = 0;
              let valueIncludingTax = 0;

              if (isSavedOrder) {
                displayDisc = item.discountAmount ?? 0;
                displayDiscPct = item.discountPercent ?? 0;
                amtAfterDisc = totalWost - displayDisc;
                tax = item.taxAmount ?? 0;
                valueIncludingTax = item.lineTotal ?? amtAfterDisc + tax;
              } else {
                const itemDiscPct =
                  item.overrideDiscountPercent ?? item.discountPercent ?? 0;
                const rawDisc = totalWost * (itemDiscPct / 100);

                let disc = suppressItemDiscounts ? 0 : rawDisc;
                displayDisc = disc;
                displayDiscPct = suppressItemDiscounts ? 0 : itemDiscPct;

                if (suppressItemDiscounts) {
                  displayDisc = calculateProportionalDiscount(
                    totalWost,
                    totalWostValue,
                    orderDiscount,
                  );
                  displayDiscPct =
                    totalWost > 0
                      ? Math.round((displayDisc / totalWost) * 100 * 100) / 100
                      : 0;
                }

                amtAfterDisc =
                  totalWost - (suppressItemDiscounts ? displayDisc : disc);
                tax = amtAfterDisc * (taxPct / 100);
                valueIncludingTax = amtAfterDisc + tax;
              }

              const uniqueNo = item.sku || item.upc || "—";

              return (
                <tr key={item.id ?? idx} className="hover:bg-zinc-50/50">
                  <td className="py-2 px-2 text-zinc-500 font-mono">
                    {idx + 1}
                  </td>
                  <td className="py-2 px-2">
                    <div className="font-bold text-zinc-800">{item.name}</div>
                    <div className="text-[10px] text-zinc-500 font-mono">
                      {uniqueNo}
                    </div>
                  </td>
                  <td className="py-2 px-2 text-center text-zinc-700">
                    {item.size || "—"}
                  </td>
                  <td className="py-2 px-2 text-center font-bold text-zinc-800">
                    {item.quantity}
                  </td>
                  {!isGiftReceipt && (
                    <>
                      <td className="py-2 px-2 text-right font-mono text-zinc-600">
                        {fmtDec(retailPrice)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-zinc-600">
                        {fmtDec(wostPerUnit)}
                      </td>
                      <td className="py-2 px-2 text-right font-mono text-zinc-650">
                        {taxPct}%
                        {displayDisc > 0 && (
                          <div className="text-[9px] text-green-600 font-medium">
                            {displayDiscPct > 0 ? `-${displayDiscPct}%` : ""}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-2 text-right font-bold font-mono text-zinc-850">
                        {fmtDec(valueIncludingTax)}
                        {displayDisc > 0 && (
                          <div className="text-[9px] text-green-600 font-normal">
                            Disc: -{fmtDec(displayDisc)}
                          </div>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bottom Layout - Totals, Signatures, FBR */}
      <div className="space-y-6">
        {!isGiftReceipt ? (
          <div className="grid grid-cols-2 gap-8 items-start border-t border-zinc-300 pt-5">
            {/* Left Column: Payment, FBR POS QR Code */}
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                  Payment Methods
                </h4>
                <div className="divide-y divide-zinc-100 bg-zinc-50 rounded-lg p-3 border border-zinc-200 text-xs">
                  {tenders.map((t, i) => (
                    <div
                      key={i}
                      className="flex justify-between py-1.5 first:pt-0 last:pb-0"
                    >
                      <span className="capitalize text-zinc-600 font-medium">
                        {t.method.replace(/_/g, " ")}
                        {t.cardLast4 ? ` •••• ${t.cardLast4}` : ""}
                        {t.slipNo ? ` (${t.slipNo})` : ""}
                      </span>
                      <span className="font-bold text-zinc-800">
                        Rs.{" "}
                        {t.method === "voucher" && t.voucherFaceValue
                          ? fmt(t.voucherFaceValue)
                          : fmt(t.amount)}
                      </span>
                    </div>
                  ))}
                  {changeAmount > 0 && (
                    <div className="flex justify-between py-1.5 text-zinc-850 font-bold border-t border-zinc-200 mt-1">
                      <span>Change Returned</span>
                      <span className="font-bold">Rs. {fmt(changeAmount)}</span>
                    </div>
                  )}
                </div>
              </div>

              {hasFbrInfo && (
                <div className="flex gap-4 items-center bg-zinc-50 border border-zinc-200 rounded-lg p-3">
                  <div className="shrink-0 bg-white p-1 rounded border border-zinc-200">
                    <Image
                      src={
                        typeof window !== "undefined"
                          ? `${window.location.origin}/fbr_pos.png`
                          : "/fbr_pos.png"
                      }
                      alt="FBR Logo"
                      width={50}
                      height={50}
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                  <div className="space-y-1 flex-1">
                    <p className="text-[10px] text-zinc-600 leading-snug">
                      Verified by FBR POS. Verify via FBR Tax Asaan App or SMS
                      at <strong>9966</strong>.
                    </p>
                    {order?.fbrInvoiceNumber && (
                      <p className="text-[11px] font-mono font-bold text-zinc-900">
                        FBR Inv #: {order.fbrInvoiceNumber}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 bg-white p-1 rounded border border-zinc-200">
                    <QRCodeSVG value={fbrVerifyUrl} size={48} level="M" />
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Pricing Aggregations */}
            <div className="space-y-1 bg-zinc-50/50 rounded-lg p-4 border border-zinc-200">
              <div className="flex justify-between text-zinc-600 py-0.5">
                <span>Subtotal (Excl. Sales Tax)</span>
                <span className="font-mono font-semibold">
                  {fmt(Math.round(subtotal))}
                </span>
              </div>

              <div className="flex justify-between text-zinc-600 py-0.5">
                <span>Total Invoice Discounts</span>
                <span className="font-mono font-semibold text-green-600">
                  {totalDiscount > 0
                    ? `-${fmt(Math.round(totalDiscount))}`
                    : "—"}
                </span>
              </div>

              <div className="flex justify-between text-zinc-600 py-0.5">
                <span>Taxable Value for Sales</span>
                <span className="font-mono font-semibold">
                  {fmt(Math.round(valueForSales))}
                </span>
              </div>

              {settings.receiptShowTax && (
                <div className="flex justify-between text-zinc-600 py-0.5 border-b border-zinc-200 pb-2 mb-2">
                  <span>Sales Tax Total</span>
                  <span className="font-mono font-semibold">
                    {fmt(Math.round(totalTax))}
                  </span>
                </div>
              )}

              {hasFbrInfo && fbrPosFee > 0 && (
                <div className="flex justify-between text-zinc-550 py-0.5 text-[10px]">
                  <span>FBR POS Service Charge</span>
                  <span className="font-mono">
                    {fmt(Math.round(fbrPosFee))}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center text-zinc-900 pt-3 mt-2 border-t-2 border-zinc-800">
                <span className="font-black text-sm uppercase">
                  Grand Total
                </span>
                <span className="font-mono font-black text-lg text-zinc-900 bg-zinc-100 px-3 py-1 rounded border border-zinc-250">
                  Rs. {fmt(Math.round(finalGrandTotal))}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-6 border-t border-dashed border-zinc-300 text-zinc-500 text-xs">
            Price details omitted — this is a Gift Receipt. Thank you for your
            purchase!
          </div>
        )}

        {/* Credit Vouchers Box */}
        {creditVouchers && creditVouchers.length > 0 && (
          <div className="border-2 border-dashed border-emerald-500 rounded-lg p-4 bg-emerald-50/30 grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <h4 className="font-extrabold text-emerald-800 text-xs uppercase tracking-wide">
                Credit Voucher Issued
              </h4>
              <p className="text-[10px] text-emerald-600 leading-snug">
                An unused credit balance has been returned as a store voucher.
                Use this voucher code on your next purchase.
              </p>
            </div>
            <div className="space-y-2">
              {creditVouchers.map((voucher, idx) => (
                <div
                  key={idx}
                  className="bg-white border border-emerald-500 rounded p-2 flex justify-between items-center shadow-sm"
                >
                  <div>
                    <span className="text-[10px] text-zinc-400 block font-mono">
                      Code
                    </span>
                    <span className="font-mono font-black text-sm text-emerald-700 tracking-wider">
                      {voucher.code}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-zinc-400 block">
                      Value
                    </span>
                    <span className="font-black text-sm text-zinc-900">
                      Rs. {fmt(Number(voucher.faceValue))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Terms, Sign-off & Footer */}
        <div className="border-t border-zinc-200 pt-5 space-y-6">
          <div className="grid grid-cols-2 gap-10">
            {/* Terms and Conditions */}
            <div className="text-[9px] text-zinc-500 space-y-1">
              <p className="font-bold text-zinc-700 uppercase tracking-wider mb-0.5">
                Exchange &amp; Refund Policy
              </p>
              <ul className="list-disc pl-3 space-y-0.5">
                <li>Exchange is allowed within 15 days of the purchase date with the original invoice and tags attached.</li>
                <li>Refunds are only applicable for items confirmed by the company to have a manufacturing defect. Approved refunds will be processed within 15 working days.</li>
                <li>Items that are used, washed, altered, damaged, or without original tags/invoice are not eligible for exchange or refund.</li>
                <li>Only one exchange is allowed per purchase. Exchanged items cannot be exchanged again.</li>
                <li>Sale, promotional, and discounted items are not eligible for exchange or refund unless a manufacturing defect is confirmed.</li>
                <li>The company's quality inspection and final decision regarding exchange or refund shall be final.</li>
              </ul>
            </div>

            {/* Signature Blocks */}
            <div className="grid grid-cols-2 gap-4 text-[10px] items-end pb-1">
              <div className="text-center space-y-2">
                <div className="border-b border-zinc-300 w-full h-8" />
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">
                  Customer Signature
                </span>
              </div>
              <div className="text-center space-y-2">
                <div className="border-b border-zinc-300 w-full h-8" />
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">
                  Authorized Sign
                </span>
              </div>
            </div>
          </div>

          <div className="text-center text-[10px] text-zinc-500 border-t border-zinc-100 pt-3">
            <p className="font-medium tracking-wide">
              {settings.receiptFooter || "*** THANK YOU FOR SHOPPING ***"}
            </p>
            <p className="text-[9px] text-zinc-400 font-mono mt-0.5">
              Invoice Ref: {order?.orderNumber}
            </p>
            <p className="text-[9px] text-zinc-400 pt-0.5">
              Software by Innovative Network (Pvt) Ltd
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
