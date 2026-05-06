"use server";
import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface Designation {
  id: string;
  name: string;
  status: string;
  createdBy?: {
    firstName: string;
    lastName: string;
  };
  createdAt: string;
  updatedAt: string;
}

// Designation Actions
export async function getDesignations(): Promise<{ status: boolean; data: Designation[]; message?: string }> {
  try {
    const res = await authFetch(`/designations`, {});
    return res.data;
  } catch (error) {
    console.error("Failed to fetch designations:", error);
    return { status: false, data: [], message: "Failed to fetch designations" };
  }
}

export async function getDesignationById(id: string): Promise<{ status: boolean; data: Designation | null }> {
  try {
    const res = await authFetch(`/designations/${id}`, {});
    return res.data;
  } catch (error) {
    console.error("Failed to fetch designation:", error);
    return { status: false, data: null };
  }
}

export async function createDesignation(formData: FormData): Promise<{ status: boolean; message: string; data?: Designation }> {
  const name = formData.get("name") as string;
  if (!name?.trim()) {
    return { status: false, message: "Name is required" };
  }
  try {
    const res = await authFetch(`/designations`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    const data = res.data;
    if (data.status) {
      revalidatePath("/master/designation");
    }
    return data;
  } catch (error) {
    return { status: false, message: "Failed to create designation" };
  }
}

export async function createDesignations(names: string[]): Promise<{ status: boolean; message: string; data?: Designation[] }> {
  if (!names.length) {
    return { status: false, message: "At least one name is required" };
  }
  try {
    const res = await authFetch(`/designations/bulk`, {
      method: "POST",
      body: JSON.stringify({ names }),
    });
    const data = res.data;
    if (data.status) {
      revalidatePath("/master/designation");
    }
    return data;
  } catch (error) {
    return { status: false, message: "Failed to create designations" };
  }
}

export async function updateDesignation(id: string, formData: FormData): Promise<{ status: boolean; message: string; data?: Designation }> {
  const name = formData.get("name") as string;
  if (!name?.trim()) {
    return { status: false, message: "Name is required" };
  }
  try {
    const res = await authFetch(`/designations/${id}`, {
      method: "PUT",
      body: JSON.stringify({ id, name }),
    });
    const data = res.data;
    if (data.status) {
      revalidatePath("/master/designation");
    }
    return data;
  } catch (error) {
    return { status: false, message: "Failed to update designation" };
  }
}

export async function deleteDesignation(id: string): Promise<{ status: boolean; message: string }> {
  try {
    const res = await authFetch(`/designations/${id}`, {
      method: "DELETE",
    });
    const data = res.data;
    if (data.status) {
      revalidatePath("/master/designation");
    }
    return data;
  } catch (error) {
    return { status: false, message: "Failed to delete designation" };
  }
}

export async function deleteDesignations(ids: string[]): Promise<{ status: boolean; message: string }> {
  if (!ids.length) {
    return { status: false, message: "No items to delete" };
  }
  try {
    const res = await authFetch(`/designations/bulk`, {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
    const data = res.data;
    if (data.status) {
      revalidatePath("/master/designation");
    }
    return data;
  } catch (error) {
    return { status: false, message: "Failed to delete designations" };
  }
}

export async function updateDesignations(
  items: { id: string; name: string }[]): Promise<{ status: boolean; message: string }> {
  if (!items.length) {
    return { status: false, message: "No items to update" };
  }
  try {
    const res = await authFetch(`/designations/bulk`, {
      method: "PUT",
      body: JSON.stringify({ items }),
    });
    const data = res.data;
    if (data.status) {
      revalidatePath("/master/designation");
    }
    return data;
  } catch (error) {
    return { status: false, message: "Failed to update designations" };
  }
}
