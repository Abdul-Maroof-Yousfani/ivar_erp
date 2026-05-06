"use server";
import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface EOBI {
  id: string;
  name: string;
  eobiId?: string | null;
  eobiCode?: string | null;
  amount?: number | null;
  employerContribution: number;
  employeeContribution: number;
  yearMonth: string;
  status: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export async function getEOBIs(): Promise<{ status: boolean; data: EOBI[] }> {
  try {
    const res = await authFetch(`/eobis`, {});
    return res.data;
  } catch (error) {
    console.error("Failed to fetch EOBIs:", error);
    return { status: false, data: [] };
  }
}

export async function createEOBI(formData: FormData): Promise<{ status: boolean; message: string; data?: EOBI }> {
  const name = formData.get("name") as string;
  const amount = parseFloat(formData.get("amount") as string);
  const yearMonth = formData.get("yearMonth") as string;
  if (!name?.trim() || isNaN(amount) || !yearMonth?.trim()) {
    return { status: false, message: "All fields are required" };
  }
  try {
    const res = await authFetch(`/eobis`, {
      method: "POST",
      body: JSON.stringify({ name, amount, yearMonth }),
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/eobi");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to create EOBI" };
  }
}

export async function createEOBIs(
  items: { 
    name: string; 
    eobiId?: string; 
    eobiCode?: string; 
    employerContribution: number; 
    employeeContribution: number; 
    yearMonth: string 
  }[]): Promise<{ status: boolean; message: string }> {
  if (!items.length) return { status: false, message: "At least one EOBI is required" };
  try {
    const res = await authFetch(`/eobis/bulk`, {
      method: "POST",
      body: JSON.stringify({ items }),
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/eobi");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to create EOBIs" };
  }
}

export async function updateEOBI(id: string, formData: FormData): Promise<{ status: boolean; message: string; data?: EOBI }> {
  const name = formData.get("name") as string;
  const eobiId = formData.get("eobiId") as string;
  const eobiCode = formData.get("eobiCode") as string;
  const employerContribution = parseFloat(formData.get("employerContribution") as string);
  const employeeContribution = parseFloat(formData.get("employeeContribution") as string);
  const yearMonth = formData.get("yearMonth") as string;
  if (!name?.trim()) return { status: false, message: "Name is required" };
  if (isNaN(employerContribution) || isNaN(employeeContribution)) {
    return { status: false, message: "Employer and Employee contributions are required" };
  }
  try {
    const res = await authFetch(`/eobis/${id}`, {
      method: "PUT",
      body: JSON.stringify({ 
        id, 
        name, 
        eobiId: eobiId || undefined, 
        eobiCode: eobiCode || undefined, 
        employerContribution, 
        employeeContribution, 
        yearMonth 
      }),
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/eobi");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to update EOBI" };
  }
}

export async function deleteEOBI(id: string): Promise<{ status: boolean; message: string }> {
  try {
    const res = await authFetch(`/eobis/${id}`, {
      method: "DELETE",
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/eobi");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to delete EOBI" };
  }
}

export async function deleteEOBIs(ids: string[]): Promise<{ status: boolean; message: string }> {
  if (!ids.length) return { status: false, message: "No items to delete" };
  try {
    const res = await authFetch(`/eobis/bulk`, {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/eobi");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to delete EOBIs" };
  }
}

export async function updateEOBIs(
  items: { 
    id: string; 
    name: string; 
    eobiId?: string; 
    eobiCode?: string; 
    employerContribution: number; 
    employeeContribution: number; 
    yearMonth: string 
  }[]): Promise<{ status: boolean; message: string }> {
  if (!items.length) return { status: false, message: "No items to update" };
  try {
    const res = await authFetch(`/eobis/bulk`, {
      method: "PUT",
      body: JSON.stringify({ items }),
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/eobi");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to update EOBIs" };
  }
}