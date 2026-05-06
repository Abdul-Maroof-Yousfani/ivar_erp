"use server";

import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface ItemSubclass {
    id: string;
    name: string;
    itemClassId: string;
    status: string;
    itemClass?: {
        name: string;
    };
    createdBy?: string;
    createdById?: string;
    createdAt: string;
    updatedAt: string;
}

export async function getItemSubclasses(): Promise<{ status: boolean; data: ItemSubclass[]; message?: string }> {
    try {
        const res = await authFetch("/master/erp/item-subclass", {
            cache: "no-store",
        });
        return res.data;
    } catch (error) {
        console.error("Failed to fetch item subclasses:", error);
        return { status: false, data: [], message: "Failed to fetch item subclasses" };
    }
}

export async function getItemSubclassesByClass(itemClassId: string): Promise<{ status: boolean; data: ItemSubclass[]; message?: string }> {
    try {
        const res = await authFetch(`/master/erp/item-subclass/class/${itemClassId}`, {
            cache: "no-store",
        });
        return res.data;
    } catch (error) {
        console.error("Failed to fetch item subclasses by class:", error);
        return { status: false, data: [], message: "Failed to fetch item subclasses" };
    }
}

export async function createItemSubclasses(items: { name: string; itemClassId: string; status?: string }[]): Promise<{ status: boolean; message: string }> {
    try {
        const res = await authFetch("/master/erp/item-subclass", {
            method: "POST",
            body: JSON.stringify({ items }),
        });
        return res.data;
    } catch (error) {
        console.error("Failed to create item subclasses:", error);
        return { status: false, message: "Failed to create item subclasses" };
    }
}

export async function updateItemSubclass(id: string, data: { name?: string; itemClassId?: string; status?: string }): Promise<{ status: boolean; message: string }> {
    try {
        const res = await authFetch(`/master/erp/item-subclass/${id}`, {
            method: "PUT",
            body: JSON.stringify(data),
        });
        revalidatePath("/master/subclass/list");
        return res.data;
    } catch (error) {
        console.error("Failed to update item subclass:", error);
        return { status: false, message: "Failed to update item subclass" };
    }
}

export async function bulkUpdateItemSubclasses(items: { id: string; name: string; itemClassId: string; status?: string }[]): Promise<{ status: boolean; message: string }> {
    try {
        const res = await authFetch("/master/erp/item-subclass/bulk", {
            method: "PUT",
            body: JSON.stringify({ items }),
        });
        revalidatePath("/master/subclass/list");
        return res.data;
    } catch (error) {
        console.error("Failed to bulk update item subclasses:", error);
        return { status: false, message: "Failed to bulk update item subclasses" };
    }
}

export async function deleteItemSubclass(id: string): Promise<{ status: boolean; message: string }> {
    try {
        const res = await authFetch(`/master/erp/item-subclass/${id}`, {
            method: "DELETE",
        });
        revalidatePath("/master/subclass/list");
        return res.data;
    } catch (error) {
        console.error("Failed to delete item subclass:", error);
        return { status: false, message: "Failed to delete item subclass" };
    }
}

export async function bulkDeleteItemSubclasses(ids: string[]): Promise<{ status: boolean; message: string }> {
    try {
        const res = await authFetch("/master/erp/item-subclass/bulk", {
            method: "DELETE",
            body: JSON.stringify({ ids }),
        });
        revalidatePath("/master/subclass/list");
        return res.data;
    } catch (error) {
        console.error("Failed to bulk delete item subclasses:", error);
        return { status: false, message: "Failed to bulk delete item subclasses" };
    }
}
