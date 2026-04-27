"use server";
import { authFetch } from "@/lib/auth";

export interface UserPreference {
  id: string;
  userId: string;
  key: string;
  value: string;
  createdAt: string;
  updatedAt: string;
}

export async function getUserPreference(
  key: string
): Promise<{ status: boolean; data?: UserPreference | null; message?: string }> {
  try {
    const encodedKey = encodeURIComponent(key);
    const res = await authFetch(`/user-preferences/${encodedKey}`, {});
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to fetch user preference" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error fetching user preference:", error);
    return {
      status: false,
      message: error instanceof Error ? error.message : "Failed to fetch user preference. Please check your connection.",
    };
  }
}

export async function saveUserPreference(
  key: string,
  value: string
): Promise<{ status: boolean; data?: UserPreference; message?: string }> {
  try {
    const res = await authFetch(`/user-preferences`, {
      method: "POST",
      body: JSON.stringify({ key, value }),
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to save user preference" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error saving user preference:", error);
    return {
      status: false,
      message: error instanceof Error ? error.message : "Failed to save user preference. Please check your connection.",
    };
  }
}