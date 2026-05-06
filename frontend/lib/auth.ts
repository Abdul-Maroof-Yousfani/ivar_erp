
import { getApiBaseUrl } from "./utils";

const API_BASE = getApiBaseUrl();

export interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string | null;
  permissions: string[];
}

export interface AuthResponse {
  status: boolean;
  message: string;
  data?: {
    user: User;
    accessToken: string;
    refreshToken: string;
  };
}

// Decode JWT token to check expiration (without verification, just for reading)
function decodeToken(token: string): { exp?: number; iat?: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = parts[1];
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);

    const decoded = typeof window === 'undefined'
      ? Buffer.from(padded, 'base64').toString('utf-8')
      : atob(padded);

    const parsed = JSON.parse(decoded) as { exp?: number; iat?: number };
    return parsed;
  } catch {
    return null;
  }
}

// Check if token is already expired
function isTokenExpired(token: string | null | undefined): boolean {
  if (!token) return true;
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return true;
  return Date.now() >= decoded.exp * 1000;
}

// Check if token is expiring soon but still valid (within 30 minutes)
function isTokenExpiringSoon(token: string | null | undefined): boolean {
  if (!token) return false;
  if (isTokenExpired(token)) return false;
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return false;
  const expirationTime = decoded.exp * 1000;
  const now = Date.now();
  const thirtyMinutes = 30 * 60 * 1000;
  return expirationTime - now < thirtyMinutes && expirationTime > now;
}

export async function getCurrentUser(): Promise<User | null> {
  if (typeof window === 'undefined') {
    // Server-side: call the lightweight /auth/permissions endpoint instead of
    // relying on the user cookie (which may have stale/missing permissions).
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();

    // We still need the user cookie for basic identity (id, name, email, role)
    const userCookie = cookieStore.get("user")?.value;
    if (!userCookie) return null;

    let parsed: any;
    try {
      parsed = JSON.parse(userCookie);
    } catch {
      return null;
    }

    // Fetch fresh permissions from the lightweight endpoint
    try {
      const allCookies = cookieStore.getAll();
      const cookieHeader = allCookies.map(c => `${c.name}=${c.value}`).join('; ');

      const res = await fetch(`${API_BASE}/auth/permissions/lightweight`, {
        headers: {
          Cookie: cookieHeader,
        },
        cache: "no-store",
      });

      if (res.ok) {
        const data = await res.json();
        if (data?.status && data.data) {
          return {
            id: parsed.id,
            email: parsed.email,
            firstName: parsed.firstName,
            lastName: parsed.lastName,
            role: data.data.role ?? parsed.role?.name ?? parsed.role ?? null,
            permissions: data.data.permissions ?? [],
          };
        }
      }
    } catch {
      // Fall through to cookie-based fallback below
    }

    // Fallback: derive permissions from cookie if the API call failed
    let permissions: string[] = parsed.permissions ?? [];
    if (
      !permissions.length &&
      parsed.role?.permissions &&
      Array.isArray(parsed.role.permissions) &&
      parsed.role.permissions.length > 0
    ) {
      permissions = parsed.role.permissions
        .map((p: any) => p.permission?.name || p.name || (typeof p === 'string' ? p : null))
        .filter(Boolean);
    }

    return {
      id: parsed.id,
      email: parsed.email,
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      role: parsed.role?.name ?? parsed.role ?? null,
      permissions,
    };
  }

  const accessToken = await getAccessToken();
  if (!accessToken) return null;

  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      credentials: "include",
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (!data?.status || !data.data) return null;

    const apiUser = data.data;
    const permissions =
      apiUser.role?.permissions?.map((p: any) => p.permission?.name).filter(Boolean) ?? [];
    return {
      id: apiUser.id,
      email: apiUser.email,
      firstName: apiUser.firstName,
      lastName: apiUser.lastName,
      role: apiUser.role?.name ?? null,
      permissions,
    };
  } catch {
    return null;
  }
}

// Get access token (with automatic refresh if needed)
export async function getAccessToken(): Promise<string | null> {
  let accessToken: string | null = null;
  let refreshToken: string | null = null;

  if (typeof window === 'undefined') {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    accessToken = cookieStore.get("accessToken")?.value || null;
    refreshToken = cookieStore.get("refreshToken")?.value || null;

    if (accessToken && isTokenExpired(accessToken)) {
      cookieStore.delete("accessToken");
      accessToken = null;
    }
  } else {
    // Client-side: parse document.cookie
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
      return null;
    };
    accessToken = getCookie("accessToken");
    refreshToken = getCookie("refreshToken");
  }

  return accessToken;
}


// Authenticated fetch helper - works on both server and client
export async function authFetch(url: string, options: any = {}): Promise<any> {
  const BASE_URL = getApiBaseUrl();
  let fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url}`;

  // Handle query parameters
  if (options.params) {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const urlObj = new URL(fullUrl.startsWith('/') ? `${base}${fullUrl}` : fullUrl);
    Object.keys(options.params).forEach(key => {
      if (options.params[key] !== undefined && options.params[key] !== null) {
        urlObj.searchParams.append(key, String(options.params[key]));
      }
    });
    fullUrl = urlObj.toString();
  }

  if (typeof window === 'undefined') {
    // Server-side
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    let accessToken = cookieStore.get("accessToken")?.value || null;

    if (accessToken && isTokenExpired(accessToken)) {
      accessToken = null;
    }

    const allCookies = cookieStore.getAll();
    const cookieHeader = allCookies.map(c => `${c.name}=${c.value}`).join('; ');

    try {
      if (process.env.NODE_ENV === 'development') {
        console.log(`[authFetch Server] ${options.method || 'GET'} ${fullUrl}`);
      }

      const response = await fetch(fullUrl, {
        method: options.method || 'GET',
        headers: {
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...(cookieHeader ? { Cookie: cookieHeader } : {}),
          ...options.headers,
        },
        body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined,
        cache: "no-store",    // ✅ yeh sirf yahan add karo
        next: { revalidate: 0 }, // ✅ yeh bhi
      });

      // No native timeout in fetch like axios, but we can add one if critical.
      // For now keeping it simple as requested.

      const data = await response.json().catch(() => ({}));

      return {
        ok: response.ok,
        status: response.status,
        data: data,
      };
    } catch (error: any) {
      console.error(`[authFetch Server Error] ${options.method || 'GET'} ${fullUrl}:`, error.message);

      return {
        ok: false,
        status: 500,
        data: { message: error.message },
      };
    }
  } else {
    // Client-side
    try {
      const response = await fetch(fullUrl, {
        method: options.method || 'GET',
        headers: {
          ...(options.body ? { "Content-Type": "application/json" } : {}),
          ...options.headers,
        },
        body: options.body ? (typeof options.body === 'string' ? options.body : JSON.stringify(options.body)) : undefined,
        credentials: "include",
      });

      const data = await response.json().catch(() => ({}));

      return {
        ok: response.ok,
        status: response.status,
        data: data,
      };
    } catch (error: any) {
      console.error(`[authFetch Client Error] ${options.method || 'GET'} ${fullUrl}:`, error.message);
      return {
        ok: false,
        status: 500,
        data: { message: error.message },
      };
    }
  }
}

// Check permission helper
export async function hasPermission(permission: string): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user) return false;
  return user.permissions.includes(permission);
}

// Check session validity
export async function checkSession(): Promise<{ valid: boolean; user?: User }> {
  try {
    const accessToken = await getAccessToken();
    if (!accessToken) return { valid: false };

    const res = await fetch(`${API_BASE}/auth/check-session`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      credentials: "include",
    });

    if (res.ok) {
      const data = await res.json();
      const user = await getCurrentUser();
      return { valid: data.status && data.valid !== false, user: user || undefined };
    }

    return { valid: false };
  } catch (error) {
    console.error("Session check error:", error);
    return { valid: false };
  }
}
