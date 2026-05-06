"use server";

import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getLandedCosts() {
    try {
        const response = await authFetch("/landed-cost");
        return response.data ?? [];
    } catch (error) {
        console.error("Get landed costs error:", error);
        return [];
    }
}

export async function getLandedCost(id: string) {
    try {
        const response = await authFetch(`/landed-cost/${id}`);
        return response.data ?? null;
    } catch (error) {
        console.error("Get landed cost error:", error);
        return null;
    }
}

export async function createLandedCost(data: any) {
    try {
        const response = await authFetch("/landed-cost", {
            method: "POST",
            body: JSON.stringify(data),
        });
        const result = response.data;
        revalidatePath("/erp/procurement/landed-cost");
        return result;
    } catch (error) {
        console.error("Create landed cost error:", error);
        throw error;
    }
}

export async function createLocalLandedCost(data: any) {
    try {
        const response = await authFetch("/landed-cost/local", {
            method: "POST",
            body: JSON.stringify(data),
        });
        const result = response.data;
        revalidatePath("/erp/procurement/landed-cost");
        return result;
    } catch (error) {
        console.error("Create local landed cost error:", error);
        throw error;
    }
}

export async function postLandedCost(data: {
    grnId: string;
    charges: { accountId: string; amount: number }[];
}) {
    try {
        const response = await authFetch("/landed-cost/post", {
            method: "POST",
            body: JSON.stringify(data),
        });
        const result = response.data;
        revalidatePath("/erp/procurement/landed-cost");
        return result;
    } catch (error) {
        console.error("Post landed cost error:", error);
        throw error;
    }
}

export async function getLandedCostChargeTypes() {
    try {
        const response = await authFetch("/landed-cost/charge-types");
        return response.data ?? { status: false, data: [] };
    } catch (error) {
        console.error("Get charge types error:", error);
        return { status: false, data: [] };
    }
}
