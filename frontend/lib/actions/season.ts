"use server";

import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface Season {
    id: string;
    name: string;
    status: string;
    createdBy?: string;
    createdById?: string;
    createdAt: string;
    updatedAt: string;
}

export async function getSeasons(): Promise<{ status: boolean; data: Season[]; message?: string }> {
    try {
        const res = await authFetch("/master/erp/season", {
            cache: "no-store",
        });
        return res.data;
    } catch (error) {
        console.error("Failed to fetch seasons:", error);
        return { status: false, data: [], message: "Failed to fetch seasons" };
    }
}

export async function createSeasons(items: { name: string; status?: string }[]): Promise<{ status: boolean; message: string }> {
    try {
        const res = await authFetch("/master/erp/season", {
            method: "POST",
            body: JSON.stringify({ items }),
        });
        return res.data;
    } catch (error) {
        console.error("Failed to create seasons:", error);
        return { status: false, message: "Failed to create seasons" };
    }
}

export async function updateSeason(id: string, data: { name?: string; status?: string }): Promise<{ status: boolean; message: string }> {
    try {
        const res = await authFetch(`/master/erp/season/${id}`, {
            method: "PUT",
            body: JSON.stringify(data),
        });
        revalidatePath("/master/season/list");
        return res.data;
    } catch (error) {
        console.error("Failed to update season:", error);
        return { status: false, message: "Failed to update season" };
    }
}

export async function bulkUpdateSeasons(items: { id: string; name: string; status?: string }[]): Promise<{ status: boolean; message: string }> {
    try {
        const res = await authFetch("/master/erp/season/bulk", {
            method: "PUT",
            body: JSON.stringify({ items }),
        });
        revalidatePath("/master/season/list");
        return res.data;
    } catch (error) {
        console.error("Failed to bulk update seasons:", error);
        return { status: false, message: "Failed to bulk update seasons" };
    }
}

export async function deleteSeason(id: string): Promise<{ status: boolean; message: string }> {
    try {
        const res = await authFetch(`/master/erp/season/${id}`, {
            method: "DELETE",
        });
        revalidatePath("/master/season/list");
        return res.data;
    } catch (error) {
        console.error("Failed to delete season:", error);
        return { status: false, message: "Failed to delete season" };
    }
}

export async function bulkDeleteSeasons(ids: string[]): Promise<{ status: boolean; message: string }> {
    try {
        const res = await authFetch("/master/erp/season/bulk", {
            method: "DELETE",
            body: JSON.stringify({ ids }),
        });
        revalidatePath("/master/season/list");
        return res.data;
    } catch (error) {
        console.error("Failed to bulk delete seasons:", error);
        return { status: false, message: "Failed to bulk delete seasons" };
    }
}
