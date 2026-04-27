"use server";
import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";
export interface ChartOfAccount {
  id: string;
  code: string;
  name: string;
  type: string; // ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
  parentId?: string | null;
  parent?: ChartOfAccount | null;
  children?: ChartOfAccount[];
  isGroup: boolean;
  isActive: boolean;
  description?: string | null;
  balance: number;
  createdAt: string;
  updatedAt: string;
}
export async function getChartOfAccounts(): Promise<{ status: boolean; data: ChartOfAccount[]; message?: string }> {
  try {
    const res = await authFetch(`/finance/chart-of-accounts`, {});
    const data = res.data;
    if (Array.isArray(data)) {
         return { status: true, data };
    }
    return data;
  } catch (error) {
    console.error("Failed to fetch chart of accounts:", error);
    return { status: false, data: [], message: "Failed to fetch chart of accounts" };
  }
}
export async function getChartOfAccountsTree(): Promise<{ status: boolean; data: ChartOfAccount[]; message?: string }> {
    try {
    const res = await authFetch(`/finance/chart-of-accounts/tree`, {});
    const data = res.data;
      if (Array.isArray(data)) {
        return { status: true, data };
      }
      return data;
    } catch (error) {
      console.error("Failed to fetch chart of accounts tree:", error);
      return { status: false, data: [], message: "Failed to fetch chart of accounts tree" };
    }
  }
export async function createChartOfAccount(data: any): Promise<{ status: boolean; message: string; data?: ChartOfAccount }> {
  try {
    const res = await authFetch(`/finance/chart-of-accounts`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    const result = res.data;
    // If backend returns the object directly
    if (result.id) {
        revalidatePath("/finance/chart-of-accounts");
        return { status: true, message: "Account created successfully", data: result };
    }
    if (result.status) {
      revalidatePath("/finance/chart-of-accounts");
    }
    return result;
  } catch (error) {
    return { status: false, message: "Failed to create chart of account" };
  }
}
export async function updateChartOfAccount(id: string, data: any): Promise<{ status: boolean; message: string; data?: ChartOfAccount }> {
    try {
      const res = await authFetch(`/finance/chart-of-accounts/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      });
      const result = res.data;
      if (result.id) {
          revalidatePath("/finance/chart-of-accounts");
          return { status: true, message: "Account updated successfully", data: result };
      }
      if (result.status) {
        revalidatePath("/finance/chart-of-accounts");
      }
      return result;
    } catch (error) {
      return { status: false, message: "Failed to update chart of account" };
    }
  }
export async function deleteChartOfAccount(id: string): Promise<{ status: boolean; message: string }> {
  try {
    const res = await authFetch(`/finance/chart-of-accounts/${id}`, {
      method: "DELETE",
    });
    // Check for 204 or 200
    if (res.ok) {
      revalidatePath("/finance/chart-of-accounts");
      return { status: true, message: "Account deleted successfully" };
    }
    const result = res.data;
    return result;
  } catch (error) {
    return { status: false, message: "Failed to delete chart of account" };
  }
}
