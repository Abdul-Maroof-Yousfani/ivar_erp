"use server";

import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  isDashboardEnabled?: boolean;
  roleId?: string;
  role?: {
    id: string;
    name: string;
  };
  employeeId?: string;
  employee?: {
    id: string;
    employeeName: string;
    designation?: { name: string };
    department?: { name: string };
  };
}

export async function getUsers(): Promise<{ status: boolean; data: User[]; message?: string }> {
  try {
    const res = await authFetch(`/auth/users`, {});
    const payload = res.data;
    const users = Array.isArray(payload?.data) ? payload.data : (Array.isArray(payload) ? payload : []);
    return { status: true, data: users };
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return { status: false, data: [], message: "Failed to fetch users" };
  }
}

export async function createUser(data: {
  email: string;
  firstName: string;
  lastName: string;
  password?: string;
  employeeId?: string;
  roleId?: string;
}) {
  try {
    const payload = {
      ...data,
      password: data.password || "Password@123",
      isDashboardEnabled: false
    };
    const res = await authFetch(`/auth/users`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const message = res.data?.message || "Failed to create user";
      return { status: false, message };
    }
    revalidatePath("/hr/employee/user-account");
    return { status: true, message: "User account created successfully" };
  } catch (error) {
    return { status: false, message: "Failed to create user account" };
  }
}

export async function updateUserRole(userId: string, roleId: string | null) {
  try {
    const res = await authFetch(`/auth/users/update`, {
      method: "POST",
      body: JSON.stringify({
        id: userId,
        data: { roleId }
      }),
    });
    if (!res.ok) {
      const error = res.data;
      return { status: false, message: error.message || "Failed to update user role" };
    }
    revalidatePath("/hr/employee/user-account");
    return { status: true, message: "User role updated successfully" };
  } catch (error) {
    return { status: false, message: "Failed to update user role" };
  }
}

export async function updateUserDashboardAccess(userId: string, hasAccess: boolean) {
  try {
    const res = await authFetch(`/auth/users/update`, {
      method: "POST",
      body: JSON.stringify({
        id: userId,
        data: { isDashboardEnabled: hasAccess }
      }),
    });
    if (!res.ok) {
      const error = res.data;
      return { status: false, message: error.message || "Failed to update dashboard access" };
    }
    revalidatePath("/hr/employee/user-account");
    return { status: true, message: "Dashboard access updated successfully" };
  } catch (error) {
    return { status: false, message: "Failed to update dashboard access" };
  }
}

export async function verifyPassword(password: string): Promise<{ status: boolean; message: string }> {
  try {
    const res = await authFetch(`/auth/verify-password`, {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const error = res.data;
      return { status: false, message: error?.message || "Failed to verify password" };
    }
    return res.data;
  } catch (error) {
    return { status: false, message: "Failed to verify password" };
  }
}