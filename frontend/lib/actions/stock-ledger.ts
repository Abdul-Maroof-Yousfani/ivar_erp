"use strict";
"use server";

import { authFetch } from "@/lib/auth";
import { MovementType } from "@/lib/api";

export async function getStockLedger(filters?: {
    warehouseId?: string;
    movementType?: MovementType;
    itemId?: string;
    referenceType?: string;
    page?: number;
    limit?: number;
}) {
    try {
        const queryParams = new URLSearchParams();
        if (filters?.warehouseId) queryParams.append("warehouseId", filters.warehouseId);
        if (filters?.movementType) queryParams.append("movementType", filters.movementType);
        if (filters?.itemId) queryParams.append("itemId", filters.itemId);
        if (filters?.referenceType) queryParams.append("referenceType", filters.referenceType);
        if (filters?.page) queryParams.append("page", String(filters.page));
        if (filters?.limit) queryParams.append("limit", String(filters.limit));

        const queryString = queryParams.toString();
        const url = `/stock-ledger${queryString ? `?${queryString}` : ""}`;

        const response = await authFetch(url, { method: "GET" });
        const result = response.data;

        if (Array.isArray(result)) {
            return { status: true, data: result, meta: { total: result.length, page: 1, limit: result.length, totalPages: 1 } };
        }

        return result;
    } catch (error) {
        console.error("Get stock ledger error:", error);
        return { status: false, data: [], message: "Failed to fetch stock ledger" };
    }
}
