"use server";
import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface MaritalStatus {
  id: string;
  name: string;
  status: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export async function getMaritalStatuses(): Promise<{ status: boolean; data: MaritalStatus[]; message?: string }> {
  try {
    const res = await authFetch(`/marital-statuses`, {});
    if (!res.ok) {
      return { status: false, data: [], message: "Failed to fetch marital statuses" };
    }
    const result = res.data;
    return result;
  } catch (error) {
    console.error("Failed to fetch marital statuses:", error);
    return { status: false, data: [], message: "Failed to fetch marital statuses" };
  }
}

export async function getMaritalStatusById(id: string): Promise<{ status: boolean; data: MaritalStatus | null }> {
  try {
    const res = await authFetch(`/marital-statuses/${id}`, {});
    if (!res.ok) {
      return { status: false, data: null };
    }
    return res.data;
  } catch (error) {
    console.error("Failed to fetch marital status:", error);
    return { status: false, data: null };
  }
}

export async function createMaritalStatus(formData: FormData): Promise<{ status: boolean; message: string; data?: MaritalStatus }> {
  const name = formData.get("name") as string;
  if (!name?.trim()) {
    return { status: false, message: "Name is required" };
  }
  try {
    const res = await authFetch(`/marital-statuses`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    const data = res.data;
    if (data.status) {
      revalidatePath("/master/marital-status");
    }
    return data;
  } catch (error) {
    return { status: false, message: "Failed to create marital status" };
  }
}

export async function createMaritalStatuses(names: string[]): Promise<{ status: boolean; message: string }> {
  if (!names.length) {
    return { status: false, message: "At least one name is required" };
  }
  try {
    const res = await authFetch(`/marital-statuses/bulk`, {
      method: "POST",
      body: JSON.stringify({ names }),
    });
    const data = res.data;
    if (data.status) {
      revalidatePath("/master/marital-status");
    }
    return data;
  } catch (error) {
    return { status: false, message: "Failed to create marital statuses" };
  }
}

export async function updateMaritalStatus(id: string, formData: FormData): Promise<{ status: boolean; message: string; data?: MaritalStatus }> {
  const name = formData.get("name") as string;
  if (!name?.trim()) {
    return { status: false, message: "Name is required" };
  }
  try {
    const res = await authFetch(`/marital-statuses/${id}`, {
      method: "PUT",
      body: JSON.stringify({ id, name }),
    });
    const data = res.data;
    if (data.status) {
      revalidatePath("/master/marital-status");
    }
    return data;
  } catch (error) {
    return { status: false, message: "Failed to update marital status" };
  }
}

export async function deleteMaritalStatus(id: string): Promise<{ status: boolean; message: string }> {
  try {
    const res = await authFetch(`/marital-statuses/${id}`, {
      method: "DELETE",
    });
    const data = res.data;
    if (data.status) {
      revalidatePath("/master/marital-status");
    }
    return data;
  } catch (error) {
    return { status: false, message: "Failed to delete marital status" };
  }
}

export async function deleteMaritalStatuses(ids: string[]): Promise<{ status: boolean; message: string }> {
  if (!ids.length) {
    return { status: false, message: "No items to delete" };
  }
  try {
    const res = await authFetch(`/marital-statuses/bulk`, {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
    const data = res.data;
    if (data.status) {
      revalidatePath("/master/marital-status");
    }
    return data;
  } catch (error) {
    return { status: false, message: "Failed to delete marital statuses" };
  }
}

export async function updateMaritalStatuses(items: { id: string; name: string }[]): Promise<{ status: boolean; message: string }> {
  if (!items.length) {
    return { status: false, message: "No items to update" };
  }
  try {
    const res = await authFetch(`/marital-statuses/bulk`, {
      method: "PUT",
      body: JSON.stringify({ items }),
    });
    const data = res.data;
    if (data.status) {
      revalidatePath("/master/marital-status");
    }
    return data;
  } catch (error) {
    return { status: false, message: "Failed to update marital statuses" };
  }
}