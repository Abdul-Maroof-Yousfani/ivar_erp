"use server";

import { revalidatePath } from "next/cache";
import { authFetch } from "@/lib/auth";
import { Brand } from "./brand";

export interface Division {
    id: string;
    name: string;
    brandId: string;
    brandName?: string;
    brand?: Brand;
    createdById?: string;
    createdBy?: string;
    createdAt: string;
    updatedAt: string;
}

export async function getDivisions(): Promise<{ status: boolean; data: Division[]; message?: string }> {
    try {
        const res = await authFetch("/divisions", {
            cache: "no-store",
        });
        return res.data;
    } catch (error) {
        console.error("Failed to fetch divisions:", error);
        return { status: false, data: [], message: "Failed to fetch divisions" };
    }
}

export async function getDivisionsByBrand(brandId: string): Promise<{ status: boolean; data: Division[] }> {
    try {
        const res = await authFetch(`/divisions/brand/${brandId}`, {
            cache: "no-store",
        });
        return res.data;
    } catch (error) {
        console.error("Failed to fetch divisions by brand:", error);
        return { status: false, data: [] };
    }
}

export async function createDivisions(items: { name: string; brandId: string }[]): Promise<{ status: boolean; message: string; data?: Division[] }> {
    if (!items.length) {
        return { status: false, message: "At least one division is required" };
    }

    try {
        const res = await authFetch("/divisions", {
            method: "POST",
            body: JSON.stringify({ items }),
        });
        const data = res.data;

        if (data.status) {
            revalidatePath("/master/division");
        }

        return data;
    } catch (error) {
        return { status: false, message: "Failed to create divisions" };
    }
}

export async function updateDivision(id: string, formData: FormData): Promise<{ status: boolean; message: string; data?: Division }> {
    const name = formData.get("name") as string;
    const brandId = formData.get("brandId") as string;

    if (!name?.trim()) {
        return { status: false, message: "Name is required" };
    }
    if (!brandId) {
        return { status: false, message: "Brand is required" };
    }

    try {
        const res = await authFetch(`/divisions/${id}`, {
            method: "PUT",
            body: JSON.stringify({ name, brandId }),
        });
        const data = res.data;

        if (data.status) {
            revalidatePath("/master/division");
        }

        return data;
    } catch (error) {
        return { status: false, message: "Failed to update division" };
    }
}

export async function updateDivisions(items: { id: string; name: string; brandId: string }[]): Promise<{ status: boolean; message: string }> {
    if (!items.length) {
        return { status: false, message: "No items to update" };
    }

    try {
        const res = await authFetch("/divisions/bulk", {
            method: "PUT",
            body: JSON.stringify({ items }),
        });
        const data = res.data;

        if (data.status) {
            revalidatePath("/master/division");
        }

        return data;
    } catch (error) {
        return { status: false, message: "Failed to update divisions" };
    }
}

export async function deleteDivision(id: string): Promise<{ status: boolean; message: string }> {
    try {
        const res = await authFetch(`/divisions/${id}`, {
            method: "DELETE",
        });
        const data = res.data;

        if (data.status) {
            revalidatePath("/master/division");
        }

        return data;
    } catch (error) {
        return { status: false, message: "Failed to delete division" };
    }
}

export async function deleteDivisions(ids: string[]): Promise<{ status: boolean; message: string }> {
    if (!ids.length) {
        return { status: false, message: "No items to delete" };
    }

    try {
        const res = await authFetch("/divisions/bulk", {
            method: "DELETE",
            body: JSON.stringify({ ids }),
        });
        const data = res.data;

        if (data.status) {
            revalidatePath("/master/division");
        }

        return data;
    } catch (error) {
        return { status: false, message: "Failed to delete divisions" };
    }
}
