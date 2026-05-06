"use server";

import { authFetch } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";

const API_BASE = process.env.API_URL || "http://localhost:5000/api";

export interface AuthResponse {
  status: boolean;
  message: string;
  data?: {
    user: any;
    accessToken: string;
    refreshToken: string;
  };
}

// Login action - for server-side use, calls backend directly
export async function login(formData: FormData): Promise<{
  status: boolean;
  message: string;
}> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { status: false, message: "Email and password are required" };
  }

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "include",
    });

    const data: AuthResponse = await res.json();

    if (data.status && data.data) {
      return {
        status: true,
        message: "Login successful"
      };
    }

    return { status: false, message: data.message || "Login failed" };
  } catch (error) {
    console.error("Login error:", error);
    return { status: false, message: "Failed to connect to server" };
  }
}

// Logout action - now calls Next.js API route
export async function logout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      credentials: "include",
    });
  } catch (error) {
    console.error("Logout error:", error);
  }

  redirect("/login");
}

// Change password
export async function changePassword(formData: FormData): Promise<{ status: boolean; message: string }> {
  const currentPassword = formData.get("currentPassword") as string;
  const newPassword = formData.get("newPassword") as string;

  if (!currentPassword || !newPassword) {
    return { status: false, message: "All fields are required" };
  }

  try {
    const response = await authFetch("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    const data = response.data;
    return { status: data.status, message: data.message };
  } catch (error) {
    console.error("Change password error:", error);
    return { status: false, message: "Failed to change password" };
  }
}
