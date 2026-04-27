"use server";
import { authFetch } from "@/lib/auth";

export interface ProvidentFund {
  id: string;
  name: string;
  percentage: number;
  status: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

// Get all provident funds
export async function getProvidentFunds(): Promise<{ status: boolean; data?: ProvidentFund[]; message?: string }> {
  try {
    const res = await authFetch(`/provident-funds`, {});
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to fetch provident funds" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error fetching provident funds:", error);
    return {
      status: false,
      message: error instanceof Error ? error.message : "Failed to fetch provident funds. Please check your connection.",
    };
  }
}

// Get provident fund by id
export async function getProvidentFundById(id: string): Promise<{ status: boolean; data?: ProvidentFund; message?: string }> {
  try {
    const res = await authFetch(`/provident-funds/${id}`, {});
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to fetch provident fund" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error fetching provident fund:", error);
    return {
      status: false,
      message: error instanceof Error ? error.message : "Failed to fetch provident fund",
    };
  }
}

// Create provident fund
export async function createProvidentFund(data: { name: string; percentage: number; status?: string }): Promise<{ status: boolean; data?: ProvidentFund; message?: string }> {
  try {
    const res = await authFetch(`/provident-funds`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to create provident fund" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error creating provident fund:", error);
    return { status: false, message: error instanceof Error ? error.message : "Failed to create provident fund" };
  }
}

// Create provident funds bulk
export async function createProvidentFundsBulk(items: { name: string; percentage: number; status?: string }[]): Promise<{ status: boolean; message?: string }> {
  try {
    const res = await authFetch(`/provident-funds/bulk`, {
      method: "POST",
      body: JSON.stringify({ items }),
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to create provident funds" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error creating provident funds:", error);
    return { status: false, message: error instanceof Error ? error.message : "Failed to create provident funds" };
  }
}

// Update provident fund
export async function updateProvidentFund(id: string, data: { name: string; percentage: number; status?: string }): Promise<{ status: boolean; data?: ProvidentFund; message?: string }> {
  try {
    const res = await authFetch(`/provident-funds/${id}`, {
      method: "PUT",
      body: JSON.stringify({ ...data, id }),
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to update provident fund" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error updating provident fund:", error);
    return { status: false, message: error instanceof Error ? error.message : "Failed to update provident fund" };
  }
}

// Delete provident fund
export async function deleteProvidentFund(id: string): Promise<{ status: boolean; message?: string }> {
  try {
    const res = await authFetch(`/provident-funds/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to delete provident fund" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error deleting provident fund:", error);
    return { status: false, message: error instanceof Error ? error.message : "Failed to delete provident fund" };
  }
}

// Update provident funds bulk
export async function updateProvidentFunds(items: {
  id: string;
  name: string;
  percentage: number;
  status?: string;
}[]): Promise<{ status: boolean; message?: string }> {
  try {
    const results = await Promise.all(
      items.map(item => updateProvidentFund(item.id, item))
    );
    const failed = results.filter(r => !r.status);
    if (failed.length > 0) {
      return { status: false, message: `${failed.length} provident fund(s) failed to update` };
    }
    return { status: true, message: `${results.length} provident fund(s) updated successfully` };
  } catch (error) {
    console.error("Error updating provident funds:", error);
    return { status: false, message: error instanceof Error ? error.message : "Failed to update provident funds" };
  }
}

// Delete provident funds bulk
export async function deleteProvidentFunds(ids: string[]): Promise<{ status: boolean; message?: string }> {
  try {
    const results = await Promise.all(
      ids.map(id => deleteProvidentFund(id))
    );
    const failed = results.filter(r => !r.status);
    if (failed.length > 0) {
      return { status: false, message: `${failed.length} provident fund(s) failed to delete` };
    }
    return { status: true, message: `${results.length} provident fund(s) deleted successfully` };
  } catch (error) {
    console.error("Error deleting provident funds:", error);
    return { status: false, message: error instanceof Error ? error.message : "Failed to delete provident funds" };
  }
}