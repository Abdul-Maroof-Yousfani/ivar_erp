"use server";

import { revalidatePath } from "next/cache";
import { authFetch } from "@/lib/auth";

export interface StorageDimension {
    id: string;
    name: string;
    status: string;
    createdById?: string;
    createdAt: string;
    updatedAt: string;
}

export async function getStorageDimensions(): Promise<{ status: boolean; data: StorageDimension[]; message?: string }> {
    try {
        const res = await authFetch("/storage-dimensions", {
            cache: "no-store"
        });

        // Check if the response is ok
        if (!res.ok) {
            return { status: false, data: [], message: "Failed to fetch storage dimensions" };
        }

        const data = res.data;

        // Handle array response directly if that's what the backend returns
        if (Array.isArray(data)) {
            return { status: true, data };
        }

        return data;
    } catch (error) {
        console.error("Failed to fetch storage dimensions:", error);
        return { status: false, data: [], message: "Failed to fetch storage dimensions" };
    }
}

export async function createStorageDimension(data: { name: string }): Promise<{ status: boolean; message: string; data?: StorageDimension }> {
    if (!data.name?.trim()) {
        return { status: false, message: "Name is required" };
    }

    try {
        const res = await authFetch("/storage-dimensions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
        const result = res.data;

        if (res.ok) {
            revalidatePath("/master/storage-dimension/list");
            return { status: true, message: "Storage dimension created successfully", data: result };
        }

        return { status: false, message: result.message || "Failed to create storage dimension" };
    } catch (error) {
        return { status: false, message: "Failed to create storage dimension" };
    }
}

export async function updateStorageDimension(id: string, formData: FormData): Promise<{ status: boolean; message: string }> {
    const name = formData.get("name") as string;

    if (!name?.trim()) {
        return { status: false, message: "Name is required" };
    }

    try {
        const res = await authFetch(`/storage-dimensions/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
        });
        const result = res.data;

        if (res.ok) {
            revalidatePath("/master/storage-dimension/list");
            return { status: true, message: "Storage dimension updated successfully" };
        }

        return { status: false, message: result.message || "Failed to update storage dimension" };
    } catch (error) {
        return { status: false, message: "Failed to update storage dimension" };
    }
}

export async function deleteStorageDimension(id: string): Promise<{ status: boolean; message: string }> {
    try {
        const res = await authFetch(`/storage-dimensions/${id}`, {
            method: "DELETE",
        });
        const result = res.data;

        if (res.ok) {
            revalidatePath("/master/storage-dimension/list");
            return { status: true, message: "Storage dimension deleted successfully" };
        }

        return { status: false, message: result.message || "Failed to delete storage dimension" };
    } catch (error) {
        return { status: false, message: "Failed to delete storage dimension" };
    }
}
