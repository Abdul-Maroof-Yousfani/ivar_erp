"use server";
import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface LeaveType {
  id: string;
  name: string;
  status: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export async function getLeaveTypes(): Promise<{ status: boolean; data: LeaveType[]; message?: string }> {
  try {
    const res = await authFetch(`/leave-types`, {});
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to fetch leave types" };
      return { status: false, data: [], message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Failed to fetch leave types:", error);
    return { status: false, data: [], message: "Failed to fetch leave types" };
  }
}

export async function createLeaveType(formData: FormData): Promise<{ status: boolean; message: string; data?: LeaveType }> {
  const name = formData.get("name") as string;
  if (!name?.trim()) {
    return { status: false, message: "Name is required" };
  }
  try {
    const res = await authFetch(`/leave-types`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/leave-types");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to create leave type" };
  }
}

export async function createLeaveTypes(items: { name: string }[]): Promise<{ status: boolean; message: string }> {
  if (!items.length) return { status: false, message: "At least one leave type is required" };
  try {
    const res = await authFetch(`/leave-types/bulk`, {
      method: "POST",
      body: JSON.stringify({ items }),
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/leave-types");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to create leave types" };
  }
}

export async function updateLeaveType(id: string, formData: FormData): Promise<{ status: boolean; message: string; data?: LeaveType }> {
  const name = formData.get("name") as string;
  if (!name?.trim()) return { status: false, message: "Name is required" };
  try {
    const res = await authFetch(`/leave-types/${id}`, {
      method: "PUT",
      body: JSON.stringify({ id, name }),
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/leave-types");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to update leave type" };
  }
}

export async function deleteLeaveType(id: string): Promise<{ status: boolean; message: string }> {
  try {
    const res = await authFetch(`/leave-types/${id}`, {
      method: "DELETE",
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/leave-types");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to delete leave type" };
  }
}

export async function deleteLeaveTypes(ids: string[]): Promise<{ status: boolean; message: string }> {
  if (!ids.length) return { status: false, message: "No items to delete" };
  try {
    const res = await authFetch(`/leave-types/bulk`, {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/leave-types");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to delete leave types" };
  }
}

export async function updateLeaveTypes(items: { id: string; name: string }[]): Promise<{ status: boolean; message: string }> {
  if (!items.length) return { status: false, message: "No items to update" };
  try {
    const res = await authFetch(`/leave-types/bulk`, {
      method: "PUT",
      body: JSON.stringify({ items }),
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/leave-types");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to update leave types" };
  }
}