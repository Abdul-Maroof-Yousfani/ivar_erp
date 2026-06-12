"use server";

import { revalidatePath } from "next/cache";
import { authFetch } from "@/lib/auth";

const API_BASE = process.env.API_URL || "http://localhost:5000/api";

export interface Gender {
    id: string;
    name: string;
    status: string;
    createdById?: string;
    createdBy?: string;
    createdAt: string;
    updatedAt: string;
}

export async function getGenders() {
    try {
        const response = await authFetch("/genders");
        return response.data;
    } catch (error: any) {
        return { status: false, message: error.message, data: null };
    }
}

export async function getGenderById(id: string) {
    try {
        const response = await authFetch(`/genders/${id}`);
        return response.data;
    } catch (error: any) {
        return { status: false, message: error.message, data: null };
    }
}

export async function createGenders(items: { name: string; status?: string }[]) {
    try {
        const response = await authFetch("/genders", {
            method: "POST",
            body: JSON.stringify({ items }),
        });
        revalidatePath("/master/gender/list");
        return response.data;
    } catch (error: any) {
        return { status: false, message: error.message, data: null };
    }
}

export async function updateGender(id: string, formData: FormData) {
    try {
        const name = formData.get("name") as string;
        const status = formData.get("status") as string;

        const response = await authFetch(`/genders/${id}`, {
            method: "PUT",
            body: JSON.stringify({ name, status }),
        });
        revalidatePath("/master/gender/list");
        return response.data;
    } catch (error: any) {
        return { status: false, message: error.message, data: null };
    }
}

export async function updateGenders(items: { id: string; name: string; status?: string }[]) {
    try {
        const response = await authFetch("/genders/bulk/update", {
            method: "PUT",
            body: JSON.stringify({ items }),
        });
        revalidatePath("/master/gender/list");
        return response.data;
    } catch (error: any) {
        return { status: false, message: error.message, data: null };
    }
}

export async function deleteGender(id: string) {
    try {
        const response = await authFetch(`/genders/${id}`, {
            method: "DELETE",
        });
        revalidatePath("/master/gender/list");
        return response.data;
    } catch (error: any) {
        return { status: false, message: error.message, data: null };
    }
}

export async function deleteGenders(ids: string[]) {
    try {
        const response = await authFetch("/genders/bulk/delete", {
            method: "DELETE",
            body: JSON.stringify({ ids }),
        });
        revalidatePath("/master/gender/list");
        return response.data;
    } catch (error: any) {
        return { status: false, message: error.message, data: null };
    }
}
