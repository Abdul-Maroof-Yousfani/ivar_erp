"use client";

import { useState, useMemo, useTransition, useEffect } from "react";
import { format } from "date-fns";
import { Download, Printer, RefreshCw, ChevronDown, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { getTrialBalance, TrialBalanceResult, TrialBalanceRow } from "@/lib/actions/finance-reports";
import jsPDF from "jspdf";
import React from "react";
import { toast } from "sonner";

const fmt = (n: number) =>
  n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// Format with brackets for credit (negative) amounts
const fmtWithBrackets = (debit: number, credit: number) => {
  if (debit > 0) return fmt(debit);
  if (credit > 0) return `(${fmt(credit)})`;
  return "0.00";
};

const TYPE_COLORS: Record<string, string> = {
  ASSET:     "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  LIABILITY: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  EQUITY:    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  INCOME:    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  EXPENSE:   "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
};

const TrialBalance5ColRow = React.memo(function TrialBalance5ColRow({
  row,
  index,
}: {
  row: TrialBalanceRow;
  index: number;
}) {
  return (
    <tr className={cn("border-b dark:border-border/50 hover:bg-accent/30 transition-colors", index % 2 === 1 && "bg-muted/10")}>
      <td className="px-4 py-2 font-mono text-xs text-muted-foreground border-r">{row.code}</td>
      <td className="px-4 py-2 border-r">
        <div className="font-medium">{row.name}</div>
        {row.parent && <div className="text-xs text-muted-foreground">{row.parent.name}</div>}
      </td>
      <td className="px-4 py-2 text-center border-r">
        <Badge className={cn("text-[10px]", TYPE_COLORS[row.type])} variant="secondary">{row.type}</Badge>
      </td>
      <td className="px-4 py-2 text-right font-mono text-xs border-r">
        {fmtWithBrackets(row.openingDebit || 0, row.openingCredit || 0)}
      </td>
      <td className="px-4 py-2 text-right font-mono text-xs border-r">
        {row.transactionDebit > 0 ? fmt(row.transactionDebit) : "0.00"}
      </td>
      <td className="px-4 py-2 text-right font-mono text-xs border-r">
        {row.transactionCredit > 0 ? fmt(row.transactionCredit) : "0.00"}
      </td>
      <td className="px-4 py-2 text-right font-mono text-xs border-r">
        {row.closingDebit > 0 ? fmt(row.closingDebit) : "0.00"}
      </td>
      <td className="px-4 py-2 text-right font-mono text-xs">
        {row.closingCredit > 0 ? fmt(row.closingCredit) : "0.00"}
      </td>
    </tr>
  );
});

export function TrialBalance5ColClient({ initialData }: { initialData?: TrialBalanceResult }) {
  const [data, setData] = useState<TrialBalanceResult | undefined>(initialData);
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [toDate, setToDate] = useState<Date | undefined>(undefined);
  const [isPending, startTransition] = useTransition();
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  
  // Account type filters
  const [showAssets, setShowAssets] = useState(true);
  const [showLiabilities, setShowLiabilities] = useState(true);
  const [showCapital, setShowCapital] = useState(true);
  const [showExpenses, setShowExpenses] = useState(true);
  const [showRevenue, setShowRevenue] = useState(true);

  // Search & Collapsing state
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedTypes, setCollapsedTypes] = useState<Record<string, boolean>>({});

  const load = (from?: Date, to?: Date) => {
    startTransition(async () => {
      const res = await getTrialBalance(
        from ? format(from, "yyyy-MM-dd") : undefined,
        to   ? format(to,   "yyyy-MM-dd") : undefined,
      );
      if (res.status) setData(res.data);
    });
  };

  const toggleType = (type: string) => {
    setCollapsedTypes(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const expandAll = () => setCollapsedTypes({});
  const collapseAll = () => {
    setCollapsedTypes({
      ASSET: true,
      LIABILITY: true,
      EQUITY: true,
      INCOME: true,
      EXPENSE: true,
    });
  };

  // Group rows by account type with filters + search
  const grouped = useMemo(() => {
    if (!data?.rows) return {} as Record<string, TrialBalanceRow[]>;
    
    const typeFilters: Record<string, boolean> = {
      ASSET: showAssets,
      LIABILITY: showLiabilities,
      EQUITY: showCapital,
      EXPENSE: showExpenses,
      INCOME: showRevenue,
    };
    
    const q = searchQuery.toLowerCase().trim();
    
    return data.rows.reduce<Record<string, TrialBalanceRow[]>>((acc, row) => {
      if (typeFilters[row.type]) {
        const codeMatch = row.code?.toLowerCase().includes(q);
        const nameMatch = row.name?.toLowerCase().includes(q);
        if (!q || codeMatch || nameMatch) {
          (acc[row.type] ??= []).push(row);
        }
      }
      return acc;
    }, {});
  }, [data, showAssets, showLiabilities, showCapital, showExpenses, showRevenue, searchQuery]);

  const handlePDFExport = () => {
    if (!data || !data.rows || data.rows.length === 0) {
      toast.error("No data to export");
      return;
    }

    setIsGeneratingPDF(true);
    const toastId = toast.loading("Generating 5-Column Trial Balance PDF...");
    
    try {
      const doc = new jsPDF("l", "mm", "a4"); // Landscape
      
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - margin * 2;

      let pageNum = 1;

      // Columns coordinates
      const columns = [
        { header: "Code", width: 25, align: "left" },
        { header: "Account Name", width: 67, align: "left" },
        { header: "Nature of Account", width: 25, align: "center" },
        { header: "Opening Balance", width: 35, align: "right" },
        { header: "Dr During Period", width: 30, align: "right" },
        { header: "Cr During Period", width: 30, align: "right" },
        { header: "End.Dr", width: 30, align: "right" },
        { header: "End.Cr", width: 30, align: "right" },
      ];

      const colX: number[] = [];
      let curX = margin;
      columns.forEach((col) => {
        colX.push(curX);
        curX += col.width;
      });

      const drawHeader = () => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(14);
        doc.text("SPEED LIMIT", pageWidth / 2, 12, { align: "center" });

        doc.setFontSize(11);
        doc.text("TRIAL BALANCE REPORT (5-COLUMN FORMAT)", pageWidth / 2, 18, { align: "center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        const dateRangeStr = fromDate && toDate
          ? `Period: ${format(fromDate, "dd MMM yyyy")} - ${format(toDate, "dd MMM yyyy")}`
          : "All time (running balances)";
        doc.text(dateRangeStr, pageWidth / 2, 23, { align: "center" });

        // Meta Box
        doc.setFontSize(7.5);
        doc.text(`Printed: ${format(new Date(), "dd-MMM-yyyy HH:mm")}`, margin, 27);
        doc.text(`Status: ${data.balanced ? "BALANCED" : "UNBALANCED"}`, margin, 31);
        
        doc.setFont("helvetica", "bold");
        if (!data.balanced) {
          doc.setTextColor(180, 0, 0);
        } else {
          doc.setTextColor(0, 120, 0);
        }
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "normal");
        doc.text(`Page ${pageNum}`, pageWidth - margin, 31, { align: "right" });

        const headerY = 35;
        const headerHeight = 7;
        
        doc.setFillColor(240, 240, 240);
        doc.rect(margin, headerY, contentWidth, headerHeight, "F");
        
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.25);
        doc.line(margin, headerY, pageWidth - margin, headerY);
        doc.line(margin, headerY + headerHeight, pageWidth - margin, headerY + headerHeight);

        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(40, 40, 40);

        columns.forEach((col, idx) => {
          const x = col.align === "center" 
            ? colX[idx] + col.width / 2 
            : col.align === "right" 
              ? colX[idx] + col.width - 2 
              : colX[idx] + 2;
          doc.text(col.header, x, headerY + 4.5, { align: col.align });
        });

        doc.setTextColor(0, 0, 0);
        return headerY + headerHeight;
      };

      let y = drawHeader();
      const rowHeight = 5.5;
      const bottomLimit = pageHeight - 20;

      const typeOrder = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"];

      typeOrder.forEach(type => {
        const rows = grouped[type];
        if (!rows?.length) return;

        // Check for page break before category header
        if (y + rowHeight * 3 > bottomLimit) {
          doc.addPage();
          pageNum++;
          y = drawHeader();
        }

        // Section Type Header Row
        doc.setFillColor(245, 247, 250);
        doc.rect(margin, y, contentWidth, rowHeight, "F");
        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.25);
        doc.line(margin, y, pageWidth - margin, y);
        doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);
        doc.text(type, margin + 2, y + 4);
        doc.setTextColor(0, 0, 0);

        y += rowHeight;

        // Draw section rows
        rows.forEach((row, idx) => {
          if (y + rowHeight > bottomLimit) {
            doc.addPage();
            pageNum++;
            y = drawHeader();
          }

          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          
          if (idx % 2 === 1) {
            doc.setFillColor(248, 250, 252);
            doc.rect(margin, y, contentWidth, rowHeight, "F");
          }

          doc.setDrawColor(230, 230, 230);
          doc.setLineWidth(0.15);
          doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);

          // Render cells
          doc.text(row.code || "", colX[0] + 2, y + 4);
          doc.text(row.name || "", colX[1] + 2, y + 4);
          doc.text(row.type || "", colX[2] + columns[2].width / 2, y + 4, { align: "center" });

          const fmtVal = (debit: number, credit: number) => {
            if (debit > 0) return debit.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            if (credit > 0) return `(${credit.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
            return "0.00";
          };
          const fmtSingle = (v: number) => v > 0 ? v.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00";

          doc.text(fmtVal(row.openingDebit || 0, row.openingCredit || 0), colX[3] + columns[3].width - 2, y + 4, { align: "right" });
          doc.text(fmtSingle(row.transactionDebit || 0), colX[4] + columns[4].width - 2, y + 4, { align: "right" });
          doc.text(fmtSingle(row.transactionCredit || 0), colX[5] + columns[5].width - 2, y + 4, { align: "right" });
          doc.text(fmtSingle(row.closingDebit || 0), colX[6] + columns[6].width - 2, y + 4, { align: "right" });
          doc.text(fmtSingle(row.closingCredit || 0), colX[7] + columns[7].width - 2, y + 4, { align: "right" });

          y += rowHeight;
        });

        // Subtotals for this type
        if (y + rowHeight > bottomLimit) {
          doc.addPage();
          pageNum++;
          y = drawHeader();
        }

        const subtotalOpenDr = rows.reduce((s, r) => s + (r.openingDebit || 0), 0);
        const subtotalOpenCr = rows.reduce((s, r) => s + (r.openingCredit || 0), 0);
        const subtotalTxDr = rows.reduce((s, r) => s + (r.transactionDebit || 0), 0);
        const subtotalTxCr = rows.reduce((s, r) => s + (r.transactionCredit || 0), 0);
        const subtotalClosingDr = rows.reduce((s, r) => s + (r.closingDebit || 0), 0);
        const subtotalClosingCr = rows.reduce((s, r) => s + (r.closingCredit || 0), 0);

        doc.setFillColor(240, 240, 240);
        doc.rect(margin, y, contentWidth, rowHeight, "F");
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.25);
        doc.line(margin, y, pageWidth - margin, y);
        doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);

        doc.setFont("helvetica", "bold");
        doc.text(`Subtotal ${type}`, colX[1] + 2, y + 4);

        const fmtSub = (debit: number, credit: number) => {
          if (debit > 0) return debit.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
          if (credit > 0) return `(${credit.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
          return "0.00";
        };
        const fmtSubS = (v: number) => v > 0 ? v.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "0.00";

        doc.text(fmtSub(subtotalOpenDr, subtotalOpenCr), colX[3] + columns[3].width - 2, y + 4, { align: "right" });
        doc.text(fmtSubS(subtotalTxDr), colX[4] + columns[4].width - 2, y + 4, { align: "right" });
        doc.text(fmtSubS(subtotalTxCr), colX[5] + columns[5].width - 2, y + 4, { align: "right" });
        doc.text(fmtSubS(subtotalClosingDr), colX[6] + columns[6].width - 2, y + 4, { align: "right" });
        doc.text(fmtSubS(subtotalClosingCr), colX[7] + columns[7].width - 2, y + 4, { align: "right" });

        y += rowHeight + 3; // Section spacer
      });

      // Check page break for grand totals
      if (y + 12 > bottomLimit) {
        doc.addPage();
        pageNum++;
        y = drawHeader();
      }

      // Grand Totals row
      doc.setFillColor(220, 220, 220);
      doc.rect(margin, y, contentWidth, 7, "F");
      doc.setDrawColor(80, 80, 80);
      doc.setLineWidth(0.45);
      doc.line(margin, y, pageWidth - margin, y);
      doc.line(margin, y + 7, pageWidth - margin, y + 7);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.text("GRAND TOTAL", colX[1] + 2, y + 4.5);

      const fmtGVal = (debit: number, credit: number) => {
        if (debit > 0) return debit.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        if (credit > 0) return `(${credit.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`;
        return "0.00";
      };
      const fmtG = (v: number) => v.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      doc.text(fmtGVal(data.totalOpeningDebit ?? 0, data.totalOpeningCredit ?? 0), colX[3] + columns[3].width - 2, y + 4.5, { align: "right" });
      doc.text(fmtG(data.totalTransactionDebit ?? 0), colX[4] + columns[4].width - 2, y + 4.5, { align: "right" });
      doc.text(fmtG(data.totalTransactionCredit ?? 0), colX[5] + columns[5].width - 2, y + 4.5, { align: "right" });
      doc.text(fmtG(data.totalClosingDebit ?? data.totalDebit ?? 0), colX[6] + columns[6].width - 2, y + 4.5, { align: "right" });
      doc.text(fmtG(data.totalClosingCredit ?? data.totalCredit ?? 0), colX[7] + columns[7].width - 2, y + 4.5, { align: "right" });

      y += 12;

      // Signature Boxes
      if (y + 25 <= pageHeight - margin) {
        const boxWidth = contentWidth / 3.3;
        const gap = (contentWidth - boxWidth * 3) / 2;
        const boxHeight = 15;
        
        const drawSigBox = (title: string, startX: number) => {
          doc.rect(startX, y, boxWidth, boxHeight);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(6.5);
          doc.text(title, startX + boxWidth / 2, y + 3.5, { align: "center" });
          doc.setDrawColor(200, 200, 200);
          doc.line(startX + 5, y + 11, startX + boxWidth - 5, y + 11);
        };

        doc.setDrawColor(120, 120, 120);
        doc.setLineWidth(0.2);
        drawSigBox("PREPARED BY", margin);
        drawSigBox("CHECKED BY", margin + boxWidth + gap);
        drawSigBox("APPROVED BY", margin + (boxWidth + gap) * 2);
      }

      doc.save(`Trial_Balance_5Col_${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast.success("PDF report downloaded successfully!");
    } catch (err: any) {
      console.error("PDF Export error:", err);
      toast.error("Failed to generate PDF: " + err.message);
    } finally {
      toast.dismiss(toastId);
      setIsGeneratingPDF(false);
    }
  };

  const typeOrder = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b flex flex-row items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle>Trial Balance (5-Column)</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {fromDate && toDate
                ? `Period: ${format(fromDate, "dd MMM yyyy")} – ${format(toDate, "dd MMM yyyy")}`
                : "All time (running balances)"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePDFExport} disabled={isGeneratingPDF}>
              <Printer className="h-4 w-4 mr-2" /> {isGeneratingPDF ? "Generating..." : "Print PDF"}
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
              <div className="space-y-2 min-w-[220px] flex-1 md:flex-none">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Search Accounts</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search by name or code..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>
              </div>

              <div className="flex gap-2 pb-0.5">
                <Button variant="outline" size="sm" onClick={expandAll} type="button">
                  Expand Sections
                </Button>
                <Button variant="outline" size="sm" onClick={collapseAll} type="button">
                  Collapse Sections
                </Button>
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

          {/* Table - 5 Column Format */}
          <div className="overflow-x-auto rounded-lg border dark:border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b dark:border-border">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider border-r">Code</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider border-r">Account Name</th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider border-r">Nature of Account</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider border-r">Opening Balance</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider border-r">Dr During The Period</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider border-r">Cr During The Period</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider border-r">End.Dr</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider">End.Cr</th>
                </tr>
              </thead>
              <tbody>
                {typeOrder.map(type => {
                  const rows = grouped[type];
                  if (!rows?.length) return null;
                  
                  const isCollapsed = !!collapsedTypes[type];
                  
                  // Calculate subtotals for this type
                  const subtotalOpenDr = rows.reduce((s, r) => s + (r.openingDebit || 0), 0);
                  const subtotalOpenCr = rows.reduce((s, r) => s + (r.openingCredit || 0), 0);
                  const subtotalTxDr = rows.reduce((s, r) => s + (r.transactionDebit || 0), 0);
                  const subtotalTxCr = rows.reduce((s, r) => s + (r.transactionCredit || 0), 0);
                  const subtotalClosingDr = rows.reduce((s, r) => s + (r.closingDebit || 0), 0);
                  const subtotalClosingCr = rows.reduce((s, r) => s + (r.closingCredit || 0), 0);
                  
                  return (
                    <React.Fragment key={type}>
                      <tr 
                        className="bg-muted/25 border-t dark:border-border hover:bg-accent/20 cursor-pointer transition-colors"
                        onClick={() => toggleType(type)}
                      >
                        <td colSpan={8} className="px-4 py-2.5 font-bold text-xs uppercase tracking-widest text-muted-foreground">
                          <div className="flex items-center gap-1.5 select-none">
                            {isCollapsed ? (
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                            <span>{type} ({rows.length})</span>
                          </div>
                        </td>
                      </tr>
                      {!isCollapsed && (
                        <>
                          {rows.map((row, i) => (
                            <TrialBalance5ColRow 
                              key={row.id} 
                              row={row} 
                              index={i} 
                            />
                          ))}
                          <tr className="bg-muted/30 font-semibold border-t dark:border-border">
                            <td colSpan={3} className="px-4 py-2 text-right text-xs uppercase text-muted-foreground border-r">Subtotal {type}</td>
                            <td className="px-4 py-2 text-right font-mono text-xs border-r">
                              {fmtWithBrackets(subtotalOpenDr, subtotalOpenCr)}
                            </td>
                            <td className="px-4 py-2 text-right font-mono text-xs border-r">{subtotalTxDr > 0 ? fmt(subtotalTxDr) : "0.00"}</td>
                            <td className="px-4 py-2 text-right font-mono text-xs border-r">{subtotalTxCr > 0 ? fmt(subtotalTxCr) : "0.00"}</td>
                            <td className="px-4 py-2 text-right font-mono text-xs border-r">{subtotalClosingDr > 0 ? fmt(subtotalClosingDr) : "0.00"}</td>
                            <td className="px-4 py-2 text-right font-mono text-xs">{subtotalClosingCr > 0 ? fmt(subtotalClosingCr) : "0.00"}</td>
                          </tr>
                        </>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-muted/60 border-t-2 dark:border-border font-bold text-sm">
                  <td colSpan={3} className="px-4 py-3 text-right uppercase tracking-wider border-r">Grand Total</td>
                  <td className="px-4 py-3 text-right font-mono border-r">
                    {fmtWithBrackets(data?.totalOpeningDebit ?? 0, data?.totalOpeningCredit ?? 0)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono border-r">{fmt(data?.totalTransactionDebit ?? 0)}</td>
                  <td className="px-4 py-3 text-right font-mono border-r">{fmt(data?.totalTransactionCredit ?? 0)}</td>
                  <td className="px-4 py-3 text-right font-mono border-r">{fmt(data?.totalClosingDebit ?? data?.totalDebit ?? 0)}</td>
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
