"use server";
import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface LoanType {
  id: string;
  name: string;
  status: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export async function getLoanTypes(): Promise<{ status: boolean; data: LoanType[]; message?: string }> {
  try {
    const res = await authFetch(`/loan-types`, {});
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to fetch loan types" };
      return { status: false, data: [], message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Failed to fetch loan types:", error);
    return { status: false, data: [], message: "Failed to fetch loan types" };
  }
}

export async function createLoanType(formData: FormData): Promise<{ status: boolean; message: string; data?: LoanType }> {
  const name = formData.get("name") as string;
  if (!name?.trim()) {
    return { status: false, message: "Name is required" };
  }
  try {
    const res = await authFetch(`/loan-types`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/loan-types");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to create loan type" };
  }
}

export async function createLoanTypes(items: { name: string }[]): Promise<{ status: boolean; message: string }> {
  if (!items.length) return { status: false, message: "At least one loan type is required" };
  try {
    const res = await authFetch(`/loan-types/bulk`, {
      method: "POST",
      body: JSON.stringify({ items }),
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/loan-types");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to create loan types" };
  }
}

export async function updateLoanType(id: string, formData: FormData): Promise<{ status: boolean; message: string; data?: LoanType }> {
  const name = formData.get("name") as string;
  if (!name?.trim()) return { status: false, message: "Name is required" };
  try {
    const res = await authFetch(`/loan-types/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/loan-types");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to update loan type" };
  }
}

export async function deleteLoanType(id: string): Promise<{ status: boolean; message: string }> {
  try {
    const res = await authFetch(`/loan-types/${id}`, {
      method: "DELETE",
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/loan-types");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to delete loan type" };
  }
}

export async function deleteLoanTypes(ids: string[]): Promise<{ status: boolean; message: string }> {
  if (!ids.length) return { status: false, message: "No items to delete" };
  try {
    const res = await authFetch(`/loan-types/bulk`, {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/loan-types");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to delete loan types" };
  }
}

export async function updateLoanTypes(items: { id: string; name: string }[]): Promise<{ status: boolean; message: string }> {
  if (!items.length) return { status: false, message: "No items to update" };
  try {
    const res = await authFetch(`/loan-types/bulk`, {
      method: "PUT",
      body: JSON.stringify({ items }),
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/loan-types");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to update loan types" };
  }
}