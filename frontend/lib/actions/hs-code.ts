"use server";
import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface HsCode {
    id: string;
    hsCode: string;
    customsDutyCd: number;
    regulatoryDutyRd: number;
    additionalCustomsDutyAcd: number;
    salesTax: number;
    additionalSalesTax: number;
    incomeTax: number;
    status: string;
    createdAt: string;
    updatedAt: string;
}

export async function getHsCodes(): Promise<{ status: boolean; data: HsCode[]; message?: string }> {
    try {
    const res = await authFetch(`/hs-codes`, {});
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to fetch HS codes" };
      return { status: false, data: [], message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
    } catch (error) {
        console.error("Failed to fetch HS codes:", error);
        return { status: false, data: [], message: "Failed to fetch HS codes" };
    }
}

export async function getHsCodeById(id: string): Promise<{ status: boolean; data: HsCode | null }> {
    try {
    const res = await authFetch(`/hs-codes/${id}`, {});
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to fetch HS code" };
      return { status: false, data: null };
    }
    return res.data;
    } catch (error) {
        console.error("Failed to fetch HS code:", error);
        return { status: false, data: null };
    }
}

export async function createHsCode(data: any): Promise<{ status: boolean; message: string; data?: HsCode }> {
    try {
    const res = await authFetch(`/hs-codes`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to create HS code" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    const result = res.data;
        if (result.status) {
            revalidatePath("/master/hs-code");
        }
        return result;
    } catch (error) {
        return { status: false, message: "Failed to create HS code" };
    }
}

export async function updateHsCode(id: string, data: any): Promise<{ status: boolean; message: string; data?: HsCode }> {
    try {
    const res = await authFetch(`/hs-codes/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to update HS code" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    const result = res.data;
        if (result.status) {
            revalidatePath("/master/hs-code");
        }
        return result;
    } catch (error) {
        return { status: false, message: "Failed to update HS code" };
    }
}

export async function deleteHsCode(id: string): Promise<{ status: boolean; message: string }> {
    try {
    const res = await authFetch(`/hs-codes/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to delete HS code" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    const result = res.data;
        if (result.status) {
            revalidatePath("/master/hs-code");
        }
        return result;
    } catch (error) {
        return { status: false, message: "Failed to delete HS code" };
    }
}
