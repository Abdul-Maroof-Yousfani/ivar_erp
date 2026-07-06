"use strict";
"use server";

import { authFetch } from "@/lib/auth";
import { MovementType } from "@/lib/api";

export async function getStockLedger(filters?: {
    warehouseId?: string;
    locationId?: string;
    movementType?: MovementType;
    itemId?: string;
    referenceType?: string;
    page?: number;
    limit?: number;
    search?: string;
}) {
    try {
        const queryParams = new URLSearchParams();
        if (filters?.warehouseId) queryParams.append("warehouseId", filters.warehouseId);
        if (filters?.locationId) queryParams.append("locationId", filters.locationId);
        if (filters?.movementType) queryParams.append("movementType", filters.movementType);
        if (filters?.itemId) queryParams.append("itemId", filters.itemId);
        if (filters?.referenceType) queryParams.append("referenceType", filters.referenceType);
        if (filters?.page) queryParams.append("page", String(filters.page));
        if (filters?.limit) queryParams.append("limit", String(filters.limit));
        if (filters?.search) queryParams.append("search", filters.search);

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

export async function queueStockLedgerExport(filters?: {
    warehouseId?: string;
    locationId?: string;
    movementType?: MovementType;
    itemId?: string;
    referenceType?: string;
    search?: string;
}): Promise<{ status: boolean; data?: { jobId: string }; message?: string }> {
    try {
        const queryParams = new URLSearchParams();
        if (filters?.warehouseId) queryParams.append("warehouseId", filters.warehouseId);
        if (filters?.locationId) queryParams.append("locationId", filters.locationId);
        if (filters?.movementType) queryParams.append("movementType", filters.movementType);
        if (filters?.itemId) queryParams.append("itemId", filters.itemId);
        if (filters?.referenceType) queryParams.append("referenceType", filters.referenceType);
        if (filters?.search) queryParams.append("search", filters.search);

        const queryString = queryParams.toString();
        const url = `/stock-ledger/export${queryString ? `?${queryString}` : ""}`;

        const response = await authFetch(url, { method: "POST" });
        return response.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        console.error("Queue stock ledger export error:", error);
        return { status: false, message: "Failed to connect to server" };
    }
}

export async function getStockActivityReport(filters: {
    locationId: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    summaryOnly?: boolean;
    showBrand?: boolean;
    showDivision?: boolean;
    showCategory?: boolean;
    showGender?: boolean;
    showSilhouette?: boolean;
    showArticle?: boolean;
    showVariant?: boolean;
}) {
    try {
        const queryParams = new URLSearchParams();
        queryParams.append("locationId", filters.locationId);
        if (filters.startDate) queryParams.append("startDate", filters.startDate);
        if (filters.endDate) queryParams.append("endDate", filters.endDate);
        if (filters.search) queryParams.append("search", filters.search);
        if (filters.summaryOnly !== undefined) queryParams.append("summaryOnly", String(filters.summaryOnly));
        if (filters.showBrand !== undefined) queryParams.append("showBrand", String(filters.showBrand));
        if (filters.showDivision !== undefined) queryParams.append("showDivision", String(filters.showDivision));
        if (filters.showCategory !== undefined) queryParams.append("showCategory", String(filters.showCategory));
        if (filters.showGender !== undefined) queryParams.append("showGender", String(filters.showGender));
        if (filters.showSilhouette !== undefined) queryParams.append("showSilhouette", String(filters.showSilhouette));
        if (filters.showArticle !== undefined) queryParams.append("showArticle", String(filters.showArticle));
        if (filters.showVariant !== undefined) queryParams.append("showVariant", String(filters.showVariant));

        const queryString = queryParams.toString();
        const url = `/stock-ledger/activity-report${queryString ? `?${queryString}` : ""}`;

        const response = await authFetch(url, { method: "GET" });
        return response.data;
    } catch (error) {
        console.error("Get stock activity report error:", error);
        return { status: false, data: [], message: "Failed to fetch stock activity report" };
    }
}

export async function queueStockActivityReportExport(filters: {
    locationId: string;
    startDate?: string;
    endDate?: string;
    format: "xlsx" | "pdf";
    summaryOnly?: boolean;
    showBrand?: boolean;
    showDivision?: boolean;
    showCategory?: boolean;
    showGender?: boolean;
    showSilhouette?: boolean;
    showArticle?: boolean;
    showVariant?: boolean;
}) {
    try {
        const response = await authFetch("/stock-ledger/activity-report/export/queue", {
            method: "POST",
            body: JSON.stringify(filters),
        });
        return response.data;
    } catch (error) {
        console.error("Queue stock activity report export error:", error);
        return { status: false, message: "Failed to queue stock activity report export" };
    }
}

export async function getStockActivityReportExportStatus(jobId: string) {
    try {
        const response = await authFetch(`/stock-ledger/activity-report/export/${jobId}/status`, {
            method: "GET",
        });
        return response.data;
    } catch (error) {
        console.error("Get stock activity report export status error:", error);
        return { status: false, message: "Failed to get stock activity report export status" };
    }
}
