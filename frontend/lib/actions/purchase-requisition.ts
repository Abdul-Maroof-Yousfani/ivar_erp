"use server";

import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getPurchaseRequisitions(status?: string) {
    try {
        const response = await authFetch(`/purchase-requisition${status ? `?status=${status}` : ""}`);
        const result = response.data;
        return Array.isArray(result) ? result : (result?.data ?? []);
    } catch (error) {
        console.error("Get PRs error:", error);
        return [];
    }
}

export async function getPurchaseRequisition(id: string) {
    try {
        const response = await authFetch(`/purchase-requisition/${id}`);
        return response.data ?? null;
    } catch (error) {
        console.error("Get PR error:", error);
        return null;
    }
}

export async function createPurchaseRequisition(data: any) {
    try {
        const response = await authFetch("/purchase-requisition", {
            method: "POST",
            body: JSON.stringify(data),
        });
        const result = response.data;
        if (result.status !== false) {
            revalidatePath("/erp/procurement/purchase-requisition");
        }
        return result;
    } catch (error) {
        console.error("Create PR error:", error);
        return { status: false, message: "Failed to create PR" };
    }
}

export async function updatePurchaseRequisition(id: string, data: any) {
    try {
        const response = await authFetch(`/purchase-requisition/${id}`, {
            method: "PATCH",
            body: JSON.stringify(data),
        });
        const result = response.data;
        if (result.status !== false) {
            revalidatePath("/erp/procurement/purchase-requisition");
            revalidatePath(`/erp/procurement/purchase-requisition/${id}`);
        }
        return result;
    } catch (error) {
        console.error("Update PR error:", error);
        return { status: false, message: "Failed to update PR" };
    }
}

export async function deletePurchaseRequisition(id: string) {
    try {
        const response = await authFetch(`/purchase-requisition/${id}`, {
            method: "DELETE",
        });
        const result = response.data;
        if (result.status !== false) {
            revalidatePath("/erp/procurement/purchase-requisition");
        }
        return result;
    } catch (error) {
        console.error("Delete PR error:", error);
        return { status: false, message: "Failed to delete PR" };
    }
}
