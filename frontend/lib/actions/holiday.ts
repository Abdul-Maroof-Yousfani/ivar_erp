"use server";
import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface Holiday {
  id: string;
  name: string;
  dateFrom: string;
  dateTo: string;
  status: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export async function getHolidays(): Promise<{ status: boolean; data: Holiday[]; message?: string }> {
  try {
    const res = await authFetch(`/holidays`, {});
    return res.data;
  } catch (error) {
    console.error("Failed to fetch holidays:", error);
    return { status: false, data: [], message: "Failed to fetch holidays" };
  }
}

export async function getHolidayById(id: string): Promise<{ status: boolean; data: Holiday | null; message?: string }> {
  try {
    const res = await authFetch(`/holidays/${id}`, {});
    return res.data;
  } catch (error) {
    console.error("Failed to fetch holiday:", error);
    return { status: false, data: null, message: "Failed to fetch holiday" };
  }
}

export async function createHoliday(data: { name: string; dateFrom: string; dateTo: string; status?: string }): Promise<{ status: boolean; message: string; data?: Holiday }> {
  if (!data.name?.trim()) {
    return { status: false, message: "Name is required" };
  }
  if (!data.dateFrom || !data.dateTo) {
    return { status: false, message: "Both start date and end date are required" };
  }
  try {
    const res = await authFetch(`/holidays`, {
      method: "POST",
      body: JSON.stringify({ name: data.name, dateFrom: data.dateFrom, dateTo: data.dateTo, status: data.status || "active" }),
    });
    const result = res.data;
    if (result.status) {
      revalidatePath("/hr/holidays/list");
    }
    return result;
  } catch (error) {
    return { status: false, message: "Failed to create holiday" };
  }
}

export async function updateHoliday(id: string, data: { name?: string; dateFrom?: string; dateTo?: string; status?: string }): Promise<{ status: boolean; message: string; data?: Holiday }> {
  try {
    const res = await authFetch(`/holidays/${id}`, {
      method: "PUT",
      body: JSON.stringify({ ...data, id }),
    });
    const result = res.data;
    if (result.status) {
      revalidatePath("/hr/holidays/list");
    }
    return result;
  } catch (error) {
    return { status: false, message: "Failed to update holiday" };
  }
}

export async function deleteHoliday(id: string): Promise<{ status: boolean; message: string }> {
  try {
    const res = await authFetch(`/holidays/${id}`, {
      method: "DELETE",
    });
    const data = res.data;
    if (data.status) {
      revalidatePath("/hr/holidays/list");
    }
    return data;
  } catch (error) {
    return { status: false, message: "Failed to delete holiday" };
  }
}

export async function deleteHolidays(ids: string[]): Promise<{ status: boolean; message: string }> {
  if (!ids.length) {
    return { status: false, message: "No items to delete" };
  }
  try {
    const res = await authFetch(`/holidays/bulk`, {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
    const data = res.data;
    if (data.status) {
      revalidatePath("/hr/holidays/list");
    }
    return data;
  } catch (error) {
    return { status: false, message: "Failed to delete holidays" };
  }
}

export async function updateHolidays(items: { id: string; name?: string; dateFrom?: string; dateTo?: string; status?: string }[]): Promise<{ status: boolean; message: string }> {
  if (!items.length) {
    return { status: false, message: "No items to update" };
  }
  try {
    const res = await authFetch(`/holidays/bulk`, {
      method: "PUT",
      body: JSON.stringify({ items }),
    });
    const data = res.data;
    if (data.status) {
      revalidatePath("/hr/holidays/list");
    }
    return data;
  } catch (error) {
    return { status: false, message: "Failed to update holidays" };
  }
}