"use server";

import { revalidatePath } from "next/cache";
import { authFetch } from "@/lib/auth";

export interface Warehouse {
    id: string;
    code: string;
    name: string;
    type: string;
    address?: string;
    description?: string;
    isActive: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export async function getWarehouses(): Promise<Warehouse[]> {
    try {
        const res = await authFetch("/warehouse", { cache: "no-store" });
        return res.data ?? [];
    } catch (error) {
        console.error("Failed to fetch warehouses:", error);
        return [];
    }
}

export async function getWarehouseById(id: string): Promise<Warehouse | null> {
    try {
        const res = await authFetch(`/warehouse/${id}`, { cache: "no-store" });
        return res.data ?? null;
    } catch (error) {
        console.error("Failed to fetch warehouse:", error);
        return null;
    }
}

export async function createWarehouse(data: Partial<Warehouse>): Promise<{ status: boolean; message: string; data?: Warehouse }> {
    try {
        const res = await authFetch("/warehouse", {
            method: "POST",
            body: JSON.stringify(data),
        });
        if (res.ok) revalidatePath("/erp/inventory/warehouse");
        return res.data;
    } catch (error) {
        return { status: false, message: "Failed to create warehouse" };
    }
}

export async function updateWarehouse(id: string, data: Partial<Warehouse>): Promise<{ status: boolean; message: string; data?: Warehouse }> {
    try {
        const res = await authFetch(`/warehouse/${id}`, {
            method: "PATCH",
            body: JSON.stringify(data),
        });
        if (res.ok) revalidatePath("/erp/inventory/warehouse");
        return res.data;
    } catch (error) {
        return { status: false, message: "Failed to update warehouse" };
    }
}

export async function deleteWarehouse(id: string): Promise<{ status: boolean; message: string }> {
    try {
        const res = await authFetch(`/warehouse/${id}`, {
            method: "DELETE",
        });
        if (res.ok) revalidatePath("/erp/inventory/warehouse");
        return res.data;
    } catch (error) {
        return { status: false, message: "Failed to delete warehouse" };
    }
}
