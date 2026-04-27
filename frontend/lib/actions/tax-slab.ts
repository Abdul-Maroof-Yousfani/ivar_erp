"use server";
import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";
export interface TaxSlab {
  id: string;
  name: string;
  minAmount: number;
  maxAmount: number;
  rate: number;
  status: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}
export async function getTaxSlabs(): Promise<{ status: boolean; data: TaxSlab[] }> {
  try {
    const res = await authFetch(`/tax-slabs`, {
    });
    return res.data;
  } catch (error) {
    console.error("Failed to fetch tax slabs:", error);
    return { status: false, data: [] };
  }
}
export async function createTaxSlab(formData: FormData): Promise<{ status: boolean; message: string; data?: TaxSlab }> {
  const name = formData.get("name") as string;
  const minAmount = parseFloat(formData.get("minAmount") as string);
  const maxAmount = parseFloat(formData.get("maxAmount") as string);
  const rate = parseFloat(formData.get("rate") as string);
  if (!name?.trim() || isNaN(minAmount) || isNaN(maxAmount) || isNaN(rate)) {
    return { status: false, message: "All fields are required" };
  }
  try {
    const res = await authFetch(`/tax-slabs`, {
      method: "POST",
      body: JSON.stringify({ name, minAmount, maxAmount, rate }),
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/tax-slabs");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to create tax slab" };
  }
}
export async function createTaxSlabs(
  items: { name: string; minAmount: number; maxAmount: number; rate: number }[]
): Promise<{ status: boolean; message: string }> {
  if (!items.length) return { status: false, message: "At least one tax slab is required" };
  try {
    const res = await authFetch(`/tax-slabs/bulk`, {
      method: "POST",
      body: JSON.stringify({ items }),
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/tax-slabs");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to create tax slabs" };
  }
}
export async function updateTaxSlab(id: string, formData: FormData): Promise<{ status: boolean; message: string; data?: TaxSlab }> {
  const name = formData.get("name") as string;
  const minAmount = parseFloat(formData.get("minAmount") as string);
  const maxAmount = parseFloat(formData.get("maxAmount") as string);
  const rate = parseFloat(formData.get("rate") as string);
  if (!name?.trim()) return { status: false, message: "Name is required" };
  try {
    const res = await authFetch(`/tax-slabs/${id}`, {
      method: "PUT",
      body: JSON.stringify({ id, name, minAmount, maxAmount, rate }),
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/tax-slabs");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to update tax slab" };
  }
}
export async function deleteTaxSlab(id: string): Promise<{ status: boolean; message: string }> {
  try {
    const res = await authFetch(`/tax-slabs/${id}`, {
      method: "DELETE",
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/tax-slabs");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to delete tax slab" };
  }
}
export async function deleteTaxSlabs(ids: string[]): Promise<{ status: boolean; message: string }> {
  if (!ids.length) return { status: false, message: "No items to delete" };
  try {
    const res = await authFetch(`/tax-slabs/bulk`, {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/tax-slabs");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to delete tax slabs" };
  }
}
export async function updateTaxSlabs(
  items: { id: string; name: string; minAmount: number; maxAmount: number; rate: number }[]
): Promise<{ status: boolean; message: string }> {
  if (!items.length) return { status: false, message: "No items to update" };
  try {
    const res = await authFetch(`/tax-slabs/bulk`, {
      method: "PUT",
      body: JSON.stringify({ items }),
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/tax-slabs");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to update tax slabs" };
  }
}
