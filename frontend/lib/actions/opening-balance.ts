"use server";
import { authFetch } from "@/lib/auth";

export interface SaveOpeningBalanceInput {
  accountId: string;
  type: "DEBIT" | "CREDIT";
  amount: number;
  date: string;
}

export async function saveOpeningBalance(input: SaveOpeningBalanceInput): Promise<{ status: boolean; message?: string }> {
  try {
    const res = await authFetch("/finance/opening-balance", {
      method: "POST",
      body: JSON.stringify(input),
    });
    return res.data;
  } catch (e: any) {
    return { status: false, message: e.message };
  }
}

export async function getOpeningBalances(): Promise<{ status: boolean; data?: any[]; message?: string }> {
  try {
    const res = await authFetch("/finance/opening-balance", {});
    return res.data;
  } catch (e: any) {
    return { status: false, message: e.message };
  }
}
