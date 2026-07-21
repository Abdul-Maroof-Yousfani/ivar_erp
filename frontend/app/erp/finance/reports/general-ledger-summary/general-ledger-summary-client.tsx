"use client";

import * as React from "react";
import { format } from "date-fns";
import {
  Download,
  Printer,
  RefreshCw,
  BookOpen,
  Calendar,
  Tag,
  Keyboard,
  CheckSquare,
  Square,
  Check,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { ChartOfAccountSelect } from "@/components/ui/chart-of-account-select";
import { Autocomplete } from "@/components/ui/autocomplete";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ChartOfAccount } from "@/lib/actions/chart-of-account";
import {
  getGeneralLedgerSummary,
  GeneralLedgerSummaryResult,
  GeneralLedgerSummaryRow,
} from "@/lib/actions/finance-reports";
import { numberToWords } from "../journal-voucher/components/journal-voucher-print";
import { toast } from "sonner";

// Format PK standard integer format with brackets for negative numbers
const fmt = (n: number) => {
  const rounded = Math.round(n);
  if (rounded < 0) {
    return `(${Math.abs(rounded).toLocaleString("en-PK")})`;
  }
  return rounded.toLocaleString("en-PK");
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

export function GeneralLedgerSummaryClient({
  accounts,
}: {
  accounts: ChartOfAccount[];
}) {
  const [parentAccountId, setParentAccountId] = React.useState("");
  const [fromDate, setFromDate] = React.useState<Date | undefined>(
    new Date(new Date().getFullYear(), 0, 1),
  );
  const [toDate, setToDate] = React.useState<Date | undefined>(new Date());

  const [data, setData] = React.useState<GeneralLedgerSummaryResult | undefined>();
  const [isPending, startTransition] = React.useTransition();

  // Selection states
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [fromSerial, setFromSerial] = React.useState("");
  const [toSerial, setToSerial] = React.useState("");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [fromAccountId, setFromAccountId] = React.useState<string | null>(null);
  const [toAccountId, setToAccountId] = React.useState<string | null>(null);

  // Keyboard navigation on list
  const [focusedIndex, setFocusedIndex] = React.useState<number>(-1);

  // Find selected parent account in the tree to check for sub-accounts
  const selectedParentInTree = React.useMemo(() => {
    if (!parentAccountId || accounts.length === 0) return null;
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
    return findInTree(accounts, parentAccountId);
  }, [parentAccountId, accounts]);

  const subAccounts = React.useMemo(() => {
    return selectedParentInTree?.children ?? [];
  }, [selectedParentInTree]);

  // Filtered subaccounts based on search input
  const filteredSubAccounts = React.useMemo(() => {
    if (!searchQuery.trim()) return subAccounts;
    const q = searchQuery.toLowerCase();
    return subAccounts.filter(
      (sa) =>
        sa.code.toLowerCase().includes(q) ||
        sa.name.toLowerCase().includes(q)
    );
  }, [subAccounts, searchQuery]);

  // Autocomplete options mapped from sub-accounts list
  const autocompleteOptions = React.useMemo(() => {
    return subAccounts.map((sa) => ({
      value: sa.id,
      label: `${sa.code} — ${sa.name}`,
    }));
  }, [subAccounts]);

  // Reset/select all sub-accounts on parent account selection
  React.useEffect(() => {
    if (subAccounts.length > 0) {
      const allIds = new Set(subAccounts.map((child) => child.id));
      setSelectedIds(allIds);
      setFocusedIndex(0);
    } else {
      setSelectedIds(new Set());
      setFocusedIndex(-1);
    }
    setFromSerial("");
    setToSerial("");
    setFromAccountId(null);
    setToAccountId(null);
  }, [subAccounts]);

  const toggleSelectAllFiltered = () => {
    const filteredIds = filteredSubAccounts.map((sa) => sa.id);
    const allFilteredSelected = filteredIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredIds.forEach((id) => next.delete(id));
      } else {
        filteredIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  // Keyboard list interactions
  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Global shortcut: Ctrl+Enter loads summary directly
      if (e.key === "Enter" && e.ctrlKey) {
        e.preventDefault();
        loadLedgerSummary();
        return;
      }

      // Do not intercept keyboard actions if typing in input fields (except search or range input fields if needed)
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (filteredSubAccounts.length === 0) return;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIndex((prev) => Math.min(prev + 1, filteredSubAccounts.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === " ") {
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < filteredSubAccounts.length) {
          const focusedSa = filteredSubAccounts[focusedIndex];
          setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(focusedSa.id)) {
              next.delete(focusedSa.id);
            } else {
              next.add(focusedSa.id);
            }
            return next;
          });
        }
      } else if (e.key.toLowerCase() === "a" && e.ctrlKey) {
        e.preventDefault();
        setSelectedIds(new Set(subAccounts.map((sa) => sa.id)));
        toast.success("Selected all sub-accounts");
      } else if (e.key.toLowerCase() === "c" && e.ctrlKey) {
        e.preventDefault();
        setSelectedIds(new Set());
        toast.success("Cleared selection");
      } else if (e.key === "[") {
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < filteredSubAccounts.length) {
          const sa = filteredSubAccounts[focusedIndex];
          setFromAccountId(sa.id);
          toast.success(`Set From Account to: ${sa.name}`);
        }
      } else if (e.key === "]") {
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < filteredSubAccounts.length) {
          const sa = filteredSubAccounts[focusedIndex];
          setToAccountId(sa.id);
          toast.success(`Set To Account to: ${sa.name}`);
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [filteredSubAccounts, focusedIndex, parentAccountId, selectedIds]);

  // Set Range Selection when From & To Accounts are chosen
  React.useEffect(() => {
    if (fromAccountId && toAccountId) {
      const fromIdx = subAccounts.findIndex((sa) => sa.id === fromAccountId);
      const toIdx = subAccounts.findIndex((sa) => sa.id === toAccountId);
      if (fromIdx !== -1 && toIdx !== -1) {
        const min = Math.min(fromIdx, toIdx);
        const max = Math.max(fromIdx, toIdx);
        const newSelected = new Set<string>(); // INSTANTLY DESELECT PREVIOUS
        subAccounts.forEach((sa, idx) => {
          if (idx >= min && idx <= max) {
            newSelected.add(sa.id);
          }
        });
        setSelectedIds(newSelected);
      }
    }
  }, [fromAccountId, toAccountId]);

  // Scroll active/focused element into view automatically
  React.useEffect(() => {
    if (focusedIndex >= 0 && filteredSubAccounts[focusedIndex]) {
      const activeId = filteredSubAccounts[focusedIndex].id;
      const container = document.getElementById("subaccounts-list-container");
      const item = document.getElementById(`subaccount-item-${activeId}`);
      if (container && item) {
        item.scrollIntoView({ block: "nearest", behavior: "auto" });
      }
    }
  }, [focusedIndex, filteredSubAccounts]);

  const applySerialRange = () => {
    const fromVal = parseInt(fromSerial, 10);
    const toVal = parseInt(toSerial, 10);
    if (isNaN(fromVal) || isNaN(toVal)) {
      toast.error("Please enter valid From and To serial numbers.");
      return;
    }
    const min = Math.min(fromVal, toVal);
    const max = Math.max(fromVal, toVal);
    const fromSa = subAccounts[min - 1];
    const toSa = subAccounts[max - 1];
    if (fromSa && toSa) {
      setFromAccountId(fromSa.id);
      setToAccountId(toSa.id);
      toast.success(`Selected sub-accounts from serial #${min} to #${max}`);
    } else {
      toast.error("Invalid serial range.");
    }
  };

  const loadLedgerSummary = () => {
    if (!parentAccountId) {
      toast.error("Please select a Chart of Account head.");
      return;
    }
    if (selectedIds.size === 0) {
      toast.error("Please select at least one sub-account.");
      return;
    }

    startTransition(async () => {
      const res = await getGeneralLedgerSummary(
        parentAccountId,
        Array.from(selectedIds),
        fromDate ? getLocalStartOfDayISO(fromDate) : undefined,
        toDate ? getLocalEndOfDayISO(toDate) : undefined,
      );
      if (res.status && res.data) {
        setData(res.data);
        toast.success("Subaccount summary loaded successfully.");
      } else {
        toast.error(res.message || "Failed to load report.");
      }
    });
  };

  // CSV Export
  const exportToCSV = () => {
    if (!data) return;
    const headers = [
      "Account Code",
      "Account Title",
      "Opening Balance",
      "Debit Activity",
      "Credit Activity",
      "Closing Balance",
    ];

    const rows = data.rows.map((r) => [
      `${data.parentAccount.code} ${r.code}`,
      r.name,
      r.openingBalance.toFixed(2),
      r.debit.toFixed(2),
      r.credit.toFixed(2),
      r.closingBalance.toFixed(2),
    ]);

    const csvContent = [
      [`General Ledger Subaccount Summary - ${data.parentAccount.code} - ${data.parentAccount.name}`],
      [
        `Period: ${fromDate ? format(fromDate, "dd-MMM-yyyy") : "Beginning"} to ${toDate ? format(toDate, "dd-MMM-yyyy") : "Present"}`,
      ],
      [],
      headers,
      ...rows,
      [
        "Grand Total",
        "",
        data.totals.openingBalance.toFixed(2),
        data.totals.debit.toFixed(2),
        data.totals.credit.toFixed(2),
        data.totals.closingBalance.toFixed(2),
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
      `gl-subaccount-summary-${data.parentAccount.code}-${format(new Date(), "yyyyMMdd")}.csv`,
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      {/* SCREEN VIEW */}
      <div className="space-y-6 animate-in fade-in duration-300 print:hidden">
        <Card className="border-border/50 shadow-lg bg-card">
          <CardHeader className="border-b dark:border-border/50 flex flex-row items-center justify-between flex-wrap gap-4 py-5 bg-muted/20">
            <div>
              <CardTitle className="text-xl font-bold tracking-tight bg-gradient-to-r from-primary to-indigo-500 bg-clip-text text-transparent">
                GL Subaccount Summary
              </CardTitle>
              {data && (
                <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
                  <span className="font-semibold px-2 py-0.5 bg-muted rounded-full border">
                    {data.parentAccount.code} — {data.parentAccount.name}
                  </span>
                  <span>•</span>
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
                disabled={!data || data.rows.length === 0}
                className="h-9 hover:bg-accent text-xs"
              >
                <Printer className="h-3.5 w-3.5 mr-2 text-muted-foreground" />{" "}
                Print / PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={exportToCSV}
                disabled={!data || data.rows.length === 0}
                className="h-9 hover:bg-accent text-xs"
              >
                <Download className="h-3.5 w-3.5 mr-2 text-muted-foreground" />{" "}
                Export (CSV)
              </Button>
            </div>
          </CardHeader>

          <CardContent className="pt-6 space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Keyboard-driven sub-account list selection (4 cols) */}
              <div className="lg:col-span-4 border rounded-xl p-4 bg-muted/5 flex flex-col h-[750px] space-y-4">
                <div className="space-y-3 flex-shrink-0">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <BookOpen className="h-3 w-3 text-primary/70" /> Parent Account
                    </Label>
                    <ChartOfAccountSelect
                      accounts={accounts}
                      value={parentAccountId}
                      onValueChange={(val) => setParentAccountId(val)}
                      placeholder="Select parent account..."
                      allowGroups={true}
                      excludeTags
                      className="h-10 text-sm shadow-sm"
                    />
                  </div>

                  {subAccounts.length > 0 && (
                    <div className="space-y-3 bg-muted/10 p-3 rounded-lg border border-border/50 text-xs">
                      <div className="flex justify-between items-center font-bold text-[9px] uppercase tracking-wider text-muted-foreground">
                        <span>Range Selection</span>
                        {(fromAccountId || toAccountId) && (
                          <button
                            onClick={() => {
                              setFromAccountId(null);
                              setToAccountId(null);
                            }}
                            className="text-[9px] text-rose-500 font-bold hover:underline"
                          >
                            Reset Range
                          </button>
                        )}
                      </div>

                      {/* From Account Autocomplete */}
                      <div className="space-y-1">
                        <Label className="text-[9px] font-semibold text-muted-foreground">From Account</Label>
                        <Autocomplete
                          options={autocompleteOptions}
                          value={fromAccountId || ""}
                          onValueChange={(val) => setFromAccountId(val || null)}
                          placeholder="Select From Sub-account..."
                          searchPlaceholder="Search by code or title..."
                          className="h-8 text-xs font-medium bg-background"
                        />
                      </div>

                      {/* To Account Autocomplete */}
                      <div className="space-y-1">
                        <Label className="text-[9px] font-semibold text-muted-foreground">To Account</Label>
                        <Autocomplete
                          options={autocompleteOptions}
                          value={toAccountId || ""}
                          onValueChange={(val) => setToAccountId(val || null)}
                          placeholder="Select To Sub-account..."
                          searchPlaceholder="Search by code or title..."
                          className="h-8 text-xs font-medium bg-background"
                        />
                      </div>

                      {/* Serial Selection Range boxes */}
                      <div className="grid grid-cols-2 gap-2 border-t pt-2 mt-2">
                        <div className="space-y-1">
                          <Label className="text-[9px] font-semibold text-muted-foreground">From Serial</Label>
                          <Input
                            type="number"
                            placeholder="1"
                            value={fromSerial}
                            onChange={(e) => setFromSerial(e.target.value)}
                            className="h-7 text-xs font-mono"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[9px] font-semibold text-muted-foreground">To Serial</Label>
                          <Input
                            type="number"
                            placeholder={subAccounts.length.toString()}
                            value={toSerial}
                            onChange={(e) => setToSerial(e.target.value)}
                            className="h-7 text-xs font-mono"
                          />
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={applySerialRange}
                        className="w-full h-7 text-[10px] font-bold shadow-sm"
                      >
                        Select Range By Serial
                      </Button>
                    </div>
                  )}
                </div>

                {subAccounts.length > 0 && (
                  <div className="flex-1 flex flex-col min-h-0 border rounded-lg bg-background">
                    {/* Header bar of checklist */}
                    <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/20 text-xs font-bold flex-shrink-0">
                      <span>Sub-accounts ({filteredSubAccounts.length})</span>
                      <button
                        type="button"
                        onClick={toggleSelectAllFiltered}
                        className="text-primary hover:underline font-semibold"
                      >
                        {filteredSubAccounts.every((sa) => selectedIds.has(sa.id)) ? "Deselect Filtered" : "Select Filtered"}
                      </button>
                    </div>

                    {/* Search Bar for Subaccounts */}
                    <div className="p-2 border-b bg-muted/5 flex-shrink-0">
                      <div className="relative">
                        <Input
                          placeholder="Search sub-accounts by code/name..."
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setFocusedIndex(0);
                          }}
                          className="h-8 text-xs pl-8"
                        />
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground/60" />
                        {searchQuery && (
                          <button
                            type="button"
                            onClick={() => setSearchQuery("")}
                            className="absolute right-2.5 top-2 text-[10px] font-bold text-muted-foreground hover:text-foreground"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Scrollable list with focused row visual indicator */}
                    <div
                      id="subaccounts-list-container"
                      className="flex-1 overflow-y-auto p-1 divide-y divide-border/40 select-none scroll-smooth"
                    >
                      {filteredSubAccounts.map((child, idx) => {
                        const serial = subAccounts.findIndex((sa) => sa.id === child.id) + 1;
                        const isSelected = selectedIds.has(child.id);
                        const isFocused = focusedIndex === idx;

                        return (
                          <div
                            key={child.id}
                            id={`subaccount-item-${child.id}`}
                            onClick={() => {
                              setSelectedIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(child.id)) next.delete(child.id);
                                else next.add(child.id);
                                return next;
                              });
                              setFocusedIndex(idx);
                            }}
                            className={cn(
                              "flex items-center gap-2 px-2 py-1.5 text-xs cursor-pointer transition-colors rounded group justify-between",
                              isFocused
                                ? "bg-accent text-accent-foreground border-l-2 border-primary"
                                : "hover:bg-accent/40",
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono text-[9px] text-muted-foreground w-6 text-right shrink-0">
                                {serial}.
                              </span>
                              {isSelected ? (
                                <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" />
                              ) : (
                                <Square className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                              )}
                              <div className="min-w-0 leading-tight">
                                <p className="font-mono text-[10px] font-semibold text-foreground truncate">
                                  {child.code}
                                </p>
                                <p className="text-muted-foreground text-[10px] truncate">
                                  {child.name}
                                </p>
                              </div>
                            </div>

                            {/* Range set buttons & indicators */}
                            <div className="flex items-center gap-1.5 shrink-0">
                              {fromAccountId === child.id && (
                                <span className="text-[7px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-1 rounded font-extrabold uppercase scale-90">
                                  From
                                </span>
                              )}
                              {toAccountId === child.id && (
                                <span className="text-[7px] bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 px-1 rounded font-extrabold uppercase scale-90">
                                  To
                                </span>
                              )}

                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFromAccountId(child.id);
                                    toast.success(`Set start account: ${child.name}`);
                                  }}
                                  className={cn(
                                    "px-1 py-0.5 rounded text-[8px] font-extrabold border bg-background hover:bg-accent shadow-sm",
                                    fromAccountId === child.id && "bg-emerald-50 border-emerald-300 text-emerald-700"
                                  )}
                                >
                                  From
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setToAccountId(child.id);
                                    toast.success(`Set end account: ${child.name}`);
                                  }}
                                  className={cn(
                                    "px-1 py-0.5 rounded text-[8px] font-extrabold border bg-background hover:bg-accent shadow-sm",
                                    toAccountId === child.id && "bg-indigo-50 border-indigo-300 text-indigo-700"
                                  )}
                                >
                                  To
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {filteredSubAccounts.length === 0 && (
                        <div className="p-4 text-center text-muted-foreground text-xs">
                          No sub-accounts match the search query.
                        </div>
                      )}
                    </div>

                    <div className="px-2 py-1.5 bg-muted/15 border-t text-[8px] text-muted-foreground flex justify-between flex-wrap gap-1">
                      <span>[⇅] Focus row</span>
                      <span>[Space] Toggle</span>
                      <span>[ [ / ] ] Set From/To</span>
                      <span>[Ctrl+A/C] Select/Clear</span>
                      <span>[Ctrl+Enter] Load Summary</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Loading Ledger Summary & Result Table (8 cols) */}
              <div className="lg:col-span-8 flex flex-col space-y-4">
                {/* Date range selection + Load trigger */}
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end p-4 border rounded-xl bg-muted/10 shadow-sm">
                  <div className="sm:col-span-6 space-y-1.5">
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
                      triggerClassName="h-10 text-sm w-full bg-background shadow-sm"
                    />
                  </div>

                  <div className="sm:col-span-6">
                    <Button
                      onClick={loadLedgerSummary}
                      disabled={isPending || !parentAccountId || selectedIds.size === 0}
                      className="h-10 w-full font-medium text-sm shadow-md transition-all hover:translate-y-[-1px] active:translate-y-[0px] bg-gradient-to-r from-primary to-indigo-600 hover:from-primary/95 hover:to-indigo-600/95"
                    >
                      <RefreshCw className={cn("h-4 w-4 mr-2", isPending && "animate-spin")} />
                      {isPending ? "Loading..." : "Load Subaccount Summary"}
                    </Button>
                  </div>
                </div>

                {!data && (
                  <div className="flex flex-col items-center justify-center h-[350px] text-muted-foreground border border-dashed rounded-xl p-8 bg-muted/5">
                    <Tag className="h-10 w-10 text-muted-foreground/35 mb-3 stroke-[1.5]" />
                    <p className="text-sm font-medium">No report loaded</p>
                    <p className="text-xs text-muted-foreground/70 mt-1 max-w-[340px] text-center">
                      Select a parent account and check the desired sub-accounts from the list, then click "Load Subaccount Summary".
                    </p>
                  </div>
                )}

                {data && (
                  <div className="overflow-x-auto rounded-xl border shadow-sm bg-card">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        {/* Row 1 Headers */}
                        <tr className="bg-muted/30 border-b text-muted-foreground/80 font-medium border-border/80">
                          <th
                            rowSpan={2}
                            className="text-left px-4 py-3 font-bold uppercase text-[9px] tracking-wider border-r border-border/80"
                          >
                            Account Code & Title
                          </th>
                          <th
                            rowSpan={2}
                            className="text-right px-4 py-3 font-bold uppercase text-[9px] tracking-wider border-r border-border/80 w-32"
                          >
                            Opening
                          </th>
                          <th
                            colSpan={2}
                            className="text-center py-2 font-bold uppercase text-[9px] tracking-wider border-r border-border/80 border-b border-border/50"
                          >
                            Activity
                          </th>
                          <th
                            rowSpan={2}
                            className="text-right px-4 py-3 font-bold uppercase text-[9px] tracking-wider w-32"
                          >
                            Closing
                          </th>
                        </tr>
                        {/* Row 2 Activity Subheaders */}
                        <tr className="bg-muted/20 border-b text-muted-foreground/80 font-medium border-border/80">
                          <th className="text-right px-4 py-2 font-semibold uppercase text-[9px] tracking-wider border-r border-border/50 w-28">
                            Debit
                          </th>
                          <th className="text-right px-4 py-2 font-semibold uppercase text-[9px] tracking-wider border-r border-border/80 w-28">
                            Credit
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.rows.length === 0 && (
                          <tr>
                            <td
                              colSpan={5}
                              className="px-4 py-12 text-center text-muted-foreground font-medium bg-muted/5 border-b"
                            >
                              No sub-account rows generated in this selection.
                            </td>
                          </tr>
                        )}

                        {data.rows.map((row, i) => (
                          <tr
                            key={row.id}
                            className={cn(
                              "border-b border-border/50 hover:bg-accent/40 transition-colors",
                              i % 2 === 1 && "bg-muted/5",
                            )}
                          >
                            {/* Code and Title */}
                            <td className="px-4 py-3 border-r font-mono text-[10px] leading-tight text-foreground flex justify-between gap-4">
                              <span>
                                {data.parentAccount.code} {row.code}
                              </span>
                              <span className="font-sans text-muted-foreground text-[10px] truncate max-w-[280px]">
                                {row.name}
                              </span>
                            </td>

                            {/* Opening */}
                            <td
                              className={cn(
                                "px-4 py-3 text-right border-r font-mono font-medium",
                                row.openingBalance < 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground",
                              )}
                            >
                              {fmt(row.openingBalance)}
                            </td>

                            {/* Debit Activity */}
                            <td className="px-4 py-3 text-right border-r border-border/50 font-mono text-muted-foreground">
                              {row.debit > 0 ? fmt(row.debit) : "—"}
                            </td>

                            {/* Credit Activity */}
                            <td className="px-4 py-3 text-right border-r font-mono text-muted-foreground">
                              {row.credit > 0 ? fmt(row.credit) : "—"}
                            </td>

                            {/* Closing */}
                            <td
                              className={cn(
                                "px-4 py-3 text-right font-mono font-bold",
                                row.closingBalance < 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground",
                              )}
                            >
                              {fmt(row.closingBalance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>

                      {/* Grand Total Footer */}
                      <tfoot>
                        <tr className="bg-muted/30 border-t-2 border-border font-bold text-foreground">
                          <td className="px-4 py-3.5 text-left border-r uppercase tracking-wider font-extrabold text-[10px] text-muted-foreground">
                            Grand Total
                          </td>
                          <td
                            className={cn(
                              "px-4 py-3.5 text-right border-r font-mono",
                              data.totals.openingBalance < 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground",
                            )}
                          >
                            {fmt(data.totals.openingBalance)}
                          </td>
                          <td className="px-4 py-3.5 text-right border-r border-border/50 font-mono text-indigo-600">
                            {fmt(data.totals.debit)}
                          </td>
                          <td className="px-4 py-3.5 text-right border-r font-mono text-rose-600">
                            {fmt(data.totals.credit)}
                          </td>
                          <td
                            className={cn(
                              "px-4 py-3.5 text-right font-mono font-extrabold",
                              data.totals.closingBalance < 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground",
                            )}
                          >
                            {fmt(data.totals.closingBalance)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PRINT LAYOUT SECTION (HIDDEN ON SCREEN, SHOWN ON PRINT) */}
      {data && (
        <div
          id="general-ledger-summary-print-section"
          className="hidden print:block font-sans text-black p-4 bg-white min-h-screen leading-normal w-full max-w-[1000px] mx-auto box-border"
        >
          <style
            dangerouslySetInnerHTML={{
              __html: `
            @media print {
              body * {
                visibility: hidden !important;
              }
              #general-ledger-summary-print-section,
              #general-ledger-summary-print-section * {
                visibility: visible !important;
              }
              #general-ledger-summary-print-section {
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

          {/* Heading block */}
          <div className="flex justify-between items-start border-b border-black pb-1 mb-2">
            <div>
              <h1 className="text-md font-bold uppercase tracking-wide">
                General Ledger (Subaccount Summary)
              </h1>
            </div>
            <div className="text-right">
              <p className="text-[8px] mt-0.5">
                Form {fromDate ? format(fromDate, "dd/MM/yyyy") : "Beginning"} To{" "}
                {toDate ? format(toDate, "dd/MM/yyyy") : "Present"}
              </p>
            </div>
          </div>

          {/* Table */}
          <table className="w-full text-[8px] mb-2 border-collapse table-fixed">
            <thead>
              {/* Row 1 Headers */}
              <tr className="border-t border-b border-black font-bold text-left bg-gray-50">
                <th className="py-1.5 pr-1 w-[46%] text-left">
                  Account Code And Title
                </th>
                <th className="py-1.5 pr-1 text-right w-[18%]">
                  Opening
                </th>
                <th
                  colSpan={2}
                  className="py-1 pr-1 text-center w-[24%] border-b border-gray-300"
                >
                  Activity
                </th>
                <th className="py-1.5 text-right w-[18%]">
                  Closing
                </th>
              </tr>
              {/* Row 2 Headers */}
              <tr className="border-b border-black font-bold text-right bg-gray-50">
                <th colSpan={2} /> {/* Skip columns 1 & 2 */}
                <th className="py-1 pr-1 text-right w-[12%]">Debit</th>
                <th className="py-1 pr-1 text-right w-[12%] border-r border-black/10">Credit</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-4 text-center text-gray-500 border-b border-gray-300"
                  >
                    No sub-accounts selected.
                  </td>
                </tr>
              )}

              {data.rows.map((row) => (
                <tr key={row.id} className="border-b border-gray-200 align-top">
                  {/* Account Code & Title */}
                  <td className="py-1 pr-1 font-mono text-[8px] text-left">
                    <div className="flex justify-between pr-4">
                      <span>
                        {data.parentAccount.code} {row.code}
                      </span>
                      <span className="font-sans text-gray-800 text-[8px] truncate max-w-[200px]">
                        {row.name}
                      </span>
                    </div>
                  </td>

                  {/* Opening */}
                  <td className="py-1 pr-1 text-right font-mono text-[8px]">
                    {fmt(row.openingBalance)}
                  </td>

                  {/* Debit */}
                  <td className="py-1 pr-1 text-right font-mono text-[8px] text-gray-700">
                    {row.debit > 0 ? fmt(row.debit) : "0"}
                  </td>

                  {/* Credit */}
                  <td className="py-1 pr-1 text-right font-mono text-[8px] text-gray-700">
                    {row.credit > 0 ? fmt(row.credit) : "0"}
                  </td>

                  {/* Closing */}
                  <td className="py-1 text-right font-mono font-bold text-[8px]">
                    {fmt(row.closingBalance)}
                  </td>
                </tr>
              ))}
            </tbody>

            <tfoot>
              {/* Grand Total Row */}
              <tr className="border-t border-black font-bold">
                <td className="py-2 text-left text-[9px]">Grand Total</td>
                <td
                  className="py-2 pr-1 text-right font-mono text-[8px]"
                  style={{ borderBottom: "2px double black" }}
                >
                  {fmt(data.totals.openingBalance)}
                </td>
                <td
                  className="py-2 pr-1 text-right font-mono text-[8px]"
                  style={{ borderBottom: "2px double black" }}
                >
                  {fmt(data.totals.debit)}
                </td>
                <td
                  className="py-2 pr-1 text-right font-mono text-[8px]"
                  style={{ borderBottom: "2px double black" }}
                >
                  {fmt(data.totals.credit)}
                </td>
                <td
                  className="py-2 text-right font-mono font-bold text-[8px]"
                  style={{ borderBottom: "2px double black" }}
                >
                  {fmt(data.totals.closingBalance)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </>
  );
}
