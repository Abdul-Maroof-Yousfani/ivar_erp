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
  debit: number;
  credit: number;
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
        revalidatePath("/erp/finance/chart-of-accounts");
        return { status: true, message: "Account created successfully", data: result };
    }
    if (result.status) {
      revalidatePath("/erp/finance/chart-of-accounts");
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
          revalidatePath("/erp/finance/chart-of-accounts");
          return { status: true, message: "Account updated successfully", data: result };
      }
      if (result.status) {
        revalidatePath("/erp/finance/chart-of-accounts");
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
      revalidatePath("/erp/finance/chart-of-accounts");
      return { status: true, message: "Account deleted successfully" };
    }
    const result = res.data;
    return result;
  } catch (error) {
    return { status: false, message: "Failed to delete chart of account" };
  }
}

// ─── Export Chart of Accounts ─────────────────────────────────────────────────

export async function queueChartOfAccountsExport(
  search?: string,
  type?: string,
  isGroup?: boolean,
  isActive?: boolean,
): Promise<{ status: boolean; data?: { jobId: string }; message?: string }> {
  try {
    const params = new URLSearchParams();
    if (search)              params.append('search',   search);
    if (type)                params.append('type',     type);
    if (isGroup !== undefined)  params.append('isGroup',  String(isGroup));
    if (isActive !== undefined) params.append('isActive', String(isActive));
    const qs = params.toString();

    const res = await authFetch(`/finance/chart-of-accounts/export${qs ? `?${qs}` : ''}`, {
      method: 'POST',
    });
    return res.data ?? { status: false, message: 'No response from server' };
  } catch (error) {
    console.error('Queue chart-of-accounts export error:', error);
    return { status: false, message: 'Failed to connect to server' };
  }
}

export async function getSuppliers(): Promise<{ status: boolean; data: any[]; message?: string }> {
  try {
    const res = await authFetch(`/finance/suppliers`, {});
    const data = res.data;
    if (data && Array.isArray(data.data)) {
      return { status: true, data: data.data };
    }
    if (Array.isArray(data)) {
      return { status: true, data };
    }
    return { status: false, data: [], message: data?.message || "Failed to fetch suppliers" };
  } catch (error) {
    console.error("Failed to fetch suppliers:", error);
    return { status: false, data: [], message: "Failed to fetch suppliers" };
  }
}

export async function createBulkSubAccounts(
  parentId: string,
  items: Array<{ name: string; code: string; type: 'SUPPLIER' | 'CUSTOMER' | 'LOCATION'; referenceId: string }>
): Promise<{
  status: boolean;
  message: string;
  createdCount: number;
  skippedCount: number;
  created: any[];
  skipped: any[];
}> {
  try {
    const res = await authFetch(`/finance/chart-of-accounts/bulk-subaccounts`, {
      method: "POST",
      body: JSON.stringify({ parentId, items }),
    });
    const result = res.data;
    if (result.status) {
      revalidatePath("/erp/finance/chart-of-accounts");
    }
    return result;
  } catch (error) {
    console.error("Failed to create sub-accounts in bulk:", error);
    return {
      status: false,
      message: "Failed to create sub-accounts",
      createdCount: 0,
      skippedCount: 0,
      created: [],
      skipped: [],
    };
  }
}
