"use server";

import { revalidatePath } from "next/cache";
import { authFetch } from "@/lib/auth";

export interface Size {
    id: string;
    name: string;
    status: string;
    createdById?: string;
    createdBy?: string;
    createdAt: string;
    updatedAt: string;
}

export async function getSizes() {
    try {
        const response = await authFetch("/sizes");
        return response.data;
    } catch (error: any) {
        return { status: false, message: error.message, data: null };
    }
}

export async function getSizeById(id: string) {
    try {
        const response = await authFetch(`/sizes/${id}`);
        return response.data;
    } catch (error: any) {
        return { status: false, message: error.message, data: null };
    }
}

export async function createSizes(items: { name: string; status?: string }[]) {
    try {
        const response = await authFetch("/sizes", {
            method: "POST",
            body: JSON.stringify({ items }),
        });
        revalidatePath("/master/size/list");
        return response.data;
    } catch (error: any) {
        return { status: false, message: error.message, data: null };
    }
}

export async function updateSize(id: string, formData: FormData) {
    try {
        const name = formData.get("name") as string;
        const status = formData.get("status") as string;

        const response = await authFetch(`/sizes/${id}`, {
            method: "PUT",
            body: JSON.stringify({ name, status }),
        });
        revalidatePath("/master/size/list");
        return response.data;
    } catch (error: any) {
        return { status: false, message: error.message, data: null };
    }
}

export async function updateSizes(items: { id: string; name: string; status?: string }[]) {
    try {
        const response = await authFetch("/sizes/bulk/update", {
            method: "PUT",
            body: JSON.stringify({ items }),
        });
        revalidatePath("/master/size/list");
        return response.data;
    } catch (error: any) {
        return { status: false, message: error.message, data: null };
    }
}

export async function deleteSize(id: string) {
    try {
        const response = await authFetch(`/sizes/${id}`, {
            method: "DELETE",
        });
        revalidatePath("/master/size/list");
        return response.data;
    } catch (error: any) {
        return { status: false, message: error.message, data: null };
    }
}

export async function deleteSizes(ids: string[]) {
    try {
        const response = await authFetch("/sizes/bulk/delete", {
            method: "DELETE",
            body: JSON.stringify({ ids }),
        });
        revalidatePath("/master/size/list");
        return response.data;
    } catch (error: any) {
        return { status: false, message: error.message, data: null };
    }
}
