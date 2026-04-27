"use server";

import { revalidatePath } from "next/cache";
import { authFetch } from "@/lib/auth";

export interface Color {
    id: string;
    name: string;
    status: string;
    createdById?: string;
    createdBy?: string;
    createdAt: string;
    updatedAt: string;
}

export async function getColors() {
    try {
        const response = await authFetch("/colors");
        return response.data;
    } catch (error: any) {
        return { status: false, message: error.message, data: null };
    }
}

export async function createColors(items: { name: string; status?: string }[]) {
    try {
        const response = await authFetch("/colors", {
            method: "POST",
            body: JSON.stringify({ items }),
        });
        revalidatePath("/master/color/list");
        return response.data;
    } catch (error: any) {
        return { status: false, message: error.message, data: null };
    }
}

export async function updateColor(id: string, formData: FormData) {
    try {
        const name = formData.get("name") as string;
        const status = formData.get("status") as string;

        const response = await authFetch(`/colors/${id}`, {
            method: "PUT",
            body: JSON.stringify({ name, status }),
        });
        revalidatePath("/master/color/list");
        return response.data;
    } catch (error: any) {
        return { status: false, message: error.message, data: null };
    }
}

export async function updateColors(items: { id: string; name: string; status?: string }[]) {
    try {
        const response = await authFetch("/colors/bulk/update", {
            method: "PUT",
            body: JSON.stringify({ items }),
        });
        revalidatePath("/master/color/list");
        return response.data;
    } catch (error: any) {
        return { status: false, message: error.message, data: null };
    }
}

export async function deleteColor(id: string) {
    try {
        const response = await authFetch(`/colors/${id}`, {
            method: "DELETE",
        });
        revalidatePath("/master/color/list");
        return response.data;
    } catch (error: any) {
        return { status: false, message: error.message, data: null };
    }
}

export async function deleteColors(ids: string[]) {
    try {
        const response = await authFetch("/colors/bulk/delete", {
            method: "DELETE",
            body: JSON.stringify({ ids }),
        });
        revalidatePath("/master/color/list");
        return response.data;
    } catch (error: any) {
        return { status: false, message: error.message, data: null };
    }
}
