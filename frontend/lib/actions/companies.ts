"use server";
import { revalidatePath } from "next/cache";
import { authFetch } from '@/lib/auth';
import { cookies, headers } from "next/headers";
import { getCookieDomain } from "@/lib/utils";
export interface Company {
  id: string;
  name: string;
  code: string;
  status: string;
  dbName: string;
  tenantId: string | null;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  // Optional fields depending on management schema
  logo?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
}
interface ApiResponse<T> {
  status: boolean;
  message?: string;
  data?: T;
}
/**
 * Get all companies
 */
export async function getCompanies(): Promise<{ data: Company[] }> {
  try {
    const res = await authFetch("/admin/companies");
    return { data: res.data.data || [] };
  } catch (error) {
    console.error("Failed to fetch companies:", error);
    return { data: [] };
  }
}
/**
 * Check if any companies exist
 */
export async function checkCompaniesExist(): Promise<{ hasCompanies: boolean }> {
  try {
    const res = await authFetch("/admin/companies/check");
    const { data } = res;

    return { hasCompanies: data.data?.hasCompanies ?? data.hasCompanies ?? false };
  } catch (error) {
    console.error("Failed to check companies:", error);
    return { hasCompanies: false };
  }
}
/**
 * Get the first active company
 */
export async function getFirstCompany(): Promise<{ data: Company | null }> {
  try {
    const res = await authFetch("/admin/companies/first");
    const { data } = res;

    return { data: data.data || null };
  } catch (error) {
    console.error("Failed to fetch first company:", error);
    return { data: null };
  }
}
/**
 * Get company by ID
 */
export async function getCompanyById(id: string): Promise<{ data: Company | null; message?: string }> {
  try {
    const res = await authFetch(`/admin/companies/${id}`);
    const { data } = res;
    return { data: data.data || null };
  } catch (error) {
    console.error("Failed to fetch company:", error);
    return { data: null, message: "Failed to fetch company" };
  }
}
/**
 * Get company by code
 */
export async function getCompanyByCode(code: string): Promise<{ data: Company | null; message?: string }> {
  try {
    const res = await authFetch(`/admin/companies/by-code/${code}`);
    const { data } = res;
    return { data: data.data || null };
  } catch (error) {
    console.error("Failed to fetch company:", error);
    return { data: null, message: "Failed to fetch company" };
  }
}
/**
 * Create a new company (provisions its database)
 */
export async function createCompany(payload: {
  name: string;
  code: string;
}): Promise<{ status: boolean; message?: string; data?: Company }> {
  try {
    const res = await authFetch("/admin/companies", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const { data: body } = res;
    revalidatePath("/admin/companies");
    return { status: res.ok && body.status, message: body.message || "Company created successfully", data: body.data };
  } catch (error) {
    console.error("Failed to create company:", error);
    return { status: false, message: "Failed to create company" };
  }
}
/**
 * Update company details
 */
export async function updateCompany(
  id: string,
  payload: { name?: string; status?: string }
): Promise<{ status: boolean; message?: string; data?: Company }> {
  try {
    const res = await authFetch(`/admin/companies/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    const { data: body } = res;
    revalidatePath("/admin/companies");
    return { status: res.ok && body.status, message: body.message || "Company updated successfully", data: body.data };
  } catch (error) {
    console.error("Failed to update company:", error);
    return { status: false, message: "Failed to update company" };
  }
}
/**
 * Get the currently selected company from cookies
 */
export async function getCurrentCompany(): Promise<Company | null> {
  try {
    const cookieStore = await cookies();
    const companyCookie = cookieStore.get("currentCompany")?.value;
    if (companyCookie) {
      return JSON.parse(companyCookie);
    }
    return null;
  } catch (error) {
    console.error("Failed to get current company:", error);
    return null;
  }
}
/**
 * Set the current company in cookies
 */
export async function setCurrentCompany(company: Company): Promise<void> {
  const cookieStore = await cookies();
  const headersList = await headers();
  const host = headersList.get("host") || "";
  const domain = getCookieDomain(host);
  const cookieOptions = {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    domain: domain,
  };
  // Set company in cookie
  cookieStore.set("currentCompany", JSON.stringify(company), cookieOptions);
  // Set company code for middleware
  cookieStore.set("companyCode", company.code, cookieOptions);
  // Set company ID for middleware
  cookieStore.set("companyId", company.id, cookieOptions);
}
/**
 * Clear the current company from cookies
 */
export async function clearCurrentCompany(): Promise<void> {
  const cookieStore = await cookies();
  const headersList = await headers();
  const host = headersList.get("host") || "";
  const domain = getCookieDomain(host);
  const cookieOptions = {
    path: "/",
    domain: domain,
  };
  cookieStore.delete({ name: "currentCompany", ...cookieOptions });
  cookieStore.delete({ name: "companyCode", ...cookieOptions });
  cookieStore.delete({ name: "companyId", ...cookieOptions });
}
