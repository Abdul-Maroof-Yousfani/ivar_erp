"use server";

import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface StockAdjustmentItem {
    id: string;
    stockAdjustmentId: string;
    itemId: string;
    locationId: string | null;
    currentQty: number;
    physicalQty: number;
    adjustedQty: number;
    rate: number;
    item: {
        id: string;
        itemId: string;
        sku: string;
        description: string | null;
    };
    location?: {
        id: string;
        name: string;
        code: string;
    } | null;
}

export interface StockAdjustment {
    id: string;
    adjustmentNo: string;
    warehouseId: string;
    adjustmentDate: string;
    status: "DRAFT" | "SUBMITTED" | "CANCELLED";
    reason: string | null;
    notes: string | null;
    createdById: string | null;
    approvedById: string | null;
    createdAt: string;
    updatedAt: string;
    warehouse: {
        name: string;
        code: string;
    };
    items: StockAdjustmentItem[];
}

export async function getStockAdjustments(filters?: {
    warehouseId?: string;
    status?: string;
    page?: number;
    limit?: number;
    search?: string;
}) {
    try {
        const queryParams = new URLSearchParams();
        if (filters?.warehouseId) queryParams.append("warehouseId", filters.warehouseId);
        if (filters?.status) queryParams.append("status", filters.status);
        if (filters?.page) queryParams.append("page", String(filters.page));
        if (filters?.limit) queryParams.append("limit", String(filters.limit));
        if (filters?.search) queryParams.append("search", filters.search);

        const url = `/stock-adjustments${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
        const response = await authFetch(url, { method: "GET" });
        return response.data ?? { status: false, data: [], meta: { total: 0, page: 1, limit: 50, totalPages: 0 } };
    } catch (error) {
        console.error("Get stock adjustments error:", error);
        return { status: false, data: [], meta: { total: 0, page: 1, limit: 50, totalPages: 0 } };
    }
}

export async function getStockAdjustment(id: string): Promise<StockAdjustment | null> {
    try {
        const response = await authFetch(`/stock-adjustments/${id}`, { method: "GET" });
        return response.data ?? null;
    } catch (error) {
        console.error("Get stock adjustment error:", error);
        return null;
    }
}

export async function createStockAdjustment(data: {
    warehouseId: string;
    reason?: string;
    notes?: string;
    items: { itemId: string; locationId?: string; physicalQty: number; rate?: number }[];
}) {
    try {
        const response = await authFetch("/stock-adjustments", {
            method: "POST",
            body: JSON.stringify(data),
        });
        const result = response.data;
        revalidatePath("/erp/inventory/transactions/stock-adjustment");
        return result;
    } catch (error) {
        console.error("Create stock adjustment error:", error);
        throw error;
    }
}

export async function updateStockAdjustment(
    id: string,
    data: {
        warehouseId: string;
        reason?: string;
        notes?: string;
        items: { itemId: string; locationId?: string; physicalQty: number; rate?: number }[];
    },
) {
    try {
        const response = await authFetch(`/stock-adjustments/${id}`, {
            method: "PUT",
            body: JSON.stringify(data),
        });
        const result = response.data;
        revalidatePath("/erp/inventory/transactions/stock-adjustment");
        revalidatePath(`/erp/inventory/transactions/stock-adjustment/${id}`);
        return result;
    } catch (error) {
        console.error("Update stock adjustment error:", error);
        throw error;
    }
}

export async function submitStockAdjustment(id: string) {
    try {
        const response = await authFetch(`/stock-adjustments/${id}/submit`, {
            method: "POST",
        });
        const result = response.data;
        revalidatePath("/erp/inventory/transactions/stock-adjustment");
        revalidatePath(`/erp/inventory/transactions/stock-adjustment/${id}`);
        return result;
    } catch (error) {
        console.error("Submit stock adjustment error:", error);
        throw error;
    }
}

export async function deleteStockAdjustment(id: string) {
    try {
        const response = await authFetch(`/stock-adjustments/${id}`, {
            method: "DELETE",
        });
        const result = response.data;
        revalidatePath("/erp/inventory/transactions/stock-adjustment");
        return result;
    } catch (error) {
        console.error("Delete stock adjustment error:", error);
        throw error;
    }
}

export async function searchInventoryItems(query: string, warehouseId?: string, locationId?: string) {
    try {
        const queryParams = new URLSearchParams();
        queryParams.append("q", query);
        if (warehouseId) queryParams.append("warehouseId", warehouseId);
        if (locationId) queryParams.append("locationId", locationId);

        const response = await authFetch(`/inventory/search?${queryParams.toString()}`, { method: "GET" });
        return response.data ?? { status: false, data: [] };
    } catch (error) {
        console.error("Search inventory items error:", error);
        return { status: false, data: [] };
    }
}

