"use server";
import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface SalePool {
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

// SalePool Actions
export async function getSalePools(): Promise<{ status: boolean; data: SalePool[]; message?: string }> {
  try {
    const res = await authFetch(`/sale-pools`, {
    });
    return res.data;
  } catch (error) {
    console.error("Failed to fetch sale pools:", error);
    return { status: false, data: [], message: "Failed to fetch sale pools" };
  }
}

export async function getSalePoolById(id: string): Promise<{ status: boolean; data: SalePool | null }> {
  try {
    const res = await authFetch(`/sale-pools/${id}`, {
    });
    return res.data;
  } catch (error) {
    console.error("Failed to fetch sale pool:", error);
    return { status: false, data: null };
  }
}

export async function createSalePool(data: FormData | { name: string }): Promise<{ status: boolean; message: string; data?: SalePool }> {
  let name: string;
  if (data instanceof FormData) {
    name = data.get("name") as string;
  } else {
    name = data.name;
  }

  if (!name?.trim()) {
    return { status: false, message: "Name is required" };
  }
  try {
    const res = await authFetch(`/sale-pools`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    const result = res.data;
    if (result.status) {
      revalidatePath("/master/sale-pool/list");
    }
    return result;
  } catch (error) {
    return { status: false, message: "Failed to create sale pool" };
  }
}

export async function createSalePools(names: string[]): Promise<{ status: boolean; message: string; data?: SalePool[] }> {
  if (!names.length) {
    return { status: false, message: "At least one name is required" };
  }
  try {
    const results = await Promise.all(names.map(name =>
      authFetch(`/sale-pools`, {
        method: "POST",
        body: JSON.stringify({ name }),
      }).then(r => r.data)
    ));

    const allSuccess = results.every(r => r.id || r.status !== false);

    if (allSuccess) {
      revalidatePath("/master/sale-pool/list");
      return { status: true, message: "Sale pools created successfully" };
    }
    return { status: false, message: "Some sale pools failed to create" };

  } catch (error) {
    return { status: false, message: "Failed to create sale pools" };
  }
}

export async function updateSalePool(id: string, data: FormData | { name: string }): Promise<{ status: boolean; message: string }> {
  let name: string;
  if (data instanceof FormData) {
    name = data.get("name") as string;
  } else {
    name = data.name;
  }
  try {
    const res = await authFetch(`/sale-pools/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    });
    const result = res.data;
    if (result.id || result.status) {
      revalidatePath("/master/sale-pool/list");
      return { status: true, message: "Sale pool updated successfully" };
    }
    return { status: false, message: result.message || "Failed to update sale pool" };
  } catch (error) {
    return { status: false, message: "Failed to update sale pool" };
  }
}

export async function deleteSalePool(id: string): Promise<{ status: boolean; message: string }> {
  try {
    const res = await authFetch(`/sale-pools/${id}`, {
      method: "DELETE",
    });
    const data = res.data;
    if (data.id || data.status) {
      revalidatePath("/master/sale-pool/list");
      return { status: true, message: "Sale pool deleted successfully" };
    }
    return { status: false, message: data.message || "Failed to delete sale pool" };
  } catch (error) {
    return { status: false, message: "Failed to delete sale pool" };
  }
}
