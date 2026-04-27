"use server";
import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface LeavesPolicyLeaveType {
  leaveTypeId: string;
  leaveTypeName: string;
  numberOfLeaves: number;
}

export interface LeavesPolicy {
  id: string;
  name: string;
  details?: string;
  policyDateFrom?: string;
  policyDateTill?: string;
  fullDayDeductionRate?: number;
  halfDayDeductionRate?: number;
  shortLeaveDeductionRate?: number;
  status: string;
  isDefault?: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  leaveTypes?: LeavesPolicyLeaveType[];
}

export async function getLeavesPolicies(): Promise<{
  status: boolean;
  data: LeavesPolicy[];
}> {
  try {
    const res = await authFetch(`/leaves-policies`, {});
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to fetch leave policies" };
      return { status: false, data: [] };
    }
    return res.data;
  } catch (error) {
    console.error("Failed to fetch leave policies:", error);
    return { status: false, data: [] };
  }
}

export async function getLeavesPolicyById(id: string): Promise<{ status: boolean; data: LeavesPolicy | null }> {
  try {
    const res = await authFetch(`/leaves-policies/${id}`, {});
    if (!res.ok) {
      return { status: false, data: null };
    }
    return res.data;
  } catch (error) {
    console.error("Failed to fetch leave policy:", error);
    return { status: false, data: null };
  }
}

export async function createLeavesPolicy(data: {
  name: string;
  details?: string;
  policyDateFrom?: string;
  policyDateTill?: string;
  fullDayDeductionRate?: number;
  halfDayDeductionRate?: number;
  shortLeaveDeductionRate?: number;
  leaveTypes?: { leaveTypeId: string; numberOfLeaves: number }[];
}): Promise<{ status: boolean; message: string; data?: LeavesPolicy }> {
  if (!data.name?.trim()) {
    return { status: false, message: "Name is required" };
  }
  if (!data.policyDateFrom || !data.policyDateTill) {
    return {
      status: false,
      message: "Policy date from and date till are required",
    };
  }
  if (!data.leaveTypes || data.leaveTypes.length === 0) {
    return { status: false, message: "At least one leave type is required" };
  }
  try {
    const res = await authFetch(`/leaves-policies`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    const result = res.data;
    if (result.status) revalidatePath("/master/leaves-policy");
    return result;
  } catch (error) {
    return { status: false, message: "Failed to create leave policy" };
  }
}

export async function createLeavesPolicies(items: { name: string; details?: string }[]): Promise<{ status: boolean; message: string }> {
  if (!items.length) return { status: false, message: "At least one leave policy is required" };
  try {
    const res = await authFetch(`/leaves-policies/bulk`, {
      method: "POST",
      body: JSON.stringify({ items }),
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/leaves-policy");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to create leave policies" };
  }
}

export async function updateLeavesPolicy(
  id: string,
  data: {
    name: string;
    details?: string;
    policyDateFrom?: string;
    policyDateTill?: string;
    fullDayDeductionRate?: number;
    halfDayDeductionRate?: number;
    shortLeaveDeductionRate?: number;
    leaveTypes?: { leaveTypeId: string; numberOfLeaves: number }[];
  }
): Promise<{ status: boolean; message: string; data?: LeavesPolicy }> {
  if (!data.name?.trim()) return { status: false, message: "Name is required" };
  try {
    const res = await authFetch(`/leaves-policies/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    const result = res.data;
    if (result.status) revalidatePath("/master/leaves-policy");
    return result;
  } catch (error) {
    return { status: false, message: "Failed to update leave policy" };
  }
}

export async function deleteLeavesPolicy(id: string): Promise<{ status: boolean; message: string }> {
  try {
    const res = await authFetch(`/leaves-policies/${id}`, {
      method: "DELETE",
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/leaves-policy");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to delete leave policy" };
  }
}

export async function deleteLeavesPolicies(ids: string[]): Promise<{ status: boolean; message: string }> {
  if (!ids.length) return { status: false, message: "No items to delete" };
  try {
    const res = await authFetch(`/leaves-policies/bulk`, {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/leaves-policy");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to delete leave policies" };
  }
}

export async function updateLeavesPolicies(items: { id: string; name: string; details?: string }[]): Promise<{ status: boolean; message: string }> {
  if (!items.length) return { status: false, message: "No items to update" };
  try {
    const res = await authFetch(`/leaves-policies/bulk`, {
      method: "PUT",
      body: JSON.stringify({ items }),
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/leaves-policy");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to update leave policies" };
  }
}

export async function setDefaultLeavesPolicy(id: string): Promise<{ status: boolean; message: string }> {
  try {
    const res = await authFetch(`/leaves-policies/${id}/set-default`, {
      method: "PUT",
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/leaves-policy");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to set default leave policy" };
  }
}