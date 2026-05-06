"use server";

import { revalidatePath } from "next/cache";
import { authFetch } from "@/lib/auth";

export interface Silhouette {
    id: string;
    name: string;
    status: string;
    createdById?: string;
    createdBy?: string;
    createdAt: string;
    updatedAt: string;
}

export async function getSilhouettes() {
    try {
        const response = await authFetch("/silhouettes");
        return response.data;
    } catch (error: any) {
        return { status: false, message: error.message, data: null };
    }
}

export async function getSilhouetteById(id: string) {
    try {
        const response = await authFetch(`/silhouettes/${id}`);
        return response.data;
    } catch (error: any) {
        return { status: false, message: error.message, data: null };
    }
}

export async function createSilhouettes(items: { name: string; status?: string }[]) {
    try {
        const response = await authFetch("/silhouettes", {
            method: "POST",
            body: JSON.stringify({ items }),
        });
        revalidatePath("/master/silhouette/list");
        return response.data;
    } catch (error: any) {
        return { status: false, message: error.message, data: null };
    }
}

export async function updateSilhouette(id: string, formData: FormData) {
    try {
        const name = formData.get("name") as string;
        const status = formData.get("status") as string;

        const response = await authFetch(`/silhouettes/${id}`, {
            method: "PUT",
            body: JSON.stringify({ name, status }),
        });
        revalidatePath("/master/silhouette/list");
        return response.data;
    } catch (error: any) {
        return { status: false, message: error.message, data: null };
    }
}

export async function updateSilhouettes(items: { id: string; name: string; status?: string }[]) {
    try {
        const response = await authFetch("/silhouettes/bulk/update", {
            method: "PUT",
            body: JSON.stringify({ items }),
        });
        revalidatePath("/master/silhouette/list");
        return response.data;
    } catch (error: any) {
        return { status: false, message: error.message, data: null };
    }
}

export async function deleteSilhouette(id: string) {
    try {
        const response = await authFetch(`/silhouettes/${id}`, {
            method: "DELETE",
        });
        revalidatePath("/master/silhouette/list");
        return response.data;
    } catch (error: any) {
        return { status: false, message: error.message, data: null };
    }
}

export async function deleteSilhouettes(ids: string[]) {
    try {
        const response = await authFetch("/silhouettes/bulk/delete", {
            method: "DELETE",
            body: JSON.stringify({ ids }),
        });
        revalidatePath("/master/silhouette/list");
        return response.data;
    } catch (error: any) {
        return { status: false, message: error.message, data: null };
    }
}
