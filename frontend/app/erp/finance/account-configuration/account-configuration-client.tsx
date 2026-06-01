"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Autocomplete } from "@/components/ui/autocomplete";
import { toast } from "sonner";
import { 
  Save, 
  RotateCcw, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  SlidersHorizontal,
  BookmarkCheck,
  HelpCircle,
  TrendingUp,
  Sparkles,
  ShoppingBag,
  BadgePercent,
  Coins,
  Warehouse,
  Users2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getChartOfAccounts } from "@/lib/actions/chart-of-account";
import { 
  getFinanceAccountConfigs, 
  upsertFinanceAccountConfig, 
  bulkUpsertFinanceAccountConfigs, 
  deleteFinanceAccountConfig 
} from "@/lib/actions/finance-account-config";

interface ChartAccount {
  id: string;
  code: string;
  name: string;
  type: string;
  isGroup: boolean;
  level?: number;
  children?: ChartAccount[];
}

interface BackendConfig {
  id: string;
  key: string;
  accountId: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  account?: {
    id: string;
    code: string;
    name: string;
    type: string;
  };
}

const CATEGORY_MAP = [
  { value: "purchases", label: "Purchases & AP", icon: ShoppingBag },
  { value: "sales", label: "Sales & AR", icon: TrendingUp },
  { value: "tax", label: "Taxes & WHT", icon: BadgePercent },
  { value: "inventory", label: "Inventory & COGS", icon: Warehouse },
  { value: "pos", label: "POS & Vouchers", icon: Coins },
  { value: "payroll", label: "Payroll Liabilities", icon: Users2 },
  { value: "financial", label: "Financial Charges", icon: SlidersHorizontal }
];

const ROLE_METADATA: Record<string, { title: string; desc: string; category: string }> = {
  // Purchases & AP
  PURCHASES_LOCAL: {
    title: "Purchases (Local)",
    desc: "Debit when a local purchase invoice is approved",
    category: "purchases"
  },
  PURCHASES_IMPORT: {
    title: "Purchases (Import)",
    desc: "Debit when an import purchase invoice is approved",
    category: "purchases"
  },
  PURCHASES_CONSIGNMENT: {
    title: "Purchases (Consignment)",
    desc: "Debit when a consignment purchase invoice is approved",
    category: "purchases"
  },
  PURCHASES_RETURN: {
    title: "Purchase Returns",
    desc: "Credit on purchase return or debit note",
    category: "purchases"
  },
  ADVANCE_TO_SUPPLIERS: {
    title: "Advance to Suppliers",
    desc: "Asset debit on advance payment; credit on application",
    category: "purchases"
  },
  AP_PARTIES: {
    title: "Accounts Payable Fallback",
    desc: "AP liability fallback if supplier has no linked account",
    category: "purchases"
  },

  // Sales & AR
  SALES_REVENUE_RETAIL: {
    title: "Sales Revenue (Retail/POS)",
    desc: "Credit on retail sales invoices (excl. tax)",
    category: "sales"
  },
  SALES_REVENUE_WHOLESALE: {
    title: "Sales Revenue (Wholesale/ERP)",
    desc: "Credit on wholesale sales invoices (excl. tax)",
    category: "sales"
  },
  ACCOUNTS_RECEIVABLE: {
    title: "Accounts Receivable",
    desc: "Debit on ERP wholesale sales invoices",
    category: "sales"
  },
  ADVANCE_FROM_CUSTOMERS: {
    title: "Advance from Customers",
    desc: "Credit when customer advance deposit is received",
    category: "sales"
  },
  SALES_RETURN_RETAIL: {
    title: "Sales Return (Retail)",
    desc: "Debit on retail sales return or credit note",
    category: "sales"
  },
  SALES_RETURN_WHOLESALE: {
    title: "Sales Return (Wholesale)",
    desc: "Debit on wholesale sales return or credit note",
    category: "sales"
  },

  // Tax
  SALES_TAX_PAYABLE_FEDERAL: {
    title: "Federal Sales Tax Payable",
    desc: "Credit for output tax collected — federal",
    category: "tax"
  },
  SALES_TAX_PAYABLE_PROVINCIAL: {
    title: "Provincial Sales Tax Payable",
    desc: "Credit for output tax collected — provincial",
    category: "tax"
  },
  INPUT_TAX_RECOVERABLE: {
    title: "Input Tax Recoverable",
    desc: "Debit for input tax recoverable on purchases",
    category: "tax"
  },
  WHT_SALARY: {
    title: "WHT on Salaries",
    desc: "Credit income tax withheld on employee salaries",
    category: "tax"
  },
  WHT_GOODS: {
    title: "WHT on Goods Purchases",
    desc: "Credit withholding tax on goods purchases",
    category: "tax"
  },
  WHT_SERVICES: {
    title: "WHT on Services",
    desc: "Credit withholding tax on services",
    category: "tax"
  },

  // Inventory
  STOCK_IN_TRADE_WAREHOUSE: {
    title: "Stock in Trade (Warehouse)",
    desc: "Dr on GRN; Cr on COGS outbound — warehouse stock",
    category: "inventory"
  },
  STOCK_IN_TRADE_STORES: {
    title: "Stock in Trade (Stores)",
    desc: "Dr on store transfer; Cr on COGS — store stock",
    category: "inventory"
  },
  COST_OF_GOODS_SOLD: {
    title: "Cost of Goods Sold",
    desc: "Debit cost of goods sold on sales delivery",
    category: "inventory"
  },
  STOCK_ADJUSTMENTS: {
    title: "Stock Adjustments",
    desc: "Debit/Credit stock adjustment write-offs",
    category: "inventory"
  },
  INVENTORY_SHORTAGE: {
    title: "Inventory Shortage/Excess",
    desc: "Debit inventory shortage/excess expense",
    category: "inventory"
  },

  // POS Payments & Cash + Fees + Vouchers (Flattened into "pos" category)
  CASH_IN_HAND: {
    title: "Cash in Hand",
    desc: "Debit cash received at POS counters",
    category: "pos"
  },
  BANK_MERCHANT: {
    title: "Bank Merchant Settlement",
    desc: "Debit card/digital payments (gross before commission)",
    category: "pos"
  },
  CASH_SHORTAGE_OVERAGE: {
    title: "Cash Shortage/Overage",
    desc: "Debit/Credit cash discrepancies at POS end-of-day",
    category: "pos"
  },
  CREDIT_VOUCHERS: {
    title: "Credit Vouchers",
    desc: "Liability for credit voucher issuance & redemption",
    category: "pos"
  },
  GIFT_VOUCHERS: {
    title: "Gift Vouchers",
    desc: "Liability for gift voucher issuance & redemption",
    category: "pos"
  },
  GIFT_VOUCHERS_CORPORATE: {
    title: "Corporate Gift Vouchers",
    desc: "Liability for corporate gift vouchers",
    category: "pos"
  },
  CLAIM_VOUCHERS: {
    title: "Claim Vouchers",
    desc: "Liability for claim vouchers",
    category: "pos"
  },
  EXCHANGE_VOUCHERS: {
    title: "Exchange Vouchers",
    desc: "Liability for exchange vouchers",
    category: "pos"
  },
  ALLIANCE_REWARD: {
    title: "Alliance Reward Points",
    desc: "Liability for accrued reward points",
    category: "pos"
  },
  POS_INTEGRATION_FEE_PAYABLE: {
    title: "POS Integration Fee Payable",
    desc: "Credit POS integration fee payable (e.g. FBR)",
    category: "pos"
  },
  POS_INTEGRATION_FEE_EXPENSE: {
    title: "POS Integration Fee Expense",
    desc: "Debit POS integration fee expense — selling department",
    category: "pos"
  },
  BANK_COMMISSION_SELLING: {
    title: "Bank Commission (Selling)",
    desc: "Debit bank merchant commission — selling department",
    category: "pos"
  },
  BANK_COMMISSION_ADMIN: {
    title: "Bank Commission (Admin)",
    desc: "Debit bank merchant commission — admin department",
    category: "pos"
  },

  // Payroll
  SALARIES_EXPENSE_ADMIN: {
    title: "Salaries Expense (Admin)",
    desc: "Debit gross salaries — admin / head-office staff",
    category: "payroll"
  },
  EOBI_EXPENSE_ADMIN: {
    title: "EOBI Expense (Admin)",
    desc: "Debit employer EOBI share — admin department",
    category: "payroll"
  },
  PF_EXPENSE_ADMIN: {
    title: "Provident Fund Expense (Admin)",
    desc: "Debit employer PF share — admin department",
    category: "payroll"
  },
  SALARIES_EXPENSE_SELLING: {
    title: "Salaries Expense (Selling)",
    desc: "Debit gross salaries — selling / store staff",
    category: "payroll"
  },
  EOBI_EXPENSE_SELLING: {
    title: "EOBI Expense (Selling)",
    desc: "Debit employer EOBI share — selling department",
    category: "payroll"
  },
  PF_EXPENSE_SELLING: {
    title: "Provident Fund Expense (Selling)",
    desc: "Debit employer PF share — selling department",
    category: "payroll"
  },
  AP_SALARIES: {
    title: "Net Salaries Payable",
    desc: "Credit net salary payable to employees",
    category: "payroll"
  },
  AP_EOBI: {
    title: "EOBI Contribution Payable",
    desc: "Credit EOBI payable to authority (employee + employer)",
    category: "payroll"
  },
  AP_PROVIDENT_FUND: {
    title: "Provident Fund Payable",
    desc: "Credit PF payable to fund (employee + employer)",
    category: "payroll"
  },
  AP_SESSI: {
    title: "Social Security Payable",
    desc: "Credit SESSI / PESSI / IESSI contribution payable",
    category: "payroll"
  },
  AP_SALARIES_FINAL_SETTLEMENT: {
    title: "Final Settlement Payable",
    desc: "Credit employee gratuity / end-of-service settlement",
    category: "payroll"
  },

  // Financial & General
  BANK_CHARGES: {
    title: "Bank Charges & Commission",
    desc: "Debit general bank charges and transaction fees",
    category: "financial"
  },
  MARKUP_ON_LOAN: {
    title: "Markup / Interest on Loan",
    desc: "Debit mark-up / interest on short/long term loans",
    category: "financial"
  },
  BANK_CHARGES_IMPORT: {
    title: "Import Bank Charges",
    desc: "Debit import LC, confirmation, handling charges",
    category: "financial"
  },
  EXCHANGE_LOSS_IMPORT: {
    title: "Exchange Loss on Imports",
    desc: "Debit foreign exchange loss on import transactions",
    category: "financial"
  }
};

export function AccountConfigurationClient() {
  const [flatAccounts, setFlatAccounts] = useState<ChartAccount[]>([]);
  const [dbConfigs, setDbConfigs] = useState<Record<string, BackendConfig>>({});
  
  // Local scratchpad for edited values before saving
  const [localMappings, setLocalMappings] = useState<Record<string, string>>({});
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "configured" | "unconfigured">("all");
  const [activeTab, setActiveTab] = useState("purchases");
  const [isPending, startTransition] = useTransition();

  // Load baseline configurations and COA
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // 1. Fetch Chart of Accounts
    const coaRes = await getChartOfAccounts();
    if (coaRes.data) {
      const flat = flattenAccounts(coaRes.data);
      // Filter out groups to only leave leaf nodes
      setFlatAccounts(flat.filter(acc => !acc.isGroup));
    }

    // 2. Fetch current configurations
    const configRes = await getFinanceAccountConfigs();
    if (configRes.status && configRes.data) {
      const configMap: Record<string, BackendConfig> = {};
      const localMap: Record<string, string> = {};
      configRes.data.forEach((config: BackendConfig) => {
        configMap[config.key] = config;
        localMap[config.key] = config.accountId;
      });
      setDbConfigs(configMap);
      setLocalMappings(localMap);
    }
  };

  const flattenAccounts = (accounts: ChartAccount[], level = 0): ChartAccount[] => {
    let result: ChartAccount[] = [];
    accounts.forEach(acc => {
      result.push({ ...acc, level });
      if (acc.children && acc.children.length > 0) {
        result = result.concat(flattenAccounts(acc.children, level + 1));
      }
    });
    return result;
  };

  // Convert flat accounts to Autocomplete options
  const accountOptions = useMemo(() => {
    return flatAccounts.map(acc => ({
      value: acc.id,
      label: `${acc.code} — ${acc.name}`,
      description: acc.type
    }));
  }, [flatAccounts]);

  // Compute completed count
  const allKeys = Object.keys(ROLE_METADATA);
  const totalRolesCount = allKeys.length;
  const configuredRolesCount = useMemo(() => {
    return allKeys.filter(key => dbConfigs[key]?.accountId).length;
  }, [dbConfigs, allKeys]);

  const completionPercentage = Math.round((configuredRolesCount / totalRolesCount) * 100) || 0;

  // Track if changes are unsaved
  const hasUnsavedChanges = useMemo(() => {
    return allKeys.some(key => {
      const dbVal = dbConfigs[key]?.accountId || "";
      const localVal = localMappings[key] || "";
      return dbVal !== localVal;
    });
  }, [dbConfigs, localMappings, allKeys]);

  // Handle single configuration save
  const handleSaveSingle = async (key: string) => {
    const accountId = localMappings[key];
    if (!accountId) {
      toast.error("Please select an account first");
      return;
    }

    startTransition(async () => {
      const res = await upsertFinanceAccountConfig({
        key,
        accountId,
        description: ROLE_METADATA[key]?.desc || ""
      });

      if (res.status && res.data) {
        toast.success(`Successfully saved mapping for ${ROLE_METADATA[key]?.title}`);
        setDbConfigs(prev => ({ ...prev, [key]: res.data }));
      } else {
        toast.error(res.message || "Failed to update account mapping");
      }
    });
  };

  // Handle single configuration delete/reset
  const handleDeleteSingle = async (key: string) => {
    if (!dbConfigs[key]) {
      // Just clear local mapping
      setLocalMappings(prev => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }

    startTransition(async () => {
      const res = await deleteFinanceAccountConfig(key);
      if (res.status) {
        toast.success(`Reset configuration mapping for ${ROLE_METADATA[key]?.title}`);
        setDbConfigs(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        setLocalMappings(prev => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      } else {
        toast.error(res.message || "Failed to reset mapping");
      }
    });
  };

  // Handle save all changes
  const handleSaveAll = async () => {
    const pendingConfigs = allKeys
      .filter(key => {
        const dbVal = dbConfigs[key]?.accountId || "";
        const localVal = localMappings[key] || "";
        return dbVal !== localVal && localVal !== "";
      })
      .map(key => ({
        key,
        accountId: localMappings[key],
        description: ROLE_METADATA[key]?.desc || ""
      }));

    if (pendingConfigs.length === 0) {
      // Discard any resets
      loadData();
      return;
    }

    startTransition(async () => {
      const res = await bulkUpsertFinanceAccountConfigs(pendingConfigs);
      if (res.status && res.data) {
        toast.success(`Successfully bulk-saved ${pendingConfigs.length} configuration mappings!`);
        // Reload all fresh data
        loadData();
      } else {
        toast.error(res.message || "Failed to perform bulk configuration updates");
      }
    });
  };

  // Reset all unsaved modifications back to DB state
  const handleDiscardAll = () => {
    const resetLocal: Record<string, string> = {};
    Object.keys(dbConfigs).forEach(key => {
      resetLocal[key] = dbConfigs[key].accountId;
    });
    setLocalMappings(resetLocal);
    toast.info("Discarded all unsaved local changes");
  };

  // Filtered keys calculation
  const filteredKeys = useMemo(() => {
    return allKeys.filter(key => {
      const meta = ROLE_METADATA[key];
      if (!meta) return false;

      // 1. Tab match
      if (meta.category !== activeTab) return false;

      // 2. Search match
      const normSearch = searchQuery.toLowerCase();
      if (normSearch) {
        const titleMatch = meta.title.toLowerCase().includes(normSearch);
        const keyMatch = key.toLowerCase().includes(normSearch);
        const descMatch = meta.desc.toLowerCase().includes(normSearch);
        if (!titleMatch && !keyMatch && !descMatch) return false;
      }

      // 3. Status filter match
      const hasConfig = !!dbConfigs[key]?.accountId;
      if (statusFilter === "configured" && !hasConfig) return false;
      if (statusFilter === "unconfigured" && hasConfig) return false;

      return true;
    });
  }, [allKeys, activeTab, searchQuery, statusFilter, dbConfigs]);

  return (
    <div className="space-y-6 pb-20 relative">
      {/* Header and completion rate banner */}
      <Card className="border-none shadow-[0_4px_20px_-4px_rgba(0,0,0,0.1)] dark:shadow-none bg-gradient-to-r from-indigo-50/50 via-purple-50/30 to-background dark:from-slate-900 dark:via-slate-950 dark:to-slate-950 p-6 overflow-hidden relative">
        <div className="absolute right-0 top-0 h-40 w-40 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute left-1/3 bottom-0 h-28 w-28 bg-indigo-500/10 rounded-full blur-2xl" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-1.5 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-semibold uppercase tracking-wider mb-2">
              <Sparkles className="h-3.5 w-3.5" />
              Chart of Accounts Middleware Mappings
            </div>
            <CardTitle className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
              Finance Account Configuration
            </CardTitle>
            <CardDescription className="text-sm text-muted-foreground/90 font-medium">
              Establish mappings between business accounting roles and your active Chart of Accounts. 
              This resolves unconfigured account errors when posting invoices, payroll, or vouchers.
            </CardDescription>
          </div>

          {/* Completion visual rate card */}
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur border rounded-xl p-4.5 w-full lg:w-80 shadow-sm flex flex-col justify-between">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-1.5">
                <BookmarkCheck className="h-5 w-5 text-indigo-500" />
                <span className="text-sm font-bold tracking-tight">Configuration Completion</span>
              </div>
              <span className="text-xs font-mono font-bold bg-muted px-2 py-0.5 rounded text-muted-foreground">
                {configuredRolesCount}/{totalRolesCount}
              </span>
            </div>

            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-3xl font-black tracking-tighter text-indigo-600 dark:text-indigo-400">{completionPercentage}%</span>
              <span className="text-xs font-medium text-muted-foreground">Mapped</span>
            </div>

            {/* Glowing gradient progress bar */}
            <div className="w-full bg-muted rounded-full h-2 mt-3 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-2 rounded-full transition-all duration-700 ease-out" 
                style={{ width: `${completionPercentage}%` }}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Control panel and filters */}
      <div className="flex flex-col md:flex-row items-center gap-3.5 justify-between bg-muted/30 p-3 rounded-lg border">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            type="search"
            placeholder="Search role keys or descriptions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-9 pr-4 bg-background w-full focus-visible:ring-indigo-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end select-none">
          <span className="text-xs font-semibold text-muted-foreground mr-1.5">Show:</span>
          
          <Button
            size="sm"
            variant={statusFilter === "all" ? "default" : "outline"}
            onClick={() => setStatusFilter("all")}
            className={cn("h-8 rounded-full text-xs font-medium px-4", statusFilter === "all" && "bg-indigo-600 hover:bg-indigo-700")}
          >
            All Roles
          </Button>

          <Button
            size="sm"
            variant={statusFilter === "configured" ? "default" : "outline"}
            onClick={() => setStatusFilter("configured")}
            className={cn(
              "h-8 rounded-full text-xs font-medium px-4 gap-1.5",
              statusFilter === "configured" && "bg-emerald-600 hover:bg-emerald-700 text-white"
            )}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Configured
          </Button>

          <Button
            size="sm"
            variant={statusFilter === "unconfigured" ? "default" : "outline"}
            onClick={() => setStatusFilter("unconfigured")}
            className={cn(
              "h-8 rounded-full text-xs font-medium px-4 gap-1.5",
              statusFilter === "unconfigured" && "bg-rose-600 hover:bg-rose-700 text-white"
            )}
          >
            <AlertCircle className="h-3.5 w-3.5" />
            Unconfigured
          </Button>
        </div>
      </div>

      {/* Main Tabs interface */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        {/* Horizontal scrollable tab buttons */}
        <div className="w-full overflow-x-auto pb-1 mb-6">
          <TabsList className="bg-muted/50 p-1 border h-auto flex w-max min-w-full justify-start md:justify-between rounded-lg">
            {CATEGORY_MAP.map((cat) => {
              const Icon = cat.icon;
              return (
                <TabsTrigger 
                  key={cat.value} 
                  value={cat.value}
                  className="px-4 py-2.5 rounded-md text-xs font-bold tracking-tight uppercase flex items-center gap-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-indigo-600 dark:data-[state=active]:text-indigo-400 transition-all select-none border-b-2 border-transparent data-[state=active]:border-indigo-500"
                >
                  <Icon className="h-4 w-4" />
                  {cat.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {/* Tab content loops */}
        {CATEGORY_MAP.map((cat) => (
          <TabsContent key={cat.value} value={cat.value} className="space-y-4 outline-none focus:outline-none">
            {filteredKeys.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 bg-muted/10 border border-dashed rounded-lg text-center select-none">
                <HelpCircle className="h-8 w-8 text-muted-foreground/45 mb-2.5 animate-pulse" />
                <h4 className="text-sm font-bold text-muted-foreground">No mappings match these filters</h4>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-sm">
                  Try adjusting your search queries or change the status filter toggle to see items in this category.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4.5">
                {filteredKeys.map((key) => {
                  const meta = ROLE_METADATA[key]!;
                  const selectedVal = localMappings[key] || "";
                  const dbVal = dbConfigs[key]?.accountId || "";
                  const isDirty = selectedVal !== dbVal;
                  const isConfigured = !!dbVal;

                  return (
                    <Card 
                      key={key} 
                      className={cn(
                        "transition-all duration-200 shadow-sm border overflow-hidden",
                        isDirty && "border-indigo-500/60 ring-1 ring-indigo-500/20 bg-indigo-50/5 dark:bg-indigo-950/5",
                        !isDirty && isConfigured && "border-emerald-500/10 hover:border-emerald-500/30",
                        !isDirty && !isConfigured && "border-slate-200 dark:border-slate-800"
                      )}
                    >
                      <CardContent className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5 relative">
                        {/* Glow tags for changes */}
                        {isDirty && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />
                        )}

                        <div className="space-y-1.5 max-w-lg min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-extrabold bg-muted text-muted-foreground px-2 py-0.5 rounded select-all uppercase">
                              {key}
                            </span>
                            
                            {/* Mapped Badge */}
                            {!isDirty && isConfigured && (
                              <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded flex items-center gap-1 select-none">
                                <CheckCircle2 className="h-3 w-3" />
                                Mapped
                              </span>
                            )}

                            {/* Unconfigured Badge */}
                            {!isDirty && !isConfigured && (
                              <span className="text-[10px] font-bold bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 px-2 py-0.5 rounded flex items-center gap-1 select-none">
                                <AlertCircle className="h-3 w-3" />
                                Unconfigured
                              </span>
                            )}

                            {/* Unsaved Badge */}
                            {isDirty && (
                              <span className="text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded flex items-center gap-1 animate-pulse select-none">
                                Unsaved Changes
                              </span>
                            )}
                          </div>

                          <h3 className="text-base font-bold tracking-tight mt-1">{meta.title}</h3>
                          <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                            {meta.desc}
                          </p>
                        </div>

                        {/* Dropdown mapping and buttons */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0 lg:w-[480px]">
                          {/* Searchable Autocomplete of non-group COA leaf accounts */}
                          <div className="flex-1 min-w-0">
                            <Autocomplete
                              options={accountOptions}
                              value={selectedVal}
                              onValueChange={(val) => setLocalMappings(prev => ({ ...prev, [key]: val }))}
                              placeholder="Map to ChartOfAccount leaf..."
                              searchPlaceholder="Type code or account name..."
                              emptyMessage="No leaf accounts found."
                              disabled={isPending}
                              className={cn(
                                "w-full",
                                !selectedVal && "border-dashed border-rose-300 dark:border-rose-900/50"
                              )}
                            />
                          </div>

                          {/* Quick saves/discards */}
                          <div className="flex items-center gap-1.5 shrink-0 justify-end sm:justify-start">
                            {/* Save row */}
                            <Button
                              size="sm"
                              variant={isDirty ? "default" : "outline"}
                              onClick={() => handleSaveSingle(key)}
                              disabled={isPending || !selectedVal || !isDirty}
                              className={cn(
                                "h-9 text-xs px-3 gap-1",
                                isDirty && "bg-indigo-600 hover:bg-indigo-700 font-bold"
                              )}
                            >
                              <Save className="h-3.5 w-3.5" />
                              Save
                            </Button>

                            {/* Reset mapping */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDeleteSingle(key)}
                              disabled={isPending || (!isConfigured && !selectedVal)}
                              className="h-9 w-9 p-0 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/20"
                              title="Reset configuration mapping"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Floating Save All Changes bottom bar */}
      {hasUnsavedChanges && (
        <div className="fixed bottom-6 left-6 right-6 md:left-72 md:right-10 bg-white/80 dark:bg-slate-900/80 border border-indigo-200 dark:border-indigo-950/80 p-4.5 rounded-xl shadow-[0_12px_24px_-4px_rgba(99,102,241,0.2)] dark:shadow-none backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-5 duration-300 z-50">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
              <AlertCircle className="h-5 w-5 animate-bounce" />
            </div>
            <div>
              <h4 className="text-sm font-bold leading-none">Unsaved Configuration Changes</h4>
              <p className="text-xs text-muted-foreground mt-1">
                You have modified account mappings on this page. Save all changes at once or discard them.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto shrink-0">
            <Button
              variant="outline"
              onClick={handleDiscardAll}
              disabled={isPending}
              className="h-10 text-xs px-5 w-full sm:w-auto font-semibold"
            >
              Discard Changes
            </Button>
            <Button
              onClick={handleSaveAll}
              disabled={isPending}
              className="h-10 text-xs px-6 w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 font-extrabold gap-1.5 shadow-md shadow-indigo-600/10"
            >
              <Save className="h-4 w-4" />
              Save All Changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
