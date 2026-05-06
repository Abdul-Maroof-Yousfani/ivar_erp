"use server";

import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface Segment {
    id: string;
    name: string;
    status: string;
    createdBy?: string;
    createdById?: string;
    createdAt: string;
    updatedAt: string;
}

export async function getSegments(): Promise<{ status: boolean; data: Segment[]; message?: string }> {
    try {
        const res = await authFetch("/master/erp/segment", {
            cache: "no-store",
        });
        return res.data;
    } catch (error) {
        console.error("Failed to fetch segments:", error);
        return { status: false, data: [], message: "Failed to fetch segments" };
    }
}

export async function createSegments(items: { name: string; status: string }[]) {
    try {
        const res = await authFetch("/master/erp/segment", {
            method: "POST",
            body: JSON.stringify({ items }),
        });
        const result = res.data;
        if (result.status) {
            revalidatePath("/master/segment/list");
        }
        return result;
    } catch (error) {
        console.error("Failed to create segments:", error);
        return { status: false, message: "Failed to create segments" };
    }
}

export async function updateSegment(id: string, formData: FormData) {
    try {
        const name = formData.get("name") as string;
        const status = formData.get("status") as string;

        const res = await authFetch(`/master/erp/segment/${id}`, {
            method: "PUT",
            body: JSON.stringify({ name, status }),
        });
        const result = res.data;
        if (result.status) {
            revalidatePath("/master/segment/list");
        }
        return result;
    } catch (error) {
        console.error("Failed to update segment:", error);
        return { status: false, message: "Failed to update segment" };
    }
}

export async function deleteSegment(id: string) {
    try {
        const res = await authFetch(`/master/erp/segment/${id}`, {
            method: "DELETE",
        });
        const result = res.data;
        if (result.status) {
            revalidatePath("/master/segment/list");
        }
        return result;
    } catch (error) {
        console.error("Failed to delete segment:", error);
        return { status: false, message: "Failed to delete segment" };
    }
}

export async function bulkDeleteSegments(ids: string[]) {
    try {
        const res = await authFetch("/master/erp/segment/bulk", {
            method: "DELETE",
            body: JSON.stringify({ ids }),
        });
        const result = res.data;
        if (result.status) {
            revalidatePath("/master/segment/list");
        }
        return result;
    } catch (error) {
        console.error("Failed to bulk delete segments:", error);
        return { status: false, message: "Failed to bulk delete segments" };
    }
}

export async function bulkUpdateSegments(items: { id: string; name: string; status: string }[]) {
    try {
        const res = await authFetch("/master/erp/segment/bulk", {
            method: "PUT",
            body: JSON.stringify({ items }),
        });
        const result = res.data;
        if (result.status) {
            revalidatePath("/master/segment/list");
        }
        return result;
    } catch (error) {
        console.error("Failed to bulk update segments:", error);
        return { status: false, message: "Failed to bulk update segments" };
    }
}
