"use server";
import { authFetch } from "@/lib/auth";

export interface LandedCostChargeType {
  id: string;
  name: string;
  accountId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  account?: { id: string; name: string; code: string; type: string };
}

export async function getLandedCostChargeTypes(): Promise<{ status: boolean; data: LandedCostChargeType[]; message?: string }> {
  try {
    const res = await authFetch(`/landed-cost/charge-types`);
    if (!res.ok) {
      return { status: false, data: [], message: "Failed to fetch charge types" };
    }
    const data = res.data;
    if (Array.isArray(data)) {
      return { status: true, data };
    }
    return data;
  } catch {
    return { status: false, data: [], message: "Failed to fetch charge types" };
  }
}

export async function createLandedCostChargeType(payload: { name: string; accountId: string }): Promise<{ status: boolean; data?: LandedCostChargeType; message?: string }> {
  try {
    const res = await authFetch(`/landed-cost/charge-types`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      return { status: false, message: "Failed to create charge type" };
    }
    const data = res.data;
    if (data?.id) {
      return { status: true, data };
    }
    return data;
  } catch {
    return { status: false, message: "Failed to create charge type" };
  }
}
