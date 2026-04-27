"use server";
import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface CompanyGroup {
  id: string;
  name: string;
  status: string;
  createdBy?: {
    firstName: string;
    lastName: string;
  };
  createdAt: string;
  updatedAt: string;
}

// CompanyGroup Actions
export async function getCompanyGroups(): Promise<{ status: boolean; data: CompanyGroup[]; message?: string }> {
  try {
    const res = await authFetch(`/company-groups`, {});
    return res.data;
  } catch (error) {
    console.error("Failed to fetch company groups:", error);
    return { status: false, data: [], message: "Failed to fetch company groups" };
  }
}

export async function getCompanyGroupById(id: string): Promise<{ status: boolean; data: CompanyGroup | null }> {
  try {
    const res = await authFetch(`/company-groups/${id}`, {});
    return res.data;
  } catch (error) {
    console.error("Failed to fetch company group:", error);
    return { status: false, data: null };
  }
}

export async function createCompanyGroup(data: FormData | { name: string }): Promise<{ status: boolean; message: string; data?: CompanyGroup }> {
  let name: string;
  if (data instanceof FormData) {
    name = data.get("name") as string;
  } else {
    name = data.name;
  }
  if (!name?.trim()) {
    return { status: false, message: "Name is required" };
  }
  try {
    const res = await authFetch(`/company-groups`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    const result = res.data;
    if (result.status) {
      revalidatePath("/master/company-group/list");
    }
    return result;
  } catch (error) {
    return { status: false, message: "Failed to create company group" };
  }
}

export async function createCompanyGroups(names: string[]): Promise<{ status: boolean; message: string; data?: CompanyGroup[] }> {
  if (!names.length) {
    return { status: false, message: "At least one name is required" };
  }
  try {
    const results = await Promise.all(names.map(name => 
      authFetch(`/company-groups`, {
        method: "POST",
        body: JSON.stringify({ name }),
      }).then(r => r.data)
    ));
    
    const allSuccess = results.every(r => r.id || r.status !== false); 
    
    if (allSuccess) {
        revalidatePath("/master/company-group/list");
        return { status: true, message: "Company groups created successfully" };
    }
    return { status: false, message: "Some company groups failed to create" };

  } catch (error) {
    return { status: false, message: "Failed to create company groups" };
  }
}

export async function updateCompanyGroup(id: string, data: FormData | { name: string }): Promise<{ status: boolean; message: string }> {
  let name: string;
  if (data instanceof FormData) {
    name = data.get("name") as string;
  } else {
    name = data.name;
  }
  try {
    const res = await authFetch(`/company-groups/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    });
    const result = res.data;
    if (result.id || result.status) {
      revalidatePath("/master/company-group/list");
      return { status: true, message: "Company group updated successfully" };
    }
    return { status: false, message: result.message || "Failed to update company group" };
  } catch (error) {
    return { status: false, message: "Failed to update company group" };
  }
}

export async function deleteCompanyGroup(id: string): Promise<{ status: boolean; message: string }> {
  try {
    const res = await authFetch(`/company-groups/${id}`, {
      method: "DELETE",
    });
    const data = res.data;
    if (data.id || data.status) {
      revalidatePath("/master/company-group/list");
      return { status: true, message: "Company group deleted successfully" };
    }
    return { status: false, message: data.message || "Failed to delete company group" };
  } catch (error) {
    return { status: false, message: "Failed to delete company group" };
  }
}
