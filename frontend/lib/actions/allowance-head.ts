"use server";
import { authFetch } from "@/lib/auth";

export interface AllowanceHead {
  id: string;
  name: string;
  calculationType: string; // "Amount" | "Percentage"
  amount?: number | null;
  percentage?: number | null;
  status: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

// Get all allowance heads
export async function getAllowanceHeads(): Promise<{ status: boolean; data?: AllowanceHead[]; message?: string }> {
  try {
    const res = await authFetch(`/allowance-heads`, {});
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to fetch allowance heads" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error fetching allowance heads:", error);
    return {
      status: false,
      message: error instanceof Error ? error.message : "Failed to fetch allowance heads. Please check your connection.",
    };
  }
}

// Get allowance head by id
export async function getAllowanceHeadById(id: string): Promise<{ status: boolean; data?: AllowanceHead; message?: string }> {
  try {
    const res = await authFetch(`/allowance-heads/${id}`, {});
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to fetch allowance head" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error fetching allowance head:", error);
    return {
      status: false,
      message: error instanceof Error ? error.message : "Failed to fetch allowance head",
    };
  }
}

// Create allowance head
export async function createAllowanceHead(data: {
  name: string;
  calculationType?: string;
  amount?: number;
  percentage?: number;
  status?: string;
}): Promise<{ status: boolean; data?: AllowanceHead; message?: string }> {
  try {
    const res = await authFetch(`/allowance-heads`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to create allowance head" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error creating allowance head:", error);
    return { status: false, message: error instanceof Error ? error.message : "Failed to create allowance head" };
  }
}

// Create allowance heads bulk
export async function createAllowanceHeadsBulk(items: {
  name: string;
  calculationType?: string;
  amount?: number;
  percentage?: number;
  status?: string;
}[]): Promise<{ status: boolean; message?: string }> {
  try {
    const res = await authFetch(`/allowance-heads/bulk`, {
      method: "POST",
      body: JSON.stringify({ items }),
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to create allowance heads" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error creating allowance heads:", error);
    return { status: false, message: error instanceof Error ? error.message : "Failed to create allowance heads" };
  }
}

// Update allowance head
export async function updateAllowanceHead(
  id: string,
  data: {
    name: string;
    calculationType?: string;
    amount?: number;
    percentage?: number;
    status?: string;
  }
): Promise<{ status: boolean; data?: AllowanceHead; message?: string }> {
  try {
    const res = await authFetch(`/allowance-heads/${id}`, {
      method: "PUT",
      body: JSON.stringify({ ...data, id }),
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to update allowance head" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error updating allowance head:", error);
    return { status: false, message: error instanceof Error ? error.message : "Failed to update allowance head" };
  }
}

// Delete allowance head
export async function deleteAllowanceHead(id: string): Promise<{ status: boolean; message?: string }> {
  try {
    const res = await authFetch(`/allowance-heads/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to delete allowance head" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error deleting allowance head:", error);
    return { status: false, message: error instanceof Error ? error.message : "Failed to delete allowance head" };
  }
}

// Update allowance heads bulk
export async function updateAllowanceHeads(
  items: {
    id: string;
    name: string;
    calculationType?: string;
    amount?: number;
    percentage?: number;
    status?: string;
  }[]
): Promise<{ status: boolean; message?: string }> {
  try {
    const results = await Promise.all(items.map((item) => updateAllowanceHead(item.id, item)));
    const failed = results.filter((r) => !r.status);
    if (failed.length > 0) {
      return { status: false, message: `${failed.length} allowance head(s) failed to update` };
    }
    return { status: true, message: `${results.length} allowance head(s) updated successfully` };
  } catch (error) {
    console.error("Error updating allowance heads:", error);
    return { status: false, message: error instanceof Error ? error.message : "Failed to update allowance heads" };
  }
}

// Delete allowance heads bulk
export async function deleteAllowanceHeads(ids: string[]): Promise<{ status: boolean; message?: string }> {
  try {
    const res = await authFetch(`/allowance-heads/bulk`, {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to delete allowance heads" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error deleting allowance heads:", error);
    return { status: false, message: error instanceof Error ? error.message : "Failed to delete allowance heads" };
  }
}