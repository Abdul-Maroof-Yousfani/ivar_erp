"use server";
import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface UpsertConfigInput {
  key: string;
  accountId: string;
  description?: string;
}

export async function getFinanceAccountConfigs(): Promise<{ status: boolean; data?: any[]; message?: string }> {
  try {
    const res = await authFetch("/finance/account-config", {});
    return res.data;
  } catch (e: any) {
    return { status: false, message: e.message };
  }
}

export async function upsertFinanceAccountConfig(input: UpsertConfigInput): Promise<{ status: boolean; data?: any; message?: string }> {
  try {
    const res = await authFetch("/finance/account-config", {
      method: "POST",
      body: JSON.stringify(input),
    });
    revalidatePath("/erp/finance/account-configuration");
    return res.data;
  } catch (e: any) {
    return { status: false, message: e.message };
  }
}

export async function bulkUpsertFinanceAccountConfigs(configs: UpsertConfigInput[]): Promise<{ status: boolean; data?: any[]; message?: string }> {
  try {
    const res = await authFetch("/finance/account-config/bulk", {
      method: "POST",
      body: JSON.stringify({ configs }),
    });
    revalidatePath("/erp/finance/account-configuration");
    return res.data;
  } catch (e: any) {
    return { status: false, message: e.message };
  }
}

export async function deleteFinanceAccountConfig(key: string): Promise<{ status: boolean; message?: string }> {
  try {
    const res = await authFetch(`/finance/account-config/${key}`, {
      method: "DELETE",
    });
    revalidatePath("/erp/finance/account-configuration");
    return res.data;
  } catch (e: any) {
    return { status: false, message: e.message };
  }
}
