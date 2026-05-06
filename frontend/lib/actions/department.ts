"use server";

import { revalidatePath } from "next/cache";
import { authFetch } from "@/lib/auth";

const API_BASE = process.env.API_URL || "http://localhost:5000/api";

export interface Department {
  id: string;
  name: string;
  headId?: string | null;
  head?: {
    id: string;
    employeeId: string;
    employeeName: string;
  } | null;
  headName?: string | null;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  allocationId?: string | null;
  allocation?: {
    id: string;
    name: string;
  } | null;
  allocationName?: string | null;
  subDepartments?: SubDepartment[];
}

export interface SubDepartment {
  id: string;
  name: string;
  departmentId: string;
  department?: Department;
  departmentName?: string;
  headId?: string | null;
  head?: {
    id: string;
    employeeId: string;
    employeeName: string;
  } | null;
  headName?: string | null;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

// Department Actions
export async function getDepartments(): Promise<{ status: boolean; data: Department[]; message?: string }> {
  try {
    const res = await authFetch("/departments", {
      cache: "no-store"
    });
    return res.data;
  } catch (error) {
    console.error("Failed to fetch departments:", error);
    return { status: false, data: [], message: "Failed to fetch departments" };
  }
}

export async function getDepartmentById(id: string): Promise<{ status: boolean; data: Department | null }> {
  try {
    const res = await authFetch(`/departments/${id}`, {
      cache: "no-store"
    });
    return res.data;
  } catch (error) {
    console.error("Failed to fetch department:", error);
    return { status: false, data: null };
  }
}

export async function createDepartments(items: { name: string; allocationId?: string; headId?: string }[]): Promise<{ status: boolean; message: string; data?: Department[] }> {
  if (!items.length) {
    return { status: false, message: "At least one department is required" };
  }

  try {
    const res = await authFetch("/departments", {
      method: "POST",
      body: JSON.stringify({ items }),
    });
    const data = res.data;

    if (data.status) {
      revalidatePath("/master/department");
    }

    return data;
  } catch (error) {
    return { status: false, message: "Failed to create departments" };
  }
}

export async function updateDepartment(id: string, formData: FormData): Promise<{ status: boolean; message: string; data?: Department }> {
  const name = formData.get("name") as string;
  const headId = formData.get("headId") as string;

  if (!name?.trim()) {
    return { status: false, message: "Name is required" };
  }

  try {
    const res = await authFetch(`/departments/${id}`, {
      method: "PUT",
      body: JSON.stringify({ id, name, headId: headId || null }),
    });
    const data = res.data;

    if (data.status) {
      revalidatePath("/master/department");
    }

    return data;
  } catch (error) {
    return { status: false, message: "Failed to update department" };
  }
}

export async function deleteDepartment(id: string): Promise<{ status: boolean; message: string }> {
  try {
    const res = await authFetch(`/departments/${id}`, {
      method: "DELETE",
    });
    const data = res.data;

    if (data.status) {
      revalidatePath("/master/department");
    }

    return data;
  } catch (error) {
    return { status: false, message: "Failed to delete department" };
  }
}

export async function deleteDepartments(ids: string[]): Promise<{ status: boolean; message: string }> {
  if (!ids.length) {
    return { status: false, message: "No items to delete" };
  }

  try {
    const res = await authFetch("/departments/bulk", {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
    const data = res.data;

    if (data.status) {
      revalidatePath("/master/department");
    }

    return data;
  } catch (error) {
    return { status: false, message: "Failed to delete departments" };
  }
}

export async function updateDepartments(
  items: { id: string; name: string }[]
): Promise<{ status: boolean; message: string }> {
  if (!items.length) {
    return { status: false, message: "No items to update" };
  }

  try {
    const res = await authFetch("/departments/bulk", {
      method: "PUT",
      body: JSON.stringify({ items }),
    });
    const data = res.data;

    if (data.status) {
      revalidatePath("/master/department");
    }

    return data;
  } catch (error) {
    return { status: false, message: "Failed to update departments" };
  }
}

// Sub-Department Actions
export async function getSubDepartments(): Promise<{ status: boolean; data: SubDepartment[]; message?: string }> {
  try {
    const res = await authFetch("/sub-departments", {
      cache: "no-store"
    });
    return res.data;
  } catch (error) {
    console.error("Failed to fetch sub-departments:", error);
    return { status: false, data: [], message: "Failed to fetch sub-departments" };
  }
}

export async function getSubDepartmentsByDepartment(departmentId: string): Promise<{ status: boolean; data: SubDepartment[] }> {
  try {
    const res = await authFetch(`/sub-departments/department/${departmentId}`, {
      cache: "no-store"
    });
    return res.data;
  } catch (error) {
    console.error("Failed to fetch sub-departments:", error);
    return { status: false, data: [] };
  }
}

export async function createSubDepartment(formData: FormData): Promise<{ status: boolean; message: string; data?: SubDepartment }> {
  const name = formData.get("name") as string;
  const departmentId = formData.get("departmentId") as string;

  if (!name?.trim()) {
    return { status: false, message: "Name is required" };
  }
  if (!departmentId) {
    return { status: false, message: "Department is required" };
  }

  try {
    const res = await authFetch("/sub-departments", {
      method: "POST",
      body: JSON.stringify({ name, departmentId }),
    });
    const data = res.data;

    if (data.status) {
      revalidatePath("/master/sub-department");
    }

    return data;
  } catch (error) {
    return { status: false, message: "Failed to create sub-department" };
  }
}

export async function createSubDepartments(
  items: { name: string; departmentId: string; headId?: string }[]
): Promise<{ status: boolean; message: string; data?: SubDepartment[] }> {
  if (!items.length) {
    return { status: false, message: "At least one sub-department is required" };
  }

  try {
    const res = await authFetch("/sub-departments/bulk", {
      method: "POST",
      body: JSON.stringify({ items }),
    });
    const data = res.data;

    if (data.status) {
      revalidatePath("/master/sub-department");
    }

    return data;
  } catch (error) {
    return { status: false, message: "Failed to create sub-departments" };
  }
}

export async function updateSubDepartment(id: string, formData: FormData): Promise<{ status: boolean; message: string; data?: SubDepartment }> {
  const name = formData.get("name") as string;
  const departmentId = formData.get("departmentId") as string;
  const headId = formData.get("headId") as string;

  if (!name?.trim()) {
    return { status: false, message: "Name is required" };
  }

  try {
    const res = await authFetch(`/sub-departments/${id}`, {
      method: "PUT",
      body: JSON.stringify({ id, name, departmentId: departmentId || undefined, headId: headId || null }),
    });
    const data = res.data;

    if (data.status) {
      revalidatePath("/master/sub-department");
    }

    return data;
  } catch (error) {
    return { status: false, message: "Failed to update sub-department" };
  }
}

export async function deleteSubDepartment(id: string): Promise<{ status: boolean; message: string }> {
  try {
    const res = await authFetch(`/sub-departments/${id}`, {
      method: "DELETE",
    });
    const data = res.data;

    if (data.status) {
      revalidatePath("/master/sub-department");
    }

    return data;
  } catch (error) {
    return { status: false, message: "Failed to delete sub-department" };
  }
}

export async function deleteSubDepartments(ids: string[]): Promise<{ status: boolean; message: string }> {
  if (!ids.length) {
    return { status: false, message: "No items to delete" };
  }

  try {
    const res = await authFetch("/sub-departments/bulk", {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
    const data = res.data;

    if (data.status) {
      revalidatePath("/master/sub-department");
    }

    return data;
  } catch (error) {
    return { status: false, message: "Failed to delete sub-departments" };
  }
}

export async function updateSubDepartments(
  items: { id: string; name: string; departmentId: string }[]
): Promise<{ status: boolean; message: string }> {
  if (!items.length) {
    return { status: false, message: "No items to update" };
  }

  try {
    const res = await authFetch("/sub-departments/bulk", {
      method: "PUT",
      body: JSON.stringify({ items }),
    });
    const data = res.data;

    if (data.status) {
      revalidatePath("/master/sub-department");
    }

    return data;
  } catch (error) {
    return { status: false, message: "Failed to update sub-departments" };
  }
}
