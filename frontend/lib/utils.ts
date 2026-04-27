import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getApiBaseUrl(): string {
  const isServer = typeof window === "undefined";

  // Server-side: prefer internal API_URL (direct Docker/localhost connection, no nginx hop)
  if (isServer) {
    return process.env.API_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";
  }

  // Client-side: use NEXT_PUBLIC_API_BASE_URL if set (set this to https://auth.spl.inplsoftwares.com in prod)
  if (process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL;
  }

  // Client-side dev: localtest.me subdomain support
  const hostname = window.location.hostname;
  if (hostname.includes("localtest.me")) {
    return "http://api.localtest.me:5000";
  }

  return "http://localhost:5000";
}

// Helper to get cookie domain
export const getCookieDomain = (host: string) => {
  // 1. Check if domain is explicitly configured
  if (process.env.NEXT_PUBLIC_COOKIE_DOMAIN) {
    return process.env.NEXT_PUBLIC_COOKIE_DOMAIN;
  }

  if (!host) return undefined;

  // Remove port if present
  const hostname = host.split(":")[0];

  // For localtest.me subdomains (e.g. hr.localtest.me -> .localtest.me)
  if (hostname.includes("localtest.me")) {
    return ".localtest.me";
  }

  // For localhost / 127.0.0.1 - do not set domain (host-only)
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return undefined;
  }

  // For production domains (e.g., app.example.com -> .example.com)
  const parts = hostname.split(".");
  if (parts.length >= 2) {
    // If it's a simple host like 'mysite.com', we want '.mysite.com'
    // If it's 'app.mysite.com', we also want '.mysite.com'
  return "." + parts.slice(-2).join(".");
  }

  return undefined;
};

export function getCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
}
// Format currency
export function formatCurrency(amount: number | string, currency = 'PKR'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return 'PKR 0.00';

  const formatted = new Intl.NumberFormat('en-PK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);

  return `${currency} ${formatted}`;
}

// Format date
export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'Invalid Date';
  
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(d);
}
