"use server";
import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface BonusType {
  id: string;
  name: string;
  calculationType: string; // "Amount" | "Percentage"
  amount?: number | null;
  percentage?: number | null;
  status: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export async function getBonusTypes(): Promise<{ status: boolean; data: BonusType[] }> {
  try {
    const res = await authFetch(`/bonus-types`, {});
    return res.data;
  } catch (error) {
    console.error("Failed to fetch bonus types:", error);
    return { status: false, data: [] };
  }
}

export async function createBonusType(formData: FormData): Promise<{ status: boolean; message: string; data?: BonusType }> {
  const name = formData.get("name") as string;
  const calculationType = formData.get("calculationType") as string;
  const amount = formData.get("amount") as string;
  const percentage = formData.get("percentage") as string;

  if (!name?.trim()) {
    return { status: false, message: "Name is required" };
  }

  const payload: any = { name, calculationType: calculationType || "Amount" };
  if (calculationType === "Amount" && amount) {
    payload.amount = parseFloat(amount);
  } else if (calculationType === "Percentage" && percentage) {
    payload.percentage = parseFloat(percentage);
  }

  try {
    const res = await authFetch(`/bonus-types`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/bonus-types");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to create bonus type" };
  }
}

export async function createBonusTypes(items: { name: string; calculationType?: string; amount?: number; percentage?: number }[]): Promise<{ status: boolean; message: string }> {
  if (!items.length) return { status: false, message: "At least one bonus type is required" };
  try {
    const res = await authFetch(`/bonus-types/bulk`, {
      method: "POST",
      body: JSON.stringify({ items }),
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/bonus-types");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to create bonus types" };
  }
}

export async function updateBonusType(id: string, formData: FormData): Promise<{ status: boolean; message: string; data?: BonusType }> {
  const name = formData.get("name") as string;
  const calculationType = formData.get("calculationType") as string;
  const amount = formData.get("amount") as string;
  const percentage = formData.get("percentage") as string;

  if (!name?.trim()) return { status: false, message: "Name is required" };

  const payload: any = { name, calculationType: calculationType || "Amount" };
  if (calculationType === "Amount" && amount) {
    payload.amount = parseFloat(amount);
  } else if (calculationType === "Percentage" && percentage) {
    payload.percentage = parseFloat(percentage);
  }

  try {
    const res = await authFetch(`/bonus-types/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/bonus-types");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to update bonus type" };
  }
}

export async function deleteBonusType(id: string): Promise<{ status: boolean; message: string }> {
  try {
    const res = await authFetch(`/bonus-types/${id}`, {
      method: "DELETE",
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/bonus-types");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to delete bonus type" };
  }
}

export async function deleteBonusTypes(ids: string[]): Promise<{ status: boolean; message: string }> {
  if (!ids.length) return { status: false, message: "No items to delete" };
  try {
    const res = await authFetch(`/bonus-types/bulk`, {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/bonus-types");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to delete bonus types" };
  }
}

export async function updateBonusTypes(items: { id: string; name: string; calculationType?: string; amount?: number; percentage?: number }[]): Promise<{ status: boolean; message: string }> {
  if (!items.length) return { status: false, message: "No items to update" };
  try {
    const res = await authFetch(`/bonus-types/bulk`, {
      method: "PUT",
      body: JSON.stringify({ items }),
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/bonus-types");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to update bonus types" };
  }
}