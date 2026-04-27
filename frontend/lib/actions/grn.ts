"use server";

import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getGrns() {
    try {
        const response = await authFetch("/grn");
        return response.data ?? [];
    } catch (error) {
        console.error("Get GRNs error:", error);
        return [];
    }
}

export async function getGrn(id: string) {
    try {
        const response = await authFetch(`/grn/${id}`);
        return response.data ?? null;
    } catch (error) {
        console.error("Get GRN error:", error);
        return null;
    }
}

export async function createGrn(data: {
    purchaseOrderId: string;
    warehouseId: string;
    notes?: string;
    items: { itemId: string; description?: string; receivedQty: number }[];
}) {
    try {
        const response = await authFetch("/grn", {
            method: "POST",
            body: JSON.stringify(data),
        });
        const result = response.data;
        revalidatePath("/erp/procurement/grn");
        return result;
    } catch (error) {
        console.error("Create GRN error:", error);
        throw error;
    }
}
