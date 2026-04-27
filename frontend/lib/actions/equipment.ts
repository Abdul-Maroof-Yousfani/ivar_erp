"use server";
import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface Equipment {
  id: string;
  name: string;
  status: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export async function getEquipments(): Promise<{ status: boolean; data: Equipment[]; message?: string }> {
  try {
    const res = await authFetch(`/equipments`, {});
    return res.data;
  } catch (error) {
    console.error("Failed to fetch equipments:", error);
    return { status: false, data: [], message: "Failed to fetch equipments" };
  }
}

export async function createEquipment(formData: FormData): Promise<{ status: boolean; message: string; data?: Equipment }> {
  const name = formData.get("name") as string;
  if (!name?.trim()) {
    return { status: false, message: "Name is required" };
  }
  try {
    const res = await authFetch(`/equipments`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/equipment");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to create equipment" };
  }
}

export async function createEquipments(items: { name: string }[]): Promise<{ status: boolean; message: string }> {
  if (!items.length) return { status: false, message: "At least one equipment is required" };
  try {
    const res = await authFetch(`/equipments/bulk`, {
      method: "POST",
      body: JSON.stringify({ items }),
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/equipment");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to create equipments" };
  }
}

export async function updateEquipment(id: string, formData: FormData): Promise<{ status: boolean; message: string; data?: Equipment }> {
  const name = formData.get("name") as string;
  if (!name?.trim()) return { status: false, message: "Name is required" };
  try {
    const res = await authFetch(`/equipments/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/equipment");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to update equipment" };
  }
}

export async function deleteEquipment(id: string): Promise<{ status: boolean; message: string }> {
  try {
    const res = await authFetch(`/equipments/${id}`, {
      method: "DELETE",
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/equipment");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to delete equipment" };
  }
}

export async function deleteEquipments(ids: string[]): Promise<{ status: boolean; message: string }> {
  if (!ids.length) return { status: false, message: "No items to delete" };
  try {
    const res = await authFetch(`/equipments/bulk`, {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/equipment");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to delete equipments" };
  }
}

export async function updateEquipments(items: { id: string; name: string }[]): Promise<{ status: boolean; message: string }> {
  if (!items.length) return { status: false, message: "No items to update" };
  try {
    const res = await authFetch(`/equipments/bulk`, {
      method: "PUT",
      body: JSON.stringify({ items }),
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/equipment");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to update equipments" };
  }
}