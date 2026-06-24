"use server";

import { authFetch } from "@/lib/auth";

export async function getStockTransfers(filters?: {
    warehouseId?: string;
    status?: string;
    transferType?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
}) {
    try {
        const queryParams = new URLSearchParams();
        if (filters?.warehouseId) queryParams.append("warehouseId", filters.warehouseId);
        if (filters?.status) queryParams.append("status", filters.status);
        if (filters?.transferType) queryParams.append("transferType", filters.transferType);
        if (filters?.search) queryParams.append("search", filters.search);
        if (filters?.dateFrom) queryParams.append("dateFrom", filters.dateFrom);
        if (filters?.dateTo) queryParams.append("dateTo", filters.dateTo);

        const queryString = queryParams.toString();
        const url = `/transfer-request${queryString ? `?${queryString}` : ""}`;

        const response = await authFetch(url, {
            method: "GET",
        });

        const result = response.data;

        if (result.status) {
            return { status: true, data: result.data };
        }

        return { status: false, data: [], message: result.message || "Failed to fetch stock transfers" };
    } catch (error) {
        console.error("Get stock transfers error:", error);
        return { status: false, data: [], message: "Failed to connect to server" };
    }
}

export async function queueDeliveryNotesExport(filters?: {
    warehouseId?: string;
    status?: string;
    transferType?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
}): Promise<{ status: boolean; data?: { jobId: string }; message?: string }> {
    try {
        const queryParams = new URLSearchParams();
        if (filters?.warehouseId) queryParams.append("warehouseId", filters.warehouseId);
        if (filters?.status) queryParams.append("status", filters.status);
        if (filters?.transferType) queryParams.append("transferType", filters.transferType);
        if (filters?.search) queryParams.append("search", filters.search);
        if (filters?.dateFrom) queryParams.append("dateFrom", filters.dateFrom);
        if (filters?.dateTo) queryParams.append("dateTo", filters.dateTo);

        const queryString = queryParams.toString();
        const url = `/transfer-request/export${queryString ? `?${queryString}` : ""}`;

        const response = await authFetch(url, {
            method: "POST",
        });

        return response.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        console.error("Queue delivery notes export error:", error);
        return { status: false, message: "Failed to connect to server" };
    }
}