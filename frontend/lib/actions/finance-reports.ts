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
  parent?: { code: string; name: string } | null;
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
}

export interface GeneralLedgerResult {
  account: { id: string; code: string; name: string; type: string; balance: number };
  openingBalance: number;
  rows: GeneralLedgerRow[];
  closingBalance: number;
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

export async function getTrialBalance(from?: string, to?: string): Promise<{ status: boolean; data?: TrialBalanceResult; message?: string }> {
  try {
    const res = await authFetch(`/finance/reports/trial-balance${buildQuery({ from, to })}`, {});
    return res.data;
  } catch (e: any) {
    return { status: false, message: e.message };
  }
}

export async function getGeneralLedger(
  accountId: string,
  params?: { from?: string; to?: string; page?: number; limit?: number },
): Promise<{ status: boolean; data?: GeneralLedgerResult; message?: string }> {
  try {
    const { from, to, page, limit } = params ?? {};
    const res = await authFetch(
      `/finance/reports/general-ledger/${accountId}${buildQuery({ from, to, page: page?.toString(), limit: limit?.toString() })}`,
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
