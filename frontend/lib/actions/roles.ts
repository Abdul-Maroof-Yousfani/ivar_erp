"use server";
import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface Role {
  id: string;
  name: string;
  description?: string;
  isSystem: boolean;
  createdAt: string;
  permissions?: {
    permission: {
      id: string;
      name: string;
      module: string;
      action: string;
    };
  }[];
  _count?: {
    users: number;
  };
}

export async function getRoles(): Promise<{ status: boolean; data: Role[]; message?: string }> {
  try {
    const res = await authFetch(`/roles`, {});
    if (res.ok) {
      const data = res.data;
      if (Array.isArray(data) && data.length > 0) {
        return { status: true, data };
      }
    }
    // Fallback: /auth/roles (Jwt only, no PermissionsGuard)
    const res2 = await authFetch(`/auth/roles`, {});
    if (res2.ok) {
      const payload = res2.data;
      const roles = Array.isArray(payload?.data) ? payload.data : [];
      return { status: true, data: roles };
    }
    return { status: false, data: [], message: "Unable to load roles" };
  } catch (error) {
    console.error("Failed to fetch roles:", error);
    return { status: false, data: [], message: "Failed to fetch roles" };
  }
}

export async function getRoleById(id: string): Promise<{ status: boolean; data: Role | null }> {
  try {
    const res = await authFetch(`/roles/${id}`, {});
    if (!res.ok) {
      if (res.status === 404) return { status: false, data: null };
      const error = res.data;
      console.error(`Failed to fetch role: ${res.status}`, error);
      return { status: false, data: null };
    }
    const data = res.data;
    return { status: true, data };
  } catch (error) {
    console.error("Failed to fetch role:", error);
    return { status: false, data: null };
  }
}

export async function createRole(data: { name: string; description?: string; permissionIds?: string[] }) {
  try {
    const res = await authFetch(`/roles`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = res.data;
      return { status: false, message: error.message || "Failed to create role" };
    }
    revalidatePath("/admin/roles");
    return { status: true, message: "Role created successfully" };
  } catch (error) {
    return { status: false, message: "Failed to create role" };
  }
}

export async function updateRole(id: string, data: { name?: string; description?: string; permissionIds?: string[] }) {
  try {
    const res = await authFetch(`/roles/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const error = res.data;
      return { status: false, message: error.message || "Failed to update role" };
    }
    revalidatePath("/admin/roles");
    return { status: true, message: "Role updated successfully" };
  } catch (error) {
    return { status: false, message: "Failed to update role" };
  }
}

export async function deleteRole(id: string) {
  try {
    const res = await authFetch(`/roles/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const error = res.data;
      return { status: false, message: error.message || "Failed to delete role" };
    }
    revalidatePath("/admin/roles");
    return { status: true, message: "Role deleted successfully" };
  } catch (error) {
    return { status: false, message: "Failed to delete role" };
  }
}
