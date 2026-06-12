"use server";
import { authFetch } from "@/lib/auth";

export interface TrialBalanceRow {
  id: string;
  code: string;
  name: string;
  type: string;
  balance: number;
  debit: number;
  credit: number;
  openingDebit: number;
  openingCredit: number;
  transactionDebit: number;
  transactionCredit: number;
  closingDebit: number;
  closingCredit: number;
  isTagAccount?: boolean;
  parentId?: string | null;
  level?: number;
}

export interface TrialBalanceResult {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  totalOpeningDebit?: number;
  totalOpeningCredit?: number;
  totalTransactionDebit?: number;
  totalTransactionCredit?: number;
  totalClosingDebit?: number;
  totalClosingCredit?: number;
  balanced: boolean;
  from?: string;
  to?: string;
}

export interface GeneralLedgerRow {
  id: string;
  accountId: string;
  debit: number;
  credit: number;
  balanceAfter: number;
  runningBalance: number;
  sourceType: string;
  sourceId: string;
  sourceRef: string;
  description?: string | null;
  transactionDate: string;
  createdAt: string;
  tagAccount?: {
    id: string;
    code: string;
    name: string;
  } | null;
}

export interface GeneralLedgerResult {
  account: { id: string; code: string; name: string; type: string; balance: number };
  openingBalance: number;
  rows: GeneralLedgerRow[];
  closingBalance: number;
  rangeTotalDebit: number;
  rangeTotalCredit: number;
  rangeClosingBalance: number;
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

export interface IncomeStatementAccount {
  id: string;
  code: string;
  name: string;
  type: string;
  amount: number;
  parent?: { id: string; code: string; name: string } | null;
}

export interface IncomeStatementResult {
  income: IncomeStatementAccount[];
  totalIncome: number;
  expense: IncomeStatementAccount[];
  totalExpense: number;
  netProfit: number;
  from?: string;
  to?: string;
}

export interface BalanceSheetAccount {
  id: string;
  code: string;
  name: string;
  type: string;
  amount: number;
  parent?: { id: string; code: string; name: string } | null;
}

export interface BalanceSheetResult {
  assets: BalanceSheetAccount[];
  totalAssets: number;
  liabilities: BalanceSheetAccount[];
  totalLiabilities: number;
  equity: BalanceSheetAccount[];
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  balanced: boolean;
  asOf?: string;
}

function buildQuery(params: Record<string, string | undefined>) {
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
    .join("&");
  return q ? `?${q}` : "";
}

export async function getTrialBalance(from?: string, to?: string, includeTagAccounts?: boolean): Promise<{ status: boolean; data?: TrialBalanceResult; message?: string }> {
  try {
    const res = await authFetch(`/finance/reports/trial-balance${buildQuery({ from, to, includeTagAccounts: includeTagAccounts ? 'true' : undefined })}`, {});
    return res.data;
  } catch (e: any) {
    return { status: false, message: e.message };
  }
}

export async function queueTrialBalanceExport(params?: {
  from?: string;
  to?: string;
  includeTagAccounts?: boolean;
  reportType?: 'OPENING' | 'CLOSING' | 'DETAILED';
}): Promise<{ status: boolean; data?: { jobId: string }; message?: string }> {
  try {
    const { from, to, includeTagAccounts, reportType } = params ?? {};
    const res = await authFetch(
      `/finance/reports/trial-balance/export/queue${buildQuery({
        from,
        to,
        includeTagAccounts: includeTagAccounts ? 'true' : undefined,
        reportType,
      })}`,
      { method: 'POST' }
    );
    return res.data;
  } catch (e: any) {
    return { status: false, message: e.message };
  }
}

export async function getGeneralLedger(
  accountId: string,
  params?: { from?: string; to?: string; page?: number; limit?: number; sourceType?: string },
): Promise<{ status: boolean; data?: GeneralLedgerResult; message?: string }> {
  try {
    const { from, to, page, limit, sourceType } = params ?? {};
    const res = await authFetch(
      `/finance/reports/general-ledger/${accountId}${buildQuery({
        from,
        to,
        page: page?.toString(),
        limit: limit?.toString(),
        sourceType,
      })}`,
      {},
    );
    return res.data;
  } catch (e: any) {
    return { status: false, message: e.message };
  }
}

export async function getIncomeStatement(from?: string, to?: string): Promise<{ status: boolean; data?: IncomeStatementResult; message?: string }> {
  try {
    const res = await authFetch(`/finance/reports/income-statement${buildQuery({ from, to })}`, {});
    return res.data;
  } catch (e: any) {
    return { status: false, message: e.message };
  }
}

export async function getBalanceSheet(asOf?: string): Promise<{ status: boolean; data?: BalanceSheetResult; message?: string }> {
  try {
    const res = await authFetch(`/finance/reports/balance-sheet${buildQuery({ asOf })}`, {});
    return res.data;
  } catch (e: any) {
    return { status: false, message: e.message };
  }
}

export async function queueGeneralLedgerExport(
  accountId: string,
  params?: { from?: string; to?: string; sourceType?: string }
): Promise<{ status: boolean; data?: { jobId: string }; message?: string }> {
  try {
    const { from, to, sourceType } = params ?? {};
    const res = await authFetch(
      `/finance/reports/general-ledger/export/queue${buildQuery({
        accountId,
        from,
        to,
        sourceType: sourceType === 'all' ? undefined : sourceType,
      })}`,
      { method: 'POST' }
    );
    return res.data;
  } catch (e: any) {
    return { status: false, message: e.message };
  }
}
