"use server";

import { authFetch } from "@/lib/auth";

export async function getStockTransfers(filters?: {
    warehouseId?: string;
    status?: string;
}) {
    try {
        const queryParams = new URLSearchParams();
        if (filters?.warehouseId) queryParams.append("warehouseId", filters.warehouseId);
        if (filters?.status) queryParams.append("status", filters.status);

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
