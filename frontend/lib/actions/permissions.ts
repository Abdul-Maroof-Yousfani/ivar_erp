"use server";
import { authFetch } from "@/lib/auth";

export interface Permission {
  id: string;
  name: string;
  module: string;
  action: string;
  description?: string;
}

export async function getPermissions(): Promise<{ status: boolean; data: Permission[]; message?: string }> {
  try {
    const res = await authFetch(`/permissions`, {
      cache: "force-cache", // Permissions rarely change
    });
    if (!res.ok) {
      console.error(`Failed to fetch permissions: ${res.status} ${res.statusText}`);
      // If 401/403, it means auth failed. Return empty but log it.
      if (res.status === 401 || res.status === 403) {
        return { status: false, data: [], message: "Authentication failed" };
      }
      return { status: false, data: [], message: `HTTP error! status: ${res.status}` };
    }
    const data = res.data;
    // Check if data is array (successful response)
    if (Array.isArray(data)) {
      return { status: true, data };
    }
    console.error("Permissions fetch returned non-array:", data);
    return { status: false, data: [], message: "Invalid response format" };
  } catch (error) {
    console.error("Failed to fetch permissions:", error);
    return { status: false, data: [], message: "Failed to fetch permissions" };
  }
}