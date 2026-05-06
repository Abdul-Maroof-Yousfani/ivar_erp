"use server";
import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface TaxRate {
  id: string;
  taxRate1: number;
  createdAt: string;
  updatedAt: string;
}

const BASE_URL = "/master/erp/tax-rate";

export async function getTaxRates(): Promise<{ status: boolean; data: TaxRate[]; message?: string }> {
  try {
    const res = await authFetch(BASE_URL);
    const result = res.data;
    return result;
  } catch {
    return { status: false, data: [], message: "Failed to fetch Tax Rates" };
  }
}

export async function createTaxRate(data: Partial<TaxRate>): Promise<{ status: boolean; message: string; data?: TaxRate }> {
  try {
    const res = await authFetch(BASE_URL, {
      method: "POST",
      body: JSON.stringify(data),
    });
    const result = res.data;
    if (result.status) {
      revalidatePath("/master/tax-rate");
    }
    return result;
  } catch {
    return { status: false, message: "Failed to create Tax Rate" };
  }
}

export async function deleteTaxRate(id: string): Promise<{ status: boolean; message: string }> {
  try {
    const res = await authFetch(`${BASE_URL}/${id}`, {
      method: "DELETE",
    });
    const result = res.data;
    if (result.status) {
      revalidatePath("/master/tax-rate");
    }
    return result;
  } catch {
    return { status: false, message: "Failed to delete Tax Rate" };
  }
}
