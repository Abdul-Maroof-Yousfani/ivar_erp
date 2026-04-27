"use server";

import { revalidatePath } from "next/cache";
import { authFetch } from "@/lib/auth";

export interface Brand {
    id: string;
    name: string;
    status: string;
    createdById?: string;
    createdBy?: string;
    createdAt: string;
    updatedAt: string;
    divisionsCount?: number;
    divisions?: any[];
}

export async function getBrands(): Promise<{ status: boolean; data: Brand[]; message?: string }> {
    try {
        const res = await authFetch("/brands", {
            cache: "no-store",
        });
        return res.data;
    } catch (error) {
        console.error("Failed to fetch brands:", error);
        return { status: false, data: [], message: "Failed to fetch brands" };
    }
}

export async function getBrandById(id: string): Promise<{ status: boolean; data: Brand | null }> {
    try {
        const res = await authFetch(`/brands/${id}`, {
            cache: "no-store",
        });
        return res.data;
    } catch (error) {
        console.error("Failed to fetch brand:", error);
        return { status: false, data: null };
    }
}

export async function createBrands(items: { name: string; status?: string }[]): Promise<{ status: boolean; message: string; data?: Brand[] }> {
    if (!items.length) {
        return { status: false, message: "At least one brand is required" };
    }

    try {
        const res = await authFetch("/brands", {
            method: "POST",
            body: JSON.stringify({ items }),
        });
        const data = res.data;

        if (data.status) {
            revalidatePath("/master/brand");
        }

        return data;
    } catch (error) {
        return { status: false, message: "Failed to create brands" };
    }
}

export async function updateBrand(id: string, formData: FormData): Promise<{ status: boolean; message: string; data?: Brand }> {
    const name = formData.get("name") as string;
    const status = formData.get("status") as string;

    if (!name?.trim()) {
        return { status: false, message: "Name is required" };
    }

    try {
        const res = await authFetch(`/brands/${id}`, {
            method: "PUT",
            body: JSON.stringify({ name, status }),
        });
        const data = res.data;

        if (data.status) {
            revalidatePath("/master/brand");
        }

        return data;
    } catch (error) {
        return { status: false, message: "Failed to update brand" };
    }
}

export async function updateBrands(items: { id: string; name: string; status?: string }[]): Promise<{ status: boolean; message: string }> {
    if (!items.length) {
        return { status: false, message: "No items to update" };
    }

    try {
        const res = await authFetch("/brands/bulk", {
            method: "PUT",
            body: JSON.stringify({ items }),
        });
        const data = res.data;

        if (data.status) {
            revalidatePath("/master/brand");
        }

        return data;
    } catch (error) {
        return { status: false, message: "Failed to update brands" };
    }
}

export async function deleteBrand(id: string): Promise<{ status: boolean; message: string }> {
    try {
        const res = await authFetch(`/brands/${id}`, {
            method: "DELETE",
        });
        const data = res.data;

        if (data.status) {
            revalidatePath("/master/brand");
        }

        return data;
    } catch (error) {
        return { status: false, message: "Failed to delete brand" };
    }
}

export async function deleteBrands(ids: string[]): Promise<{ status: boolean; message: string }> {
    if (!ids.length) {
        return { status: false, message: "No items to delete" };
    }

    try {
        const res = await authFetch("/brands/bulk", {
            method: "DELETE",
            body: JSON.stringify({ ids }),
        });
        const data = res.data;

        if (data.status) {
            revalidatePath("/master/brand");
        }

        return data;
    } catch (error) {
        return { status: false, message: "Failed to delete brands" };
    }
}
