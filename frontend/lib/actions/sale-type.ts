"use server";
import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface SaleType {
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

// SaleType Actions
export async function getSaleTypes(): Promise<{ status: boolean; data: SaleType[]; message?: string }> {
  try {
    const res = await authFetch(`/sale-types`, {
    });
    return res.data;
  } catch (error) {
    console.error("Failed to fetch sale types:", error);
    return { status: false, data: [], message: "Failed to fetch sale types" };
  }
}

export async function getSaleTypeById(id: string): Promise<{ status: boolean; data: SaleType | null }> {
  try {
    const res = await authFetch(`/sale-types/${id}`, {
    });
    return res.data;
  } catch (error) {
    console.error("Failed to fetch sale type:", error);
    return { status: false, data: null };
  }
}

export async function createSaleType(data: FormData | { name: string }): Promise<{ status: boolean; message: string; data?: SaleType }> {
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
    const res = await authFetch(`/sale-types`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    const result = res.data;
    if (result.status) {
      revalidatePath("/master/sale-type/list");
    }
    return result;
  } catch (error) {
    return { status: false, message: "Failed to create sale type" };
  }
}

export async function createSaleTypes(names: string[]): Promise<{ status: boolean; message: string; data?: SaleType[] }> {
  if (!names.length) {
    return { status: false, message: "At least one name is required" };
  }
  try {
    const results = await Promise.all(names.map(name =>
      authFetch(`/sale-types`, {
        method: "POST",
        body: JSON.stringify({ name }),
      }).then(r => r.data)
    ));

    const allSuccess = results.every(r => r.id || r.status !== false);

    if (allSuccess) {
      revalidatePath("/master/sale-type/list");
      return { status: true, message: "Sale types created successfully" };
    }
    return { status: false, message: "Some sale types failed to create" };

  } catch (error) {
    return { status: false, message: "Failed to create sale types" };
  }
}

export async function updateSaleType(id: string, data: FormData | { name: string }): Promise<{ status: boolean; message: string }> {
  let name: string;
  if (data instanceof FormData) {
    name = data.get("name") as string;
  } else {
    name = data.name;
  }
  try {
    const res = await authFetch(`/sale-types/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    });
    const result = res.data;
    if (result.id || result.status) {
      revalidatePath("/master/sale-type/list");
      return { status: true, message: "Sale type updated successfully" };
    }
    return { status: false, message: result.message || "Failed to update sale type" };
  } catch (error) {
    return { status: false, message: "Failed to update sale type" };
  }
}

export async function updateSaleTypes(items: { id: string; name: string }[]): Promise<{ status: boolean; message: string }> {
  try {
    await Promise.all(items.map(item =>
      authFetch(`/sale-types/${item.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: item.name }),
      })
    ));
    revalidatePath("/master/sale-type");
    return { status: true, message: "Sale types updated successfully" };
  } catch (error) {
    return { status: false, message: "Failed to update sale types" };
  }
}

export async function deleteSaleType(id: string): Promise<{ status: boolean; message: string }> {
  try {
    const res = await authFetch(`/sale-types/${id}`, {
      method: "DELETE",
    });
    const data = res.data;
    if (data.id || data.status) {
      revalidatePath("/master/sale-type");
      return { status: true, message: "Sale type deleted successfully" };
    }
    return { status: false, message: data.message || "Failed to delete sale type" };
  } catch (error) {
    return { status: false, message: "Failed to delete sale type" };
  }
}

export async function deleteSaleTypes(ids: string[]): Promise<{ status: boolean; message: string }> {
  try {
    await Promise.all(ids.map(id =>
      authFetch(`/sale-types/${id}`, {
        method: "DELETE",
      })
    ));
    revalidatePath("/master/sale-type/list");
    return { status: true, message: "Sale types deleted successfully" };
  } catch (error) {
    return { status: false, message: "Failed to delete sale types" };
  }
}
