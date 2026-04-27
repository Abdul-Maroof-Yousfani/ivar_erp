"use server";
import { authFetch } from "@/lib/auth";

export interface Qualification {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// Get all qualifications
export async function getQualifications(): Promise<{ status: boolean; data?: Qualification[]; message?: string }> {
  try {
    const res = await authFetch(`/qualifications`, {});
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to fetch qualifications" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error fetching qualifications:", error);
    return {
      status: false,
      message: error instanceof Error ? error.message : "Failed to fetch qualifications. Please check your connection.",
    };
  }
}

// Get qualification by id
export async function getQualificationById(id: string): Promise<{ status: boolean; data?: Qualification; message?: string }> {
  try {
    const res = await authFetch(`/qualifications/${id}`, {});
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to fetch qualification" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error fetching qualification:", error);
    return {
      status: false,
      message: error instanceof Error ? error.message : "Failed to fetch qualification",
    };
  }
}

// Create qualification
export async function createQualification(data: { name: string; status?: string }): Promise<{ status: boolean; data?: Qualification; message?: string }> {
  try {
    const res = await authFetch(`/qualifications`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to create qualification" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error creating qualification:", error);
    return { status: false, message: error instanceof Error ? error.message : "Failed to create qualification" };
  }
}

// Create qualifications bulk
export async function createQualificationsBulk(items: { name: string; status?: string }[]): Promise<{ status: boolean; message?: string }> {
  try {
    const res = await authFetch(`/qualifications/bulk`, {
      method: "POST",
      body: JSON.stringify({ items }),
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to create qualifications" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error creating qualifications:", error);
    return { status: false, message: error instanceof Error ? error.message : "Failed to create qualifications" };
  }
}

// Update qualification
export async function updateQualification(id: string, data: { name?: string; status?: string }): Promise<{ status: boolean; data?: Qualification; message?: string }> {
  try {
    const res = await authFetch(`/qualifications/${id}`, {
      method: "PUT",
      body: JSON.stringify({ ...data, id }),
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to update qualification" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error updating qualification:", error);
    return { status: false, message: error instanceof Error ? error.message : "Failed to update qualification" };
  }
}

// Delete qualification
export async function deleteQualification(id: string): Promise<{ status: boolean; message?: string }> {
  try {
    const res = await authFetch(`/qualifications/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to delete qualification" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error deleting qualification:", error);
    return { status: false, message: error instanceof Error ? error.message : "Failed to delete qualification" };
  }
}

// Update qualifications bulk
export async function updateQualifications(items: {
  id: string;
  name: string;
  status?: string;
}[]): Promise<{ status: boolean; message?: string }> {
  try {
    const results = await Promise.all(
      items.map(item => updateQualification(item.id, item))
    );
    const failed = results.filter(r => !r.status);
    if (failed.length > 0) {
      return { status: false, message: `${failed.length} qualification(s) failed to update` };
    }
    return { status: true, message: `${results.length} qualification(s) updated successfully` };
  } catch (error) {
    console.error("Error updating qualifications:", error);
    return { status: false, message: error instanceof Error ? error.message : "Failed to update qualifications" };
  }
}

// Delete qualifications bulk
export async function deleteQualifications(ids: string[]): Promise<{ status: boolean; message?: string }> {
  if (!ids.length) {
    return { status: false, message: "No items to delete" };
  }
  try {
    const res = await authFetch(`/qualifications/bulk`, {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to delete qualifications" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error deleting qualifications:", error);
    return { status: false, message: error instanceof Error ? error.message : "Failed to delete qualifications" };
  }
}