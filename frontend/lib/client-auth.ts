"use client";

import { getApiBaseUrl } from "./utils";


export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string | null;
  permissions: string[];
  isActive?: boolean;
  isSystem?: boolean;
}

// Client-side login function - now calls backend directly
export async function loginClient(email: string, password: string): Promise<{
  status: boolean;
  message: string;
  user?: User;
}> {
  if (!email || !password) {
    return { status: false, message: "Email and password are required" };
  }

  try {
    const res = await fetch(`${getApiBaseUrl()}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      credentials: "include", // Important for cookies
    });

    const data = await res.json();

    if (data.status) {
      return {
        status: true,
        message: "Login successful",
        user: data.data?.user
      };
    }

    return { status: false, message: data.message || "Login failed" };
  } catch (error) {
    console.error("Login error:", error);
    return { status: false, message: "Failed to connect to server" };
  }
}

// Client-side POS login function
export async function getPosContext(
  code?: string,
  lat?: number,
  lng?: number,
): Promise<{ status: boolean; message: string; data?: any }> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/auth/pos/context`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, lat, lng }),
    });
    return res.json();
  } catch (error) {
    return { status: false, message: "Network error" };
  }
}

export async function getGlobalPosContext(
  code: string
): Promise<{ status: boolean; message: string; data?: any }> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/auth/pos/global-context`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    return res.json();
  } catch (error) {
    return { status: false, message: "Network error" };
  }
}

export async function adminFetchLocationsClient(): Promise<{ status: boolean; message: string; data?: any }> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/locations?pos=true`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    return res.json();
  } catch (error) {
    return { status: false, message: "Network error" };
  }
}

export async function posLoginClient(terminalCode: string, pin: string, tenantId?: string): Promise<{
  status: boolean;
  message: string;
  errorType?: string;
  data?: any;
}> {
  if (!terminalCode || !pin) {
    return { status: false, message: "Terminal Code and PIN are required" };
  }

  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (tenantId) {
      headers["x-tenant-id"] = tenantId;
    }

    const res = await fetch(`${getApiBaseUrl()}/auth/pos-login`, {
      method: "POST",
      headers,
      body: JSON.stringify({ terminalCode, pin }),
      credentials: "include",
    });

    const data = await res.json();

    if (data.status) {
      return {
        status: true,
        message: data.message || "POS Authentication successful",
        errorType: data.errorType,
        data: data.data
      };
    }

    return { status: false, message: data.message || "POS Authentication failed" };
  } catch (error) {
    console.error("POS Login error:", error);
    return { status: false, message: "Failed to connect to server" };
  }
}

// Clear all auth-related cookies directly
export function clearAuthCookies() {
  const cookies = [
    "accessToken",
    "app-environment",
    "app-theme",
    "bid",
    "refreshToken",
    "sessionId",
    "user",
    "userRole",
  ];

  // Try to determine base domain for cross-subdomain clearing
  const host = window.location.hostname;
  const parts = host.split(".");
  const isIP = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(host);
  const baseDomain = (!isIP && parts.length >= 2) ? `.${parts.slice(-2).join(".")}` : host;

  cookies.forEach((name) => {
    // 1. Clear for current domain + path
    document.cookie = `${name}=; Max-Age=-99999999; path=/;`;
    
    // 2. Clear for base domain if applicable
    if (!isIP && parts.length >= 2) {
      document.cookie = `${name}=; Max-Age=-99999999; path=/; domain=${baseDomain};`;
      document.cookie = `${name}=; Max-Age=-99999999; path=/; domain=${parts.slice(-2).join(".")};`;
    }
  });
}

// Client-side logout function - now calls backend AND clears local cookies
export async function logoutClient(): Promise<{ status: boolean; message: string }> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
      credentials: "include",
    });

    const data = await res.json();
    
    // Always clear local cookies regardless of backend response status
    clearAuthCookies();
    
    return { status: data.status, message: data.message };
  } catch (error) {
    console.error("Logout error:", error);
    
    // Attempt to clear cookies even if network fails
    clearAuthCookies();
    
    return { status: false, message: "Logout failed" };
  }
}

// Client-side endpoint to explicitely verify the validity of an open POS session
export async function verifyPosSessionClient(): Promise<any> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/auth/pos/verify-session`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    return await res.json();
  } catch (error) {
    console.error("Error verifying POS session:", error);
    return { status: false, message: "Verification failed" };
  }
}

// Client-side token refresh function - now calls backend directly
export async function refreshTokenClient(): Promise<{ success: boolean; isNetworkError: boolean }> {
  try {
    // Get refresh token from cookie (sent automatically with credentials: include)
    const res = await fetch(`${getApiBaseUrl()}/auth/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({}), // Backend will get refreshToken from cookie
    });

    if (res.status === 401) {
      return { success: false, isNetworkError: false }; // True token expiry
    }

    if (!res.ok) {
      return { success: false, isNetworkError: true }; // Server error or gateway timeout
    }

    const data = await res.json();
    return { success: data.status, isNetworkError: false };
  } catch (error) {
    console.error("Token refresh error:", error);
    return { success: false, isNetworkError: true }; // Network drop
  }
}

export async function loginPosUser(email: string, pass: string): Promise<{ status: boolean; message: string; data?: any }> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/auth/pos/user-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, pass }),
      credentials: "include",
    });
    return res.json();
  } catch (error) {
    return { status: false, message: "Network error" };
  }
}

// Get all active profiles on this browser
export async function getAvailableProfilesClient(): Promise<User[]> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/auth/profiles`, {
      method: "GET",
      credentials: "include",
    });
    const data = await res.json();
    if (data && data.status && Array.isArray(data.data)) {
      return data.data;
    }
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Fetch profiles error:", error);
    return [];
  }
}

export async function switchPosSessionClient(): Promise<{ status: boolean; message: string; data?: any }> {
  try {
    const res = await fetch(`${getApiBaseUrl()}/auth/pos/switch-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });
    return res.json();
  } catch (error) {
    return { status: false, message: "Network error" };
  }
}