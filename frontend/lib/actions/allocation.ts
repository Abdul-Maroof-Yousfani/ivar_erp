"use server";
import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface Allocation {
    id: string;
    name: string;
    status: string;
    createdById?: string;
    createdBy?: {
        firstName: string;
        lastName: string;
    };
    createdAt: string;
    updatedAt: string;
}

export async function getAllocations(): Promise<{ status: boolean; data: Allocation[]; message?: string }> {
    try {
        const res = await authFetch(`/allocations`, {});
        if (!res.ok) {
            const errorData = res.data || { message: "Failed to fetch allocations" };
            return { status: false, data: [], message: errorData.message || `HTTP error! status: ${res.status}` };
        }
        return res.data;
    } catch (error) {
        console.error("Failed to fetch allocations:", error);
        return { status: false, data: [], message: "Failed to fetch allocations" };
    }
}

export async function getAllocationById(id: string): Promise<{ status: boolean; data: Allocation | null }> {
    try {
        const res = await authFetch(`/allocations/${id}`, {});
        if (!res.ok) {
            return { status: false, data: null };
        }
        return res.data;
    } catch (error) {
        console.error("Failed to fetch allocation:", error);
        return { status: false, data: null };
    }
}

export async function createAllocations(names: string[]): Promise<{ status: boolean; message: string; data?: any }> {
    if (!names.length) {
        return { status: false, message: "At least one name is required" };
    }
    try {
        const res = await authFetch(`/allocations/bulk`, {
            method: "POST",
            body: JSON.stringify({ names }),
        });
        const data = res.data;
        if (data.status) {
            revalidatePath("/master/allocation");
        }
        return data;
    } catch (error) {
        return { status: false, message: "Failed to create allocations" };
    }
}

export async function updateAllocation(id: string, formData: FormData): Promise<{ status: boolean; message: string; data?: Allocation }> {
    const name = formData.get("name") as string;
    if (!name?.trim()) {
        return { status: false, message: "Name is required" };
    }
    try {
        const res = await authFetch(`/allocations/${id}`, {
            method: "PUT",
            body: JSON.stringify({ name }),
        });
        const data = res.data;
        if (data.status) {
            revalidatePath("/master/allocation");
        }
        return data;
    } catch (error) {
        return { status: false, message: "Failed to update allocation" };
    }
}

export async function deleteAllocation(id: string): Promise<{ status: boolean; message: string }> {
    try {
        const res = await authFetch(`/allocations/${id}`, {
            method: "DELETE",
        });
        const data = res.data;
        if (data.status) {
            revalidatePath("/master/allocation");
        }
        return data;
    } catch (error) {
        return { status: false, message: "Failed to delete allocation" };
    }
}

export async function deleteAllocations(ids: string[]): Promise<{ status: boolean; message: string }> {
    if (!ids.length) {
        return { status: false, message: "No items to delete" };
    }
    try {
        const res = await authFetch(`/allocations/bulk`, {
            method: "DELETE",
            body: JSON.stringify({ ids }),
        });
        const data = res.data;
        if (data.status) {
            revalidatePath("/master/allocation");
        }
        return data;
    } catch (error) {
        return { status: false, message: "Failed to delete allocations" };
    }
}

export async function updateAllocations(items: { id: string; name: string }[]): Promise<{ status: boolean; message: string }> {
    if (!items.length) {
        return { status: false, message: "No items to update" };
    }
    try {
        const res = await authFetch(`/allocations/bulk`, {
            method: "PUT",
            body: JSON.stringify({ items }),
        });
        const data = res.data;
        if (data.status) {
            revalidatePath("/master/allocation");
        }
        return data;
    } catch (error) {
        return { status: false, message: "Failed to update allocations" };
    }
}