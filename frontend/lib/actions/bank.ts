"use server";
import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface Bank {
  id: string;
  name: string;
  code?: string | null;
  accountNumberPrefix?: string | null;
  status: string;
  createdById?: string | null;
  updatedById?: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function getBanks(): Promise<{ status: boolean; data: Bank[] }> {
  try {
    const res = await authFetch(`/banks`, {});
    return res.data;
  } catch (error) {
    console.error("Failed to fetch banks:", error);
    return { status: false, data: [] };
  }
}

export async function createBanks(items: { name: string; code?: string; accountNumberPrefix?: string }[]): Promise<{ status: boolean; message: string }> {
  if (!items.length) return { status: false, message: "At least one bank is required" };
  try {
    const res = await authFetch(`/banks/bulk`, {
      method: "POST",
      body: JSON.stringify({ items }),
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/banks");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to create banks" };
  }
}

export async function updateBank(id: string, formData: FormData): Promise<{ status: boolean; message: string; data?: Bank }> {
  const name = formData.get("name") as string;
  const code = formData.get("code") as string;
  const accountNumberPrefix = formData.get("accountNumberPrefix") as string;
  const status = formData.get("status") as string;
  if (!name?.trim()) return { status: false, message: "Name is required" };
  const payload: any = { id, name };
  if (code) payload.code = code;
  if (accountNumberPrefix) payload.accountNumberPrefix = accountNumberPrefix;
  if (status) payload.status = status;
  try {
    const res = await authFetch(`/banks/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/banks");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to update bank" };
  }
}

export async function deleteBank(id: string): Promise<{ status: boolean; message: string }> {
  try {
    const res = await authFetch(`/banks/${id}`, {
      method: "DELETE",
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/banks");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to delete bank" };
  }
}

export async function deleteBanks(ids: string[]): Promise<{ status: boolean; message: string }> {
  if (!ids.length) return { status: false, message: "No items to delete" };
  try {
    const res = await authFetch(`/banks/bulk`, {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/banks");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to delete banks" };
  }
}

export async function updateBanks(items: { id: string; name: string; code?: string; accountNumberPrefix?: string; status?: string }[]): Promise<{ status: boolean; message: string }> {
  if (!items.length) return { status: false, message: "No items to update" };
  try {
    const res = await authFetch(`/banks/bulk`, {
      method: "PUT",
      body: JSON.stringify({ items }),
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/banks");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to update banks" };
  }
}