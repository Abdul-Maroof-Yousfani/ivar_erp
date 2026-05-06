"use server";
import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface Uom {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

const BASE_URL = "/master/erp/uom";

export async function getUoms(): Promise<{ status: boolean; data: Uom[]; message?: string }> {
  try {
    const res = await authFetch(BASE_URL);
    const result = res.data;
    return result;
  } catch (error) {
    return { status: false, data: [], message: "Failed to fetch UOMs" };
  }
}

export async function getUom(id: string): Promise<{ status: boolean; data: Uom | null; message?: string }> {
  try {
    const res = await authFetch(`${BASE_URL}/${id}`);
    const result = res.data;
    return result;
  } catch (error) {
    return { status: false, data: null, message: "Failed to fetch UOM" };
  }
}

export async function createUom(data: any): Promise<{ status: boolean; message: string; data?: Uom }> {
  try {
    const res = await authFetch(BASE_URL, {
      method: "POST",
      body: JSON.stringify(data),
    });
    const result = res.data;
    if (result.status) {
      revalidatePath("/master/unit-of-measurement");
    }
    return result;
  } catch (error) {
    return { status: false, message: "Failed to create UOM" };
  }
}

export async function updateUom(id: string, data: any): Promise<{ status: boolean; message: string; data?: Uom }> {
  try {
    const res = await authFetch(`${BASE_URL}/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    const result = res.data;
    if (result.status) {
      revalidatePath("/master/unit-of-measurement");
    }
    return result;
  } catch (error) {
    return { status: false, message: "Failed to update UOM" };
  }
}

export async function deleteUom(id: string): Promise<{ status: boolean; message: string }> {
  try {
    const res = await authFetch(`${BASE_URL}/${id}`, {
      method: "DELETE",
    });
    const result = res.data;
    if (result.status) {
      revalidatePath("/master/uom");
    }
    return result;
  } catch (error) {
    return { status: false, message: "Failed to delete UOM" };
  }
}
