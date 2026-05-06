"use server";
import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface RebateNature {
  id: string;
  name: string;
  type?: string;
  category?: string | null;
  maxInvestmentPercentage?: number | null;
  maxInvestmentAmount?: number | null;
  details?: string | null;
  underSection?: string | null;
  isAgeDependent: boolean;
  status: string;
  createdBy?: {
    firstName: string;
    lastName: string;
  };
  createdAt: string;
  updatedAt: string;
}

export async function getRebateNatures(): Promise<{ status: boolean; data: RebateNature[]; message?: string }> {
  try {
    const res = await authFetch(`/rebate-nature`, {});
    if (!res.ok) {
      return { status: false, data: [], message: "Failed to fetch rebate natures" };
    }
    const data = res.data;
    return { status: true, data: Array.isArray(data) ? data : [] };
  } catch (error) {
    console.error("Failed to fetch rebate natures:", error);
    return { status: false, data: [], message: "Failed to fetch rebate natures" };
  }
}

export async function createRebateNature(data: Partial<RebateNature>): Promise<{ status: boolean; message: string; data?: RebateNature }> {
  try {
    const res = await authFetch(`/rebate-nature`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = res.data || {};
      throw new Error(error.message || "Failed to create");
    }
    const result = res.data;
    revalidatePath("/master/rebate-nature");
    return { status: true, message: "Rebate Nature created successfully", data: result };
  } catch (error: any) {
    return { status: false, message: error.message || "Failed to create rebate nature" };
  }
}

export async function updateRebateNature(id: string, data: Partial<RebateNature>): Promise<{ status: boolean; message: string; data?: RebateNature }> {
  try {
    const res = await authFetch(`/rebate-nature/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = res.data || {};
      throw new Error(error.message || "Failed to update");
    }
    const result = res.data;
    revalidatePath("/master/rebate-nature");
    return { status: true, message: "Rebate Nature updated successfully", data: result };
  } catch (error: any) {
    return { status: false, message: error.message || "Failed to update rebate nature" };
  }
}

export async function deleteRebateNature(id: string): Promise<{ status: boolean; message: string }> {
  try {
    const res = await authFetch(`/rebate-nature/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const error = res.data || {};
      throw new Error(error.message || "Failed to delete");
    }
    revalidatePath("/master/rebate-nature");
    return { status: true, message: "Rebate Nature deleted successfully" };
  } catch (error: any) {
    return { status: false, message: error.message || "Failed to delete rebate nature" };
  }
}

export async function getFixedRebateNaturesGrouped(): Promise<{ status: boolean; data: Record<string, RebateNature[]>; message?: string }> {
  try {
    const res = await authFetch(`/rebate-nature/fixed/grouped`, {});
    if (!res.ok) {
      return { status: false, data: {}, message: "Failed to fetch fixed rebate natures" };
    }
    const data = res.data;
    return { status: true, data: data || {} };
  } catch (error) {
    console.error("Failed to fetch fixed rebate natures:", error);
    return { status: false, data: {}, message: "Failed to fetch fixed rebate natures" };
  }
}

export async function getRebateNaturesByType(type: "fixed" | "other"): Promise<{ status: boolean; data: RebateNature[]; message?: string }> {
  try {
    const res = await authFetch(`/rebate-nature?type=${type}`, {});
    if (!res.ok) {
      return { status: false, data: [], message: `Failed to fetch ${type} rebate natures` };
    }
    const data = res.data;
    return { status: true, data: Array.isArray(data) ? data : [] };
  } catch (error) {
    console.error(`Failed to fetch ${type} rebate natures:`, error);
    return { status: false, data: [], message: `Failed to fetch ${type} rebate natures` };
  }
}