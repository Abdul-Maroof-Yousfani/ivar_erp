"use server";
import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface Salesman {
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

// Salesman Actions
export async function getSalesmen(): Promise<{ status: boolean; data: Salesman[]; message?: string }> {
  try {
    const res = await authFetch(`/salesmen`, {
    });
    return res.data;
  } catch (error) {
    console.error("Failed to fetch salesmen:", error);
    return { status: false, data: [], message: "Failed to fetch salesmen" };
  }
}

export async function getSalesmanById(id: string): Promise<{ status: boolean; data: Salesman | null }> {
  try {
    const res = await authFetch(`/salesmen/${id}`, {
    });
    return res.data;
  } catch (error) {
    console.error("Failed to fetch salesman:", error);
    return { status: false, data: null };
  }
}

export async function createSalesmen(names: string[]): Promise<{ status: boolean; message: string; data?: Salesman[] }> {
  if (!names.length) {
    return { status: false, message: "At least one name is required" };
  }
  try {
    const results = await Promise.all(names.map(name =>
      authFetch(`/salesmen`, {
        method: "POST",
        body: JSON.stringify({ name }),
      }).then(r => r.data)
    ));

    // Check if all succeeded
    const allSuccess = results.every(r => r.id || r.status !== false);

    if (allSuccess) {
      revalidatePath("/erp/inventory-master/salesman");
      return { status: true, message: "Salesmen created successfully" };
    }
    return { status: false, message: "Some salesmen failed to create" };

  } catch (error) {
    return { status: false, message: "Failed to create salesmen" };
  }
}

export async function updateSalesman(id: string, formData: FormData): Promise<{ status: boolean; message: string }> {
  const name = formData.get("name") as string;
  try {
    const res = await authFetch(`/salesmen/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    });
    const data = res.data;
    if (data.id || data.status) {
      revalidatePath("/erp/inventory-master/salesman");
      return { status: true, message: "Salesman updated successfully" };
    }
    return { status: false, message: data.message || "Failed to update salesman" };
  } catch (error) {
    return { status: false, message: "Failed to update salesman" };
  }
}

export async function updateSalesmen(items: { id: string; name: string }[]): Promise<{ status: boolean; message: string }> {
  try {
    await Promise.all(items.map(item =>
      authFetch(`/salesmen/${item.id}`, {
        method: "PUT",
        body: JSON.stringify({ name: item.name }),
      })
    ));
    revalidatePath("/erp/inventory-master/salesman");
    return { status: true, message: "Salesmen updated successfully" };
  } catch (error) {
    return { status: false, message: "Failed to update salesmen" };
  }
}

export async function deleteSalesman(id: string): Promise<{ status: boolean; message: string }> {
  try {
    const res = await authFetch(`/salesmen/${id}`, {
      method: "DELETE",
    });
    const data = res.data;
    if (data.id || data.status) {
      revalidatePath("/erp/inventory-master/salesman");
      return { status: true, message: "Salesman deleted successfully" };
    }
    return { status: false, message: data.message || "Failed to delete salesman" };
  } catch (error) {
    return { status: false, message: "Failed to delete salesman" };
  }
}

export async function deleteSalesmen(ids: string[]): Promise<{ status: boolean; message: string }> {
  try {
    await Promise.all(ids.map(id =>
      authFetch(`/salesmen/${id}`, {
        method: "DELETE",
      })
    ));
    revalidatePath("/erp/inventory-master/salesman");
    return { status: true, message: "Salesmen deleted successfully" };
  } catch (error) {
    return { status: false, message: "Failed to delete salesmen" };
  }
}
