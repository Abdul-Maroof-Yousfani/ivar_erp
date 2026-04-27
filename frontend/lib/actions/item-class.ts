"use server";

import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface ItemClass {
    id: string;
    name: string;
    status: string;
    createdBy?: string;
    createdById?: string;
    createdAt: string;
    updatedAt: string;
}

export async function getItemClasses(): Promise<{ status: boolean; data: ItemClass[]; message?: string }> {
    try {
        const res = await authFetch("/master/erp/item-class", {
            cache: "no-store",
        });
        return res.data;
    } catch (error) {
        console.error("Failed to fetch item classes:", error);
        return { status: false, data: [], message: "Failed to fetch item classes" };
    }
}

export async function createItemClasses(items: { name: string; status?: string }[]): Promise<{ status: boolean; message: string }> {
    try {
        const res = await authFetch("/master/erp/item-class", {
            method: "POST",
            body: JSON.stringify({ items }),
        });
        return res.data;
    } catch (error) {
        console.error("Failed to create item classes:", error);
        return { status: false, message: "Failed to create item classes" };
    }
}

export async function updateItemClass(id: string, data: { name?: string; status?: string }): Promise<{ status: boolean; message: string }> {
    try {
        const res = await authFetch(`/master/erp/item-class/${id}`, {
            method: "PUT",
            body: JSON.stringify(data),
        });
        revalidatePath("/master/class/list");
        return res.data;
    } catch (error) {
        console.error("Failed to update item class:", error);
        return { status: false, message: "Failed to update item class" };
    }
}

export async function bulkUpdateItemClasses(items: { id: string; name: string; status?: string }[]): Promise<{ status: boolean; message: string }> {
    try {
        const res = await authFetch("/master/erp/item-class/bulk", {
            method: "PUT",
            body: JSON.stringify({ items }),
        });
        revalidatePath("/master/class/list");
        return res.data;
    } catch (error) {
        console.error("Failed to bulk update item classes:", error);
        return { status: false, message: "Failed to bulk update item classes" };
    }
}

export async function deleteItemClass(id: string): Promise<{ status: boolean; message: string }> {
    try {
        const res = await authFetch(`/master/erp/item-class/${id}`, {
            method: "DELETE",
        });
        revalidatePath("/master/class/list");
        return res.data;
    } catch (error) {
        console.error("Failed to delete item class:", error);
        return { status: false, message: "Failed to delete item class" };
    }
}

export async function bulkDeleteItemClasses(ids: string[]): Promise<{ status: boolean; message: string }> {
    try {
        const res = await authFetch("/master/erp/item-class/bulk", {
            method: "DELETE",
            body: JSON.stringify({ ids }),
        });
        revalidatePath("/master/class/list");
        return res.data;
    } catch (error) {
        console.error("Failed to bulk delete item classes:", error);
        return { status: false, message: "Failed to bulk delete item classes" };
    }
}
