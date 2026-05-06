"use server";

import { revalidatePath } from "next/cache";
import { authFetch } from "@/lib/auth";

export interface ChannelClass {
    id: string;
    name: string;
    status: string;
    createdById?: string;
    createdBy?: string;
    createdAt: string;
    updatedAt: string;
}

export async function getChannelClasses() {
    try {
        const response = await authFetch("/channel-classes");
        return response.data;
    } catch (error: any) {
        return { status: false, message: error.message, data: null };
    }
}

export async function createChannelClasses(items: { name: string; status?: string }[]) {
    try {
        const response = await authFetch("/channel-classes", {
            method: "POST",
            body: JSON.stringify({ items }),
        });
        revalidatePath("/master/channel-class/list");
        return response.data;
    } catch (error: any) {
        return { status: false, message: error.message, data: null };
    }
}

export async function updateChannelClass(id: string, formData: FormData) {
    try {
        const name = formData.get("name") as string;
        const status = formData.get("status") as string;

        const response = await authFetch(`/channel-classes/${id}`, {
            method: "PUT",
            body: JSON.stringify({ name, status }),
        });
        revalidatePath("/master/channel-class/list");
        return response.data;
    } catch (error: any) {
        return { status: false, message: error.message, data: null };
    }
}

export async function updateChannelClasses(items: { id: string; name: string; status?: string }[]) {
    try {
        const response = await authFetch("/channel-classes/bulk/update", {
            method: "PUT",
            body: JSON.stringify({ items }),
        });
        revalidatePath("/master/channel-class/list");
        return response.data;
    } catch (error: any) {
        return { status: false, message: error.message, data: null };
    }
}

export async function deleteChannelClass(id: string) {
    try {
        const response = await authFetch(`/channel-classes/${id}`, {
            method: "DELETE",
        });
        revalidatePath("/master/channel-class/list");
        return response.data;
    } catch (error: any) {
        return { status: false, message: error.message, data: null };
    }
}

export async function deleteChannelClasses(ids: string[]) {
    try {
        const response = await authFetch("/channel-classes/bulk/delete", {
            method: "DELETE",
            body: JSON.stringify({ ids }),
        });
        revalidatePath("/master/channel-class/list");
        return response.data;
    } catch (error: any) {
        return { status: false, message: error.message, data: null };
    }
}
