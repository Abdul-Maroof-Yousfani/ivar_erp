"use server";

import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function moveStock(data: {
    itemId: string;
    fromLocationId?: string;
    toLocationId?: string;
    quantity: number;
    type: "TRANSFER" | "INBOUND" | "OUTBOUND";
    notes?: string;
}) {
    try {
        const response = await authFetch("/stock-operation/move", {
            method: "POST",
            body: JSON.stringify(data),
        });
        revalidatePath("/erp/inventory");
        return response.data;
    } catch (error) {
        console.error("Move stock error:", error);
        throw error;
    }
}
