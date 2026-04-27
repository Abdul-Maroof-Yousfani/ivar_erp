"use server";
import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";
export interface SocialSecurityInstitution {
  id: string;
  code: string;
  name: string;
  province?: string | null;
  description?: string | null;
  status: string;
  website?: string | null;
  contactNumber?: string | null;
  address?: string | null;
  contributionRate: number;
  createdAt: string;
  updatedAt: string;
}
export async function getSocialSecurityInstitutions(): Promise<{ status: boolean; data: SocialSecurityInstitution[] }> {
  try {
    const res = await authFetch(`/social-security-institutions`, {
    });
    return res.data;
  } catch (error) {
    console.error("Failed to fetch social security institutions:", error);
    return { status: false, data: [] };
  }
}
export async function createSocialSecurityInstitution(formData: FormData): Promise<{ status: boolean; message: string; data?: SocialSecurityInstitution }> {
  const code = formData.get("code") as string;
  const name = formData.get("name") as string;
  const province = formData.get("province") as string;
  const description = formData.get("description") as string;
  const website = formData.get("website") as string;
  const contactNumber = formData.get("contactNumber") as string;
  const address = formData.get("address") as string;
  const contributionRate = formData.get("contributionRate") ? parseFloat(formData.get("contributionRate") as string) : 0;
  if (!code?.trim() || !name?.trim()) {
    return { status: false, message: "Code and name are required" };
  }
  try {
    const res = await authFetch(`/social-security-institutions`, {
      method: "POST",
      body: JSON.stringify({
        code: code.trim(),
        name: name.trim(),
        province: province?.trim() || undefined,
        description: description?.trim() || undefined,
        website: website?.trim() || undefined,
        contactNumber: contactNumber?.trim() || undefined,
        address: address?.trim() || undefined,
        contributionRate,
        status: "active",
      }),
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/social-security");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to create social security institution" };
  }
}
export async function createSocialSecurityInstitutions(
  items: { code: string; name: string; province?: string; description?: string; website?: string; contactNumber?: string; address?: string; contributionRate?: number }[]
): Promise<{ status: boolean; message: string }> {
  if (!items.length) return { status: false, message: "At least one institution is required" };
  try {
    const promises = items.map((item) =>
      authFetch(`/social-security-institutions`, {
        method: "POST",
        body: JSON.stringify({
          ...item,
          status: "active",
        }),
      })
    );
    const results = await Promise.all(promises);
    const data = results[0].data;
    if (data.status) revalidatePath("/master/social-security");
    return { status: true, message: `Created ${items.length} institution(s) successfully` };
  } catch (error) {
    return { status: false, message: "Failed to create social security institutions" };
  }
}
export async function updateSocialSecurityInstitution(id: string, formData: FormData): Promise<{ status: boolean; message: string; data?: SocialSecurityInstitution }> {
  const code = formData.get("code") as string;
  const name = formData.get("name") as string;
  const province = formData.get("province") as string;
  const description = formData.get("description") as string;
  const website = formData.get("website") as string;
  const contactNumber = formData.get("contactNumber") as string;
  const address = formData.get("address") as string;
  const contributionRate = formData.get("contributionRate") ? parseFloat(formData.get("contributionRate") as string) : 0;
  const status = formData.get("status") as string;
  if (!code?.trim() || !name?.trim()) return { status: false, message: "Code and name are required" };
  try {
    const res = await authFetch(`/social-security-institutions/${id}`, {
      method: "PUT",
      body: JSON.stringify({
        id,
        code: code.trim(),
        name: name.trim(),
        province: province?.trim() || undefined,
        description: description?.trim() || undefined,
        website: website?.trim() || undefined,
        contactNumber: contactNumber?.trim() || undefined,
        address: address?.trim() || undefined,
        contributionRate,
        status: status || "active",
      }),
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/social-security");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to update social security institution" };
  }
}
export async function deleteSocialSecurityInstitution(id: string): Promise<{ status: boolean; message: string }> {
  try {
    const res = await authFetch(`/social-security-institutions/${id}`, {
      method: "DELETE",
    });
    const data = res.data;
    if (data.status) revalidatePath("/master/social-security");
    return data;
  } catch (error) {
    return { status: false, message: "Failed to delete social security institution" };
  }
}
export async function deleteSocialSecurityInstitutions(ids: string[]): Promise<{ status: boolean; message: string }> {
  if (!ids.length) return { status: false, message: "No items to delete" };
  try {
    const promises = ids.map((id) =>
      authFetch(`/social-security-institutions/${id}`, {
        method: "DELETE",
      })
    );
    await Promise.all(promises);
    revalidatePath("/master/social-security");
    return { status: true, message: `Deleted ${ids.length} institution(s) successfully` };
  } catch (error) {
    return { status: false, message: "Failed to delete social security institutions" };
  }
}
export async function updateSocialSecurityInstitutions(
  items: { id: string; code: string; name: string; province?: string; description?: string; website?: string; contactNumber?: string; address?: string; status?: string; contributionRate?: number }[]
): Promise<{ status: boolean; message: string }> {
  if (!items.length) return { status: false, message: "No items to update" };
  try {
    const promises = items.map((item) =>
      authFetch(`/social-security-institutions/${item.id}`, {
        method: "PUT",
        body: JSON.stringify(item),
      })
    );
    await Promise.all(promises);
    revalidatePath("/master/social-security");
    return { status: true, message: `Updated ${items.length} institution(s) successfully` };
  } catch (error) {
    return { status: false, message: "Failed to update social security institutions" };
  }
}
