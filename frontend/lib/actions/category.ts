"use server";
import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface Category {
  id: string;
  name: string;
  parentId?: string | null;
  accountHeadId?: string | null;
  createdAt: string;
  updatedAt: string;
  parent?: Category | null;
  children?: Category[];
  _count?: {
    children: number;
  };
}

const BASE_URL = "/master/erp/category";

export async function getCategories(parentId?: string): Promise<{ status: boolean; data: Category[]; message?: string }> {
  try {
    const url = parentId ? `${BASE_URL}?parentId=${parentId}` : BASE_URL;
    const res = await authFetch(url);
    const result = res.data;
    return result;
  } catch (error) {
    return { status: false, data: [], message: "Failed to fetch categories" };
  }
}

export async function getCategoryTree(): Promise<{ status: boolean; data: Category[]; message?: string }> {
  try {
    const res = await authFetch(`${BASE_URL}/tree`);
    const result = res.data;
    return result;
  } catch (error) {
    return { status: false, data: [], message: "Failed to fetch category tree" };
  }
}

export async function getCategory(id: string): Promise<{ status: boolean; data: Category | null; message?: string }> {
  try {
    const res = await authFetch(`${BASE_URL}/${id}`);
    const result = res.data;
    return result;
  } catch (error) {
    return { status: false, data: null, message: "Failed to fetch category" };
  }
}

export async function createCategory(data: any): Promise<{ status: boolean; message: string; data?: Category }> {
  try {
    const res = await authFetch(BASE_URL, {
      method: "POST",
      body: JSON.stringify(data),
    });
    const result = res.data;
    if (result.status) {
      revalidatePath("/master/category");
      revalidatePath("/master/sub-category");
    }
    return result;
  } catch (error) {
    return { status: false, message: "Failed to create category" };
  }
}

export async function updateCategory(id: string, data: any): Promise<{ status: boolean; message: string; data?: Category }> {
  try {
    const res = await authFetch(`${BASE_URL}/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    const result = res.data;
    if (result.status) {
      revalidatePath("/master/category");
      revalidatePath("/master/sub-category");
    }
    return result;
  } catch (error) {
    return { status: false, message: "Failed to update category" };
  }
}

export async function deleteCategory(id: string): Promise<{ status: boolean; message: string }> {
  try {
    const res = await authFetch(`${BASE_URL}/${id}`, {
      method: "DELETE",
    });
    const result = res.data;
    if (result.status) {
      revalidatePath("/master/category");
      revalidatePath("/master/sub-category");
    }
    return result;
  } catch (error) {
    return { status: false, message: "Failed to delete category" };
  }
}
