"use server";
import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";
export interface SalaryBreakup {
  id: string;
  name: string;
  details: string | null;
  percentage: number | string | null;
  status: string;
  createdById?: string | null;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}
export async function createSalaryBreakup(
  name: string,
  percentage: number,
  isTaxable: boolean = false
): Promise<{ status: boolean; message: string; data?: SalaryBreakup }> {
  if (!name?.trim()) return { status: false, message: "Name is required" };
  if (percentage === undefined || percentage === null) {
    return { status: false, message: "Percentage is required" };
  }
  try {
    const res = await authFetch(`/salary-breakups`, {
      method: "POST",
      body: JSON.stringify({
        name,
        percentage,
        isTaxable,
        status: "active"
      }),
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/salary-breakup/list");
    return data;
  } catch {
    return { status: false, message: "Failed to create salary breakup" };
  }
}
export async function getSalaryBreakups(): Promise<{
  status: boolean;
  message?: string;
  data?: SalaryBreakup[];
}> {
  try {
    const res = await authFetch(`/salary-breakups`, {
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to fetch salary breakups" };
      return {
        status: false,
        message: errorData.message || `HTTP error! status: ${res.status}`,
      };
    }
    const result = res.data;
    return {
      status: result.status || true,
      data: result.data || result,
      message: result.message,
    };
  } catch (error) {
    console.error("Error fetching salary breakups:", error);
    return {
      status: false,
      message: error instanceof Error ? error.message : "Failed to fetch salary breakups",
    };
  }
}
export async function updateSalaryBreakup(
  id: string,
  data: { name: string; percentage: number; isTaxable?: boolean; status?: string }
): Promise<{ status: boolean; message: string; data?: SalaryBreakup }> {
  if (!id?.trim()) return { status: false, message: "ID is required" };
  if (!data.name?.trim()) return { status: false, message: "Name is required" };
  if (data.percentage === undefined || data.percentage === null) {
    return { status: false, message: "Percentage is required" };
  }
  try {
    const res = await authFetch(`/salary-breakups/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    const result = res.data;
    if (result.status) revalidatePath("/master/salary-breakup/list");
    return result;
  } catch (error) {
    return { status: false, message: "Failed to update salary breakup" };
  }
}
export async function deleteSalaryBreakup(
  id: string
): Promise<{ status: boolean; message: string }> {
  if (!id?.trim()) return { status: false, message: "ID is required" };
  try {
    const res = await authFetch(`/salary-breakups/${id}`, {
      method: "DELETE",
    });
    const result = res.data;
    if (result.status) revalidatePath("/master/salary-breakup/list");
    return result;
  } catch (error) {
    return { status: false, message: "Failed to delete salary breakup" };
  }
}
