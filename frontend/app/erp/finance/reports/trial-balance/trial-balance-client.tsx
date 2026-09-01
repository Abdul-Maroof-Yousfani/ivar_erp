"use client";

import { useState, useTransition, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { Download, Printer, RefreshCw, ChevronDown, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";
import { getTrialBalance, TrialBalanceResult, queueTrialBalanceExport } from "@/lib/actions/finance-reports";
import { TrialBalancePrint } from "./trial-balance-print";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import jsPDF from "jspdf";
import React from "react";

const fmt = (n: number) =>
  n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const TrialBalanceRow = React.memo(function TrialBalanceRow({
  row,
  index,
  showOpening,
  showTransactions,
  showClosing,
  onToggleCollapse,
  isCollapsed,
  hasChildren,
}: {
  row: any;
  index: number;
  showOpening: boolean;
  showTransactions: boolean;
  showClosing: boolean;
  onToggleCollapse?: (id: string) => void;
  isCollapsed?: boolean;
  hasChildren?: boolean;
}) {
  const isGroup = 'isGroup' in row && row.isGroup;
  const isTag = row.isTagAccount;
  const level = row.level || 0;
  
  return (
    <tr 
      className={cn(
        "border-b dark:border-border/50 hover:bg-accent/30 transition-colors", 
        isGroup && "font-semibold bg-muted/20",
        isTag && "text-muted-foreground bg-muted/5",
        !isGroup && !isTag && index % 2 === 1 && "bg-muted/10"
      )}
    >
      <td className="px-4 py-2 text-center font-mono text-xs border-r">{index + 1}</td>
      <td className="px-4 py-2 font-mono text-xs border-r">{row.code}</td>
      <td className="px-4 py-2 border-r">
        <div 
          className="flex items-center gap-1.5" 
          style={{ paddingLeft: `${level * 1.2}rem` }}
        >
          {isGroup && hasChildren ? (
            <button
              onClick={() => onToggleCollapse?.(row.id)}
              className="p-1 hover:bg-muted rounded text-muted-foreground transition-transform duration-200 inline-flex items-center justify-center cursor-pointer"
              type="button"
            >
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", isCollapsed && "-rotate-90")} />
            </button>
          ) : (
            isGroup && <span className="w-[22px]" />
          )}
          {!isGroup && level > 0 && <span className="w-2" />} 
          <span className={cn(isTag && "italic text-muted-foreground")}>
            {isTag ? `↳ ${row.name}` : row.name}
          </span>
        </div>
      </td>
      {showOpening && (
        <>
          <td className="px-4 py-2 text-right font-mono text-xs text-muted-foreground">
            {row.openingDebit > 0 ? fmt(row.openingDebit) : ""}
          </td>
          <td className="px-4 py-2 text-right font-mono text-xs text-muted-foreground border-r">
            {row.openingCredit > 0 ? fmt(row.openingCredit) : ""}
          </td>
        </>
      )}
      {showTransactions && (
        <>
          <td className="px-4 py-2 text-right font-mono text-xs">
            {row.transactionDebit > 0 ? fmt(row.transactionDebit) : ""}
          </td>
          <td className="px-4 py-2 text-right font-mono text-xs border-r">
            {row.transactionCredit > 0 ? fmt(row.transactionCredit) : ""}
          </td>
        </>
      )}
      {showClosing && (
        <>
          <td className="px-4 py-2 text-right font-mono text-xs text-muted-foreground">
            {row.closingDebit > 0 ? fmt(row.closingDebit) : ""}
          </td>
          <td className="px-4 py-2 text-right font-mono text-xs text-muted-foreground">
            {row.closingCredit > 0 ? fmt(row.closingCredit) : ""}
          </td>
        </>
      )}
    </tr>
  );
});

type ReportType = "OPENING" | "CLOSING" | "DETAILED";

export function TrialBalanceClient({ initialData }: { initialData?: TrialBalanceResult }) {
  const [data, setData] = useState<TrialBalanceResult | undefined>(initialData);
  const [fromDate, setFromDate] = useState<Date | undefined>(undefined);
  const [toDate, setToDate] = useState<Date | undefined>(undefined);
  const [isPending, startTransition] = useTransition();
  const [isExporting, setIsExporting] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  
  const [reportType, setReportType] = useState<ReportType>("DETAILED");
  const [includeTagAccounts, setIncludeTagAccounts] = useState(false);

  // Search & Collapsible state
  const [searchQuery, setSearchQuery] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const rawRows = data?.rows || [];

  // Collapse sub-groups (level >= 1) by default when data loads
  useEffect(() => {
    if (rawRows.length > 0) {
      const initialCollapsed: Record<string, boolean> = {};
      rawRows.forEach(r => {
        const isGroup = 'isGroup' in r && r.isGroup;
        if (isGroup && (r.level || 0) >= 1) {
          initialCollapsed[r.id] = true;
        }
      });
      setCollapsedGroups(initialCollapsed);
    }
  }, [data]);

  const toggleCollapse = (id: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const expandAll = () => {
    setCollapsedGroups({});
  };

  const collapseAll = () => {
    const collapsed: Record<string, boolean> = {};
    rawRows.forEach(r => {
      const isGroup = 'isGroup' in r && r.isGroup;
      if (isGroup) {
        collapsed[r.id] = true;
      }
    });
    setCollapsedGroups(collapsed);
  };

  // Compute visible rows based on search and collapsed state
  const visibleRows = useMemo(() => {
    if (!rawRows || rawRows.length === 0) return [];

    // 1. If search is active
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      
      const parentMap = new Map<string, string>(); // childId -> parentId
      rawRows.forEach(r => {
        if (r.parentId) {
          parentMap.set(r.id, r.parentId);
        }
      });

      const matches = new Set<string>();
      rawRows.forEach(r => {
        const codeMatch = r.code?.toLowerCase().includes(q);
        const nameMatch = r.name?.toLowerCase().includes(q);
        if (codeMatch || nameMatch) {
          matches.add(r.id);
          // Add all ancestors to the matches set so tree context is visible
          let currParent = r.parentId;
          while (currParent) {
            matches.add(currParent);
            currParent = parentMap.get(currParent);
          }
        }
      });

      return rawRows.filter(r => matches.has(r.id));
    }

    // 2. If no search, filter by collapsed state
    const visible: any[] = [];
    let hideBelowLevel = 999;
    
    rawRows.forEach(row => {
      const level = row.level || 0;
      
      if (level >= hideBelowLevel) {
        return;
      } else {
        hideBelowLevel = 999;
      }
      
      visible.push(row);
      
      const isGroup = 'isGroup' in row && row.isGroup;
      if (isGroup && collapsedGroups[row.id]) {
        hideBelowLevel = level + 1;
      }
    });

    return visible;
  }, [rawRows, searchQuery, collapsedGroups]);

  const parentIdsSet = useMemo(() => new Set(rawRows.map(r => r.parentId).filter(Boolean)), [rawRows]);

  const handleExcelExport = async () => {
    if (!data) return;
    setIsExporting(true);
    toast.loading("Queuing Excel export job...");
    try {
      const res = await queueTrialBalanceExport({
        from: fromDate ? format(fromDate, "yyyy-MM-dd") : undefined,
        to: toDate ? format(toDate, "yyyy-MM-dd") : undefined,
        includeTagAccounts,
        reportType,
      });

      toast.dismiss();
      if (res.status && res.data) {
        toast.success("Excel export job successfully queued! Check your notification bell in a moment to download.");
      } else {
        toast.error(res.message || "Failed to queue Excel export job.");
      }
    } catch (e: any) {
      toast.dismiss();
      toast.error(e.message || "Failed to queue export job.");
    } finally {
      setIsExporting(false);
    }
  };

  // Direct Vector-based Background PDF Exporter
  const handlePDFExport = () => {
    if (!data || rawRows.length === 0) {
      toast.error("No data to export");
      return;
    }

    setIsGeneratingPDF(true);
    const toastId = toast.loading("Generating Trial Balance PDF...");
    
    try {
      const showOpening = reportType === "OPENING" || reportType === "DETAILED";
      const showTransactions = reportType === "DETAILED";
      const showClosing = reportType === "CLOSING" || reportType === "DETAILED";

      const isDetailed = reportType === "DETAILED";
      const doc = new jsPDF(isDetailed ? "l" : "p", "mm", "a4");

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      const contentWidth = pageWidth - margin * 2;

      let pageNum = 1;

      // Table coordinates & columns
      const columns = isDetailed
        ? [
            { header: "Sr.", width: 12, align: "center" },
            { header: "Code", width: 23, align: "center" },
            { header: "Account Description", width: 92, align: "left" },
            { header: "Open DR", width: 25, align: "right" },
            { header: "Open CR", width: 25, align: "right" },
            { header: "Tx DR", width: 25, align: "right" },
            { header: "Tx CR", width: 25, align: "right" },
            { header: "Close DR", width: 25, align: "right" },
            { header: "Close CR", width: 25, align: "right" },
          ]
        : [
            { header: "Sr.", width: 12, align: "center" },
            { header: "Code", width: 25, align: "center" },
            { header: "Account Description", width: 73, align: "left" },
            { header: showOpening ? "Opening DR" : "Closing DR", width: 40, align: "right" },
            { header: showOpening ? "Opening CR" : "Closing CR", width: 40, align: "right" },
          ];

      // Compute column X starts
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
        doc.text("TRIAL BALANCE REPORT", pageWidth / 2, 18, { align: "center" });

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        const dateRangeStr = fromDate && toDate
          ? `Period: ${format(fromDate, "dd MMM yyyy")} - ${format(toDate, "dd MMM yyyy")}`
          : "All time (running balances)";
        doc.text(dateRangeStr, pageWidth / 2, 23, { align: "center" });

        // Meta Box
        doc.setFontSize(7.5);
        doc.text(`Printed: ${format(new Date(), "dd-MMM-yyyy HH:mm")}`, margin, 27);
        doc.text(`Format: ${reportType} | Sub-Accounts: ${includeTagAccounts ? "Yes" : "No"}`, margin, 31);
        
        const statusText = `Status: ${data.balanced ? "BALANCED" : "UNBALANCED"}`;
        doc.setFont("helvetica", "bold");
        if (!data.balanced) {
          doc.setTextColor(180, 0, 0);
        } else {
          doc.setTextColor(0, 120, 0);
        }
        doc.text(statusText, pageWidth - margin, 27, { align: "right" });
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "normal");
        doc.text(`Page ${pageNum}`, pageWidth - margin, 31, { align: "right" });

        // Draw table header block
        const headerY = 35;
        const headerHeight = isDetailed ? 10 : 7;
        
        // Gray background for headers
        doc.setFillColor(240, 240, 240);
        doc.rect(margin, headerY, contentWidth, headerHeight, "F");
        
        doc.setDrawColor(180, 180, 180);
        doc.setLineWidth(0.25);
        doc.line(margin, headerY, pageWidth - margin, headerY);
        doc.line(margin, headerY + headerHeight, pageWidth - margin, headerY + headerHeight);

        // Render column headers
        doc.setFontSize(8);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(40, 40, 40);

        if (isDetailed) {
          doc.text("Sr.", colX[0] + columns[0].width / 2, headerY + 6, { align: "center" });
          doc.text("Code", colX[1] + columns[1].width / 2, headerY + 6, { align: "center" });
          doc.text("Account Description", colX[2] + 2, headerY + 6);
          
          doc.text("Opening Balance", colX[3] + 25, headerY + 3.5, { align: "center" });
          doc.text("Transactions", colX[5] + 25, headerY + 3.5, { align: "center" });
          doc.text("Closing Balance", colX[7] + 25, headerY + 3.5, { align: "center" });

          // Line dividing sub-headers
          doc.line(colX[3], headerY + 4.5, pageWidth - margin, headerY + 4.5);

          doc.setFontSize(7);
          doc.text("DR", colX[3] + columns[3].width / 2, headerY + 8.5, { align: "center" });
          doc.text("CR", colX[4] + columns[4].width / 2, headerY + 8.5, { align: "center" });
          doc.text("DR", colX[5] + columns[5].width / 2, headerY + 8.5, { align: "center" });
          doc.text("CR", colX[6] + columns[6].width / 2, headerY + 8.5, { align: "center" });
          doc.text("DR", colX[7] + columns[7].width / 2, headerY + 8.5, { align: "center" });
          doc.text("CR", colX[8] + columns[8].width / 2, headerY + 8.5, { align: "center" });
        } else {
          columns.forEach((col, idx) => {
            const x = col.align === "center" 
              ? colX[idx] + col.width / 2 
              : col.align === "right" 
                ? colX[idx] + col.width - 2 
                : colX[idx] + 2;
            doc.text(col.header, x, headerY + 4.5, { align: col.align });
          });
        }

        doc.setTextColor(0, 0, 0);
        return headerY + headerHeight;
      };

      let y = drawHeader();
      const rowHeight = 5.5;
      const bottomLimit = pageHeight - 20;

      rawRows.forEach((row, i) => {
        // Check for page break
        if (y + rowHeight > bottomLimit) {
          doc.addPage();
          pageNum++;
          y = drawHeader();
        }

        const isGroup = row.isGroup;
        const isTag = row.isTagAccount;
        const level = row.level || 0;

        // Styling based on account nature
        if (isGroup) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.5);
          doc.setFillColor(252, 252, 252);
          doc.rect(margin, y, contentWidth, rowHeight, "F");
        } else if (isTag) {
          doc.setFont("helvetica", "oblique");
          doc.setFontSize(7);
          doc.setTextColor(80, 80, 80);
        } else {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7);
          doc.setTextColor(0, 0, 0);
        }

        // Zebra striping
        if (!isGroup && !isTag && i % 2 === 1) {
          doc.setFillColor(248, 250, 252);
          doc.rect(margin, y, contentWidth, rowHeight, "F");
        }

        // Draw horizontal separator line
        doc.setDrawColor(230, 230, 230);
        doc.setLineWidth(0.15);
        doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);

        // 1. Sr
        doc.text((i + 1).toString(), colX[0] + columns[0].width / 2, y + 4, { align: "center" });

        // 2. Code
        doc.text(row.code || "", colX[1] + columns[1].width / 2, y + 4, { align: "center" });

        // 3. Description (indented)
        const indent = level * 3;
        const descName = isTag ? `↳ ${row.name}` : row.name;
        doc.text(descName, colX[2] + 2 + indent, y + 4);

        const pdfFmt = (val: number) => val > 0 ? val.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";

        if (isDetailed) {
          doc.text(pdfFmt(row.openingDebit || 0), colX[3] + columns[3].width - 2, y + 4, { align: "right" });
          doc.text(pdfFmt(row.openingCredit || 0), colX[4] + columns[4].width - 2, y + 4, { align: "right" });
          doc.text(pdfFmt(row.transactionDebit || 0), colX[5] + columns[5].width - 2, y + 4, { align: "right" });
          doc.text(pdfFmt(row.transactionCredit || 0), colX[6] + columns[6].width - 2, y + 4, { align: "right" });
          doc.text(pdfFmt(row.closingDebit || 0), colX[7] + columns[7].width - 2, y + 4, { align: "right" });
          doc.text(pdfFmt(row.closingCredit || 0), colX[8] + columns[8].width - 2, y + 4, { align: "right" });
        } else {
          if (showOpening) {
            doc.text(pdfFmt(row.openingDebit || 0), colX[3] + columns[3].width - 2, y + 4, { align: "right" });
            doc.text(pdfFmt(row.openingCredit || 0), colX[4] + columns[4].width - 2, y + 4, { align: "right" });
          } else {
            doc.text(pdfFmt(row.closingDebit || 0), colX[3] + columns[3].width - 2, y + 4, { align: "right" });
            doc.text(pdfFmt(row.closingCredit || 0), colX[4] + columns[4].width - 2, y + 4, { align: "right" });
          }
        }

        y += rowHeight;
        doc.setTextColor(0, 0, 0);
      });

      // Check for footer page break
      if (y + 12 > bottomLimit) {
        doc.addPage();
        pageNum++;
        y = drawHeader();
      }

      // Draw Totals row
      doc.setFillColor(235, 235, 235);
      doc.rect(margin, y, contentWidth, 7, "F");

      doc.setDrawColor(80, 80, 80);
      doc.setLineWidth(0.4);
      doc.line(margin, y, pageWidth - margin, y);
      doc.line(margin, y + 7, pageWidth - margin, y + 7);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("GRAND TOTAL", colX[2] + 2, y + 4.5);

      const pdfFmtBold = (val: number) => val.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

      if (isDetailed) {
        doc.text(pdfFmtBold(data.totalOpeningDebit ?? 0), colX[3] + columns[3].width - 2, y + 4.5, { align: "right" });
        doc.text(pdfFmtBold(data.totalOpeningCredit ?? 0), colX[4] + columns[4].width - 2, y + 4.5, { align: "right" });
        doc.text(pdfFmtBold(data.totalTransactionDebit ?? 0), colX[5] + columns[5].width - 2, y + 4.5, { align: "right" });
        doc.text(pdfFmtBold(data.totalTransactionCredit ?? 0), colX[6] + columns[6].width - 2, y + 4.5, { align: "right" });
        doc.text(pdfFmtBold(data.totalClosingDebit ?? 0), colX[7] + columns[7].width - 2, y + 4.5, { align: "right" });
        doc.text(pdfFmtBold(data.totalClosingCredit ?? 0), colX[8] + columns[8].width - 2, y + 4.5, { align: "right" });
      } else {
        if (showOpening) {
          doc.text(pdfFmtBold(data.totalOpeningDebit ?? 0), colX[3] + columns[3].width - 2, y + 4.5, { align: "right" });
          doc.text(pdfFmtBold(data.totalOpeningCredit ?? 0), colX[4] + columns[4].width - 2, y + 4.5, { align: "right" });
        } else {
          doc.text(pdfFmtBold(data.totalClosingDebit ?? data.totalDebit ?? 0), colX[3] + columns[3].width - 2, y + 4.5, { align: "right" });
          doc.text(pdfFmtBold(data.totalClosingCredit ?? data.totalCredit ?? 0), colX[4] + columns[4].width - 2, y + 4.5, { align: "right" });
        }
      }

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

      doc.save(`Trial_Balance_${format(new Date(), "yyyy-MM-dd")}.pdf`);
      toast.success("PDF report downloaded successfully!");
    } catch (err: any) {
      console.error("PDF Export error:", err);
      toast.error("Failed to generate PDF: " + err.message);
    } finally {
      toast.dismiss(toastId);
      setIsGeneratingPDF(false);
    }
  };

  const load = (from?: Date, to?: Date, includeTags?: boolean) => {
    startTransition(async () => {
      const res = await getTrialBalance(
        from ? format(from, "yyyy-MM-dd") : undefined,
        to   ? format(to,   "yyyy-MM-dd") : undefined,
        includeTags
      );
      if (res.status) setData(res.data);
    });
  };

  const showOpening = reportType === "OPENING" || reportType === "DETAILED";
  const showTransactions = reportType === "DETAILED";
  const showClosing = reportType === "CLOSING" || reportType === "DETAILED";

  const exportToCSV = () => {
    if (!data || rawRows.length === 0) return;
    
    const headers = ["Sr.No", "ACC.CODE", "ACCOUNT"];
    if (showOpening) { headers.push("OPENING DR", "OPENING CR"); }
    if (showTransactions) { headers.push("TX DR", "TX CR"); }
    if (showClosing) { headers.push("CLOSING DR", "CLOSING CR"); }
    
    const csvRows = [headers.join(",")];
    
    rawRows.forEach((row, i) => {
      const isTag = row.isTagAccount;
      const accountName = isTag ? `  -> ${row.name}` : row.name;
      const cleanName = `"${accountName.replace(/"/g, '""')}"`;
      const code = `"${row.code}"`;
      
      const r = [i + 1, code, cleanName];
      if (showOpening) { r.push(row.openingDebit, row.openingCredit); }
      if (showTransactions) { r.push(row.transactionDebit, row.transactionCredit); }
      if (showClosing) { r.push(row.closingDebit, row.closingCredit); }
      
      csvRows.push(r.join(","));
    });
    
    // Add totals row
    const totals = ["", "", "GRAND TOTAL"];
    if (showOpening) { totals.push(data.totalOpeningDebit || 0, data.totalOpeningCredit || 0); }
    if (showTransactions) { totals.push(data.totalTransactionDebit || 0, data.totalTransactionCredit || 0); }
    if (showClosing) { totals.push(data.totalClosingDebit ?? data.totalDebit ?? 0, data.totalClosingCredit ?? data.totalCredit ?? 0); }
    csvRows.push(totals.join(","));
    
    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Trial_Balance_${format(new Date(), "yyyy-MM-dd")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate the colSpan for the header "ACCOUNT"
  const totalCols = 3 
    + (showOpening ? 2 : 0) 
    + (showTransactions ? 2 : 0) 
    + (showClosing ? 2 : 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b flex flex-row items-center justify-between flex-wrap gap-3">
          <div>
            <CardTitle>Trial Balance</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {fromDate && toDate
                ? `Period: ${format(fromDate, "dd MMM yyyy")} – ${format(toDate, "dd MMM yyyy")}`
                : "All time (running balances)"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePDFExport} disabled={isGeneratingPDF}>
              <Printer className="h-4 w-4 mr-2" /> 
              {isGeneratingPDF ? "Generating..." : "Print PDF"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={isExporting}>
                  <Download className="h-4 w-4 mr-2" /> Export <ChevronDown className="h-3 w-3 ml-1.5 opacity-60" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportToCSV}>
                  Immediate CSV Export
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExcelExport} disabled={isExporting}>
                  Background Excel Export
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Filters */}
          <div className="space-y-4 p-4 rounded-lg border dark:border-border">
            <div className="flex flex-wrap items-end gap-6">
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
                  Expand All
                </Button>
                <Button variant="outline" size="sm" onClick={collapseAll} type="button">
                  Collapse All
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

              <div className="space-y-2">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Report Type</Label>
                <RadioGroup 
                  value={reportType} 
                  onValueChange={(val) => setReportType(val as ReportType)}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="OPENING" id="r-opening" />
                    <Label htmlFor="r-opening" className="cursor-pointer">Only Opening</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="CLOSING" id="r-closing" />
                    <Label htmlFor="r-closing" className="cursor-pointer">Only Closing</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="DETAILED" id="r-detailed" />
                    <Label htmlFor="r-detailed" className="cursor-pointer">All (Opening, Activity, Closing)</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2 pb-1">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <Checkbox
                    checked={includeTagAccounts}
                    onCheckedChange={(checked) => setIncludeTagAccounts(checked as boolean)}
                  />
                  <span className="text-sm font-medium group-hover:text-primary transition-colors">Include Sub-Accounts (Tags)</span>
                </label>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => load(fromDate, toDate, includeTagAccounts)} disabled={isPending}>
                  <RefreshCw className={cn("h-4 w-4 mr-2", isPending && "animate-spin")} />
                  {isPending ? "Loading…" : "Apply"}
                </Button>
                <Button variant="ghost" onClick={() => { setFromDate(undefined); setToDate(undefined); setIncludeTagAccounts(false); setReportType("DETAILED"); load(undefined, undefined, false); }}>
                  Reset
                </Button>
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

          {/* Table */}
          <div className="overflow-x-auto rounded-lg border dark:border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b dark:border-border">
                  <th rowSpan={2} className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider border-r">Sr.No</th>
                  <th rowSpan={2} className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider border-r">ACC.CODE</th>
                  <th rowSpan={2} className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider border-r">ACCOUNT</th>
                  {showOpening && <th colSpan={2} className="text-center px-4 py-2 font-semibold text-muted-foreground uppercase text-xs tracking-wider border-r border-b">Opening Balance</th>}
                  {showTransactions && <th colSpan={2} className="text-center px-4 py-2 font-semibold text-muted-foreground uppercase text-xs tracking-wider border-r border-b">Transactions</th>}
                  {showClosing && <th colSpan={2} className="text-center px-4 py-2 font-semibold text-muted-foreground uppercase text-xs tracking-wider">Closing Balance</th>}
                </tr>
                <tr className="bg-muted/40 border-b dark:border-border">
                  {showOpening && <>
                    <th className="text-right px-4 py-2 font-semibold text-muted-foreground uppercase text-xs tracking-wider">DR</th>
                    <th className="text-right px-4 py-2 font-semibold text-muted-foreground uppercase text-xs tracking-wider border-r">CR</th>
                  </>}
                  {showTransactions && <>
                    <th className="text-right px-4 py-2 font-semibold text-muted-foreground uppercase text-xs tracking-wider">DR</th>
                    <th className="text-right px-4 py-2 font-semibold text-muted-foreground uppercase text-xs tracking-wider border-r">CR</th>
                  </>}
                  {showClosing && <>
                    <th className="text-right px-4 py-2 font-semibold text-muted-foreground uppercase text-xs tracking-wider">DR</th>
                    <th className="text-right px-4 py-2 font-semibold text-muted-foreground uppercase text-xs tracking-wider">CR</th>
                  </>}
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={totalCols} className="text-center py-8 text-muted-foreground">
                      No accounts matching filters to display
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row, i) => {
                    const hasChildren = parentIdsSet.has(row.id);
                    return (
                      <TrialBalanceRow
                        key={row.id}
                        row={row}
                        index={i}
                        showOpening={showOpening}
                        showTransactions={showTransactions}
                        showClosing={showClosing}
                        onToggleCollapse={toggleCollapse}
                        isCollapsed={!!collapsedGroups[row.id]}
                        hasChildren={hasChildren}
                      />
                    );
                  })
                )}
              </tbody>
              <tfoot>
                <tr className="bg-muted/60 border-t-2 dark:border-border font-bold text-sm">
                  <td colSpan={3} className="px-4 py-3 text-right uppercase tracking-wider border-r">Grand Total</td>
                  {showOpening && <>
                    <td className="px-4 py-3 text-right font-mono">{fmt(data?.totalOpeningDebit ?? 0)}</td>
                    <td className="px-4 py-3 text-right font-mono border-r">{fmt(data?.totalOpeningCredit ?? 0)}</td>
                  </>}
                  {showTransactions && <>
                    <td className="px-4 py-3 text-right font-mono">{fmt(data?.totalTransactionDebit ?? 0)}</td>
                    <td className="px-4 py-3 text-right font-mono border-r">{fmt(data?.totalTransactionCredit ?? 0)}</td>
                  </>}
                  {showClosing && <>
                    <td className="px-4 py-3 text-right font-mono">{fmt(data?.totalClosingDebit ?? data?.totalDebit ?? 0)}</td>
                    <td className="px-4 py-3 text-right font-mono">{fmt(data?.totalClosingCredit ?? data?.totalCredit ?? 0)}</td>
                  </>}
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ── Print styles ── */}
      <style jsx global>{`
        @media print {
          body { visibility: hidden; }
          #tb-print-section {
            visibility: visible;
            position: fixed;
            top: 0; left: 0;
            width: 100vw;
            margin: 0; padding: 0;
            background: white;
            z-index: 9999;
          }
          #tb-print-section * { visibility: visible; }
          @page { margin: 15mm; size: A4 ${reportType === "DETAILED" ? "landscape" : "portrait"}; }
          header, nav, footer, aside, .print\\:hidden { display: none !important; }
        }
      `}</style>

      {/* ── Printable Report Layout ── */}
      {data && (
        <div id="tb-print-section" className="hidden print:block">
          <TrialBalancePrint 
            data={data} 
            reportType={reportType} 
            includeTagAccounts={includeTagAccounts} 
          />
        </div>
      )}
    </div>
  );
}
