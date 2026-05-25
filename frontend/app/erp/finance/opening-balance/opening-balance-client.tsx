"use client";

import { useState, useEffect, useTransition } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Autocomplete } from "@/components/ui/autocomplete";
import { CalendarIcon, Save } from "lucide-react";
import { cn } from "@/lib/utils";
import { getChartOfAccounts } from "@/lib/actions/chart-of-account";
import { saveOpeningBalance } from "@/lib/actions/opening-balance";
import { toast } from "sonner";

interface Account {
  id: string;
  code: string;
  name: string;
  type: string;
  balance: number;
  isGroup: boolean;
  level: number;
  children?: Account[];
}

interface OpeningBalanceEntry {
  accountId: string;
  type: "DEBIT" | "CREDIT";
  amount: number;
}

export function OpeningBalanceClient() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [flatAccounts, setFlatAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<Record<string, OpeningBalanceEntry>>({});
  const [date, setDate] = useState<Date>(new Date());
  const [isPending, startTransition] = useTransition();
  const [companyName, setCompanyName] = useState("Speed pvt.LD");

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    const res = await getChartOfAccounts();
    if (res.data) {
      setAccounts(res.data);
      const flat = flattenAccounts(res.data);
      setFlatAccounts(flat);
      
      // Initialize entries
      const initialEntries: Record<string, OpeningBalanceEntry> = {};
      flat.forEach(acc => {
        if (!acc.isGroup) {
          initialEntries[acc.id] = {
            accountId: acc.id,
            type: acc.type === "ASSET" || acc.type === "EXPENSE" ? "DEBIT" : "CREDIT",
            amount: 0,
          };
        }
      });
      setEntries(initialEntries);
    }
  };

  const flattenAccounts = (accounts: Account[], level = 0): Account[] => {
    let result: Account[] = [];
    accounts.forEach(acc => {
      result.push({ ...acc, level });
      if (acc.children && acc.children.length > 0) {
        result = result.concat(flattenAccounts(acc.children, level + 1));
      }
    });
    return result;
  };

  const handleTypeChange = (accountId: string, type: "DEBIT" | "CREDIT") => {
    setEntries(prev => ({
      ...prev,
      [accountId]: { ...prev[accountId], type },
    }));
  };

  const transactionTypeOptions = [
    { value: "DEBIT", label: "Debit" },
    { value: "CREDIT", label: "Credit" },
  ];

  const handleAmountChange = (accountId: string, amount: string) => {
    const numAmount = parseFloat(amount) || 0;
    setEntries(prev => ({
      ...prev,
      [accountId]: { ...prev[accountId], amount: numAmount },
    }));
  };

  const handleSave = async (accountId: string) => {
    const entry = entries[accountId];
    if (!entry || entry.amount === 0) {
      toast.error("Please enter an amount");
      return;
    }

    startTransition(async () => {
      const res = await saveOpeningBalance({
        accountId: entry.accountId,
        type: entry.type,
        amount: entry.amount,
        date: format(date, "yyyy-MM-dd"),
      });

      if (res.status) {
        toast.success("Opening balance saved successfully");
        // Reload accounts to update balances
        loadAccounts();
      } else {
        toast.error(res.message || "Failed to save opening balance");
      }
    });
  };

  const renderAccountRow = (account: Account, index: number) => {
    if (account.isGroup) {
      return (
        <tr key={account.id} className="bg-muted/20 border-t dark:border-border">
          <td colSpan={6} className="px-4 py-2 font-bold text-xs uppercase tracking-widest text-muted-foreground">
            {account.code} - {account.name}
          </td>
        </tr>
      );
    }

    const entry = entries[account.id];
    if (!entry) return null;

    return (
      <tr key={account.id} className="border-b dark:border-border/50 hover:bg-accent/30">
        <td className="px-4 py-2 text-center font-mono text-xs">{index + 1}</td>
        <td className="px-4 py-2 font-mono text-xs text-muted-foreground">{account.code}</td>
        <td className="px-4 py-2">
          <div className="font-medium" style={{ paddingLeft: `${account.level * 20}px` }}>
            {account.name}
          </div>
        </td>
        <td className="px-4 py-2">
          <Autocomplete
            options={transactionTypeOptions}
            value={entry.type}
            onValueChange={(val) => handleTypeChange(account.id, val as "DEBIT" | "CREDIT")}
            placeholder="Select Type"
            searchPlaceholder="Search type..."
            className="w-full"
          />
        </td>
        <td className="px-4 py-2">
          <Input
            type="number"
            step="0.01"
            value={entry.amount || ""}
            onChange={(e) => handleAmountChange(account.id, e.target.value)}
            className="text-right font-mono"
            placeholder="0.00"
          />
        </td>
        <td className="px-4 py-2 text-center">
          <Button
            size="sm"
            onClick={() => handleSave(account.id)}
            disabled={isPending || entry.amount === 0}
            className="bg-green-600 hover:bg-green-700"
          >
            <Save className="h-4 w-4 mr-1" />
            Save
          </Button>
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Create Opening Balance</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Printed On Date: {format(new Date(), "dd-MM-yyyy")}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Printed On Day: {format(new Date(), "EEEE")}</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Company Name and Date */}
          <div className="text-center">
            <h2 className="text-xl font-bold">{companyName}</h2>
          </div>

          {/* Date Picker */}
          <div className="flex items-center gap-4">
            <Label className="text-sm font-medium">Opening Balance Date:</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[240px] justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "PPP") : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => d && setDate(d)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Accounts Table */}
          <div className="overflow-x-auto rounded-lg border dark:border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b dark:border-border">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider">Sr No</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider">Code</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider">Account Name</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider">Transaction Type</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider">Opening Balance</th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground uppercase text-xs tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody>
                {flatAccounts.map((account, index) => renderAccountRow(account, index))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
