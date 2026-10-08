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
    locationId?: string;
    warehouseId?: string;
    startDate?: string;
    endDate?: string;
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
        if (filters.locationId) queryParams.append("locationId", filters.locationId);
        if (filters.warehouseId) queryParams.append("warehouseId", filters.warehouseId);
        if (filters.startDate) queryParams.append("startDate", filters.startDate);
        if (filters.endDate) queryParams.append("endDate", filters.endDate);
        if (filters.summaryOnly) queryParams.append("summaryOnly", "true");
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
    locationId?: string;
    warehouseId?: string;
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
}): Promise<{ status: boolean; data?: { jobId: string }; message?: string }> {
    try {
        const url = `/stock-ledger/activity-report/export/queue`;
        const response = await authFetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                locationId: filters.locationId,
                warehouseId: filters.warehouseId,
                startDate: filters.startDate,
                endDate: filters.endDate,
                format: filters.format,
                summaryOnly: !!filters.summaryOnly,
                showBrand: filters.showBrand,
                showDivision: filters.showDivision,
                showCategory: filters.showCategory,
                showGender: filters.showGender,
                showSilhouette: filters.showSilhouette,
                showArticle: filters.showArticle,
                showVariant: filters.showVariant,
            }),
        });
        return response.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        console.error("Queue stock activity report export error:", error);
        return { status: false, message: "Failed to connect to server" };
    }
}

export async function getStockActivityReportExportStatus(jobId: string): Promise<{ status: boolean; data?: { state: string; progress: number }; message?: string }> {
    try {
        const url = `/stock-ledger/activity-report/export/${jobId}/status`;
        const response = await authFetch(url, { method: "GET" });
        return response.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        console.error("Get stock activity report status error:", error);
        return { status: false, message: "Failed to connect to server" };
    }
}

export async function getStockValuationReport(filters: {
    locationId?: string;
    startDate?: string;
    endDate?: string;
    summaryOnly?: boolean;
    showBrand?: boolean;
    showDivision?: boolean;
    showCategory?: boolean;
    showGender?: boolean;
    showSilhouette?: boolean;
    showArticle?: boolean;
    showVariant?: boolean;
    page?: number;
    limit?: number;
}) {
    try {
        const queryParams = new URLSearchParams();
        if (filters.locationId) queryParams.append("locationId", filters.locationId);
        if (filters.startDate) queryParams.append("startDate", filters.startDate);
        if (filters.endDate) queryParams.append("endDate", filters.endDate);
        if (filters.summaryOnly) queryParams.append("summaryOnly", "true");
        if (filters.showBrand !== undefined) queryParams.append("showBrand", String(filters.showBrand));
        if (filters.showDivision !== undefined) queryParams.append("showDivision", String(filters.showDivision));
        if (filters.showCategory !== undefined) queryParams.append("showCategory", String(filters.showCategory));
        if (filters.showGender !== undefined) queryParams.append("showGender", String(filters.showGender));
        if (filters.showSilhouette !== undefined) queryParams.append("showSilhouette", String(filters.showSilhouette));
        if (filters.showArticle !== undefined) queryParams.append("showArticle", String(filters.showArticle));
        if (filters.showVariant !== undefined) queryParams.append("showVariant", String(filters.showVariant));
        if (filters.page) queryParams.append("page", String(filters.page));
        if (filters.limit) queryParams.append("limit", String(filters.limit));

        const queryString = queryParams.toString();
        const url = `/stock-ledger/valuation-report${queryString ? `?${queryString}` : ""}`;

        const response = await authFetch(url, { method: "GET" });
        return response.data;
    } catch (error) {
        console.error("Get stock valuation report error:", error);
        return { status: false, data: [], message: "Failed to fetch stock valuation report" };
    }
}

export async function queueStockValuationReportExport(filters: {
    locationId?: string;
    startDate?: string;
    endDate?: string;
    format: "xlsx" | "pdf";
    exportType?: "hierarchical" | "flat";
    filterBrands?: string[];
    filterDivisions?: string[];
    filterCategories?: string[];
    filterGenders?: string[];
    filterSilhouettes?: string[];
    searchText?: string;
    summaryOnly?: boolean;
    showBrand?: boolean;
    showDivision?: boolean;
    showCategory?: boolean;
    showGender?: boolean;
    showSilhouette?: boolean;
    showArticle?: boolean;
    showVariant?: boolean;
}): Promise<{ status: boolean; data?: { jobId: string }; message?: string }> {
    try {
        const url = `/stock-ledger/valuation-report/export/queue`;
        const response = await authFetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                ...(filters.locationId ? { locationId: filters.locationId } : {}),
                startDate: filters.startDate,
                endDate: filters.endDate,
                format: filters.format,
                exportType: filters.exportType,
                filterBrands: filters.filterBrands,
                filterDivisions: filters.filterDivisions,
                filterCategories: filters.filterCategories,
                filterGenders: filters.filterGenders,
                filterSilhouettes: filters.filterSilhouettes,
                searchText: filters.searchText,
                summaryOnly: !!filters.summaryOnly,
                showBrand: filters.showBrand,
                showDivision: filters.showDivision,
                showCategory: filters.showCategory,
                showGender: filters.showGender,
                showSilhouette: filters.showSilhouette,
                showArticle: filters.showArticle,
                showVariant: filters.showVariant,
                previewJobId: (filters as any).previewJobId,
            }),
        });
        return response.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        console.error("Queue stock valuation report export error:", error);
        return { status: false, message: "Failed to connect to server" };
    }
}

export async function queueStockValuationPreview(filters: {
    locationId?: string;
    startDate?: string;
    endDate?: string;
    summaryOnly?: boolean;
    showBrand?: boolean;
    showDivision?: boolean;
    showCategory?: boolean;
    showGender?: boolean;
    showSilhouette?: boolean;
    showArticle?: boolean;
    showVariant?: boolean;
    filterBrands?: string[];
    filterDivisions?: string[];
    filterCategories?: string[];
    filterGenders?: string[];
    filterSilhouettes?: string[];
    searchText?: string;
}) {
    try {
        const response = await authFetch("/stock-ledger/valuation-report/queue", {
            method: "POST",
            body: filters,
        });
        return response.data;
    } catch (error: any) {
        console.error("Queue stock valuation preview error:", error);
        return { status: false, message: error.message || "Failed to queue stock valuation preview" };
    }
}

export async function getStockValuationResult(jobId: string) {
    try {
        const response = await authFetch(`/stock-ledger/valuation-report/result/${jobId}`, {
            method: "GET",
        });
        return response.data;
    } catch (error: any) {
        console.error("Get stock valuation result error:", error);
        return { status: false, message: error.message || "Failed to fetch stock valuation result" };
    }
}

export async function getStockValuationReportExportStatus(jobId: string): Promise<{ status: boolean; data?: { state: string; progress: number }; message?: string }> {
    try {
        const url = `/stock-ledger/valuation-report/export/${jobId}/status`;
        const response = await authFetch(url, { method: "GET" });
        return response.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        console.error("Get stock valuation report status error:", error);
        return { status: false, message: "Failed to connect to server" };
    }
}


export async function getStockTransactionDetailReport(filters: {
    locationId?: string;
    warehouseId?: string;
    itemId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
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
        if (filters.locationId) queryParams.append("locationId", filters.locationId);
        if (filters.warehouseId) queryParams.append("warehouseId", filters.warehouseId);
        if (filters.itemId) queryParams.append("itemId", filters.itemId);
        if (filters.startDate) queryParams.append("startDate", filters.startDate);
        if (filters.endDate) queryParams.append("endDate", filters.endDate);
        if (filters.search) queryParams.append("search", filters.search);
        if (filters.showBrand !== undefined) queryParams.append("showBrand", String(filters.showBrand));
        if (filters.showDivision !== undefined) queryParams.append("showDivision", String(filters.showDivision));
        if (filters.showCategory !== undefined) queryParams.append("showCategory", String(filters.showCategory));
        if (filters.showGender !== undefined) queryParams.append("showGender", String(filters.showGender));
        if (filters.showSilhouette !== undefined) queryParams.append("showSilhouette", String(filters.showSilhouette));
        if (filters.showArticle !== undefined) queryParams.append("showArticle", String(filters.showArticle));
        if (filters.showVariant !== undefined) queryParams.append("showVariant", String(filters.showVariant));

        const queryString = queryParams.toString();
        const url = `/stock-ledger/transaction-detail-report${queryString ? `?${queryString}` : ""}`;

        const response = await authFetch(url, { method: "GET" });
        return response.data;
    } catch (error) {
        console.error("Get stock transaction detail report error:", error);
        return { status: false, data: { root: [], grandTotals: { openingBalance: 0, closingBalance: 0, inTransitQty: 0 } }, message: "Failed to fetch stock transaction detail report" };
    }
}

export async function queueStockTransactionDetailReportExport(filters: {
    locationId?: string;
    warehouseId?: string;
    itemId?: string;
    startDate?: string;
    endDate?: string;
    format: "xlsx" | "pdf";
    search?: string;
    showBrand?: boolean;
    showDivision?: boolean;
    showCategory?: boolean;
    showGender?: boolean;
    showSilhouette?: boolean;
    showArticle?: boolean;
    showVariant?: boolean;
}): Promise<{ status: boolean; data?: { jobId: string }; message?: string }> {
    try {
        const url = `/stock-ledger/transaction-detail-report/export/queue`;
        const response = await authFetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(filters),
        });
        return response.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        console.error("Queue stock transaction detail report export error:", error);
        return { status: false, message: "Failed to connect to server" };
    }
}

export async function getStockTransactionDetailReportExportStatus(jobId: string): Promise<{ status: boolean; data?: { state: string; progress: number }; message?: string }> {
    try {
        const url = `/stock-ledger/transaction-detail-report/export/${jobId}/status`;
        const response = await authFetch(url, { method: "GET" });
        return response.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        console.error("Get stock transaction detail report status error:", error);
        return { status: false, message: "Failed to connect to server" };
    }
}

export async function getAvailableStockSummaryReport(filters: {
    locationId?: string;
    warehouseId?: string;
    asOfDate?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
    reportType?: "merged" | "separate";
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
        if (filters.locationId) queryParams.append("locationId", filters.locationId);
        if (filters.warehouseId) queryParams.append("warehouseId", filters.warehouseId);
        if (filters.asOfDate) queryParams.append("asOfDate", filters.asOfDate);
        if (filters.date) queryParams.append("date", filters.date);
        if (filters.startDate) queryParams.append("startDate", filters.startDate);
        if (filters.endDate) queryParams.append("endDate", filters.endDate);
        if (filters.reportType) queryParams.append("reportType", filters.reportType);
        if (filters.summaryOnly) queryParams.append("summaryOnly", "true");
        if (filters.showBrand !== undefined) queryParams.append("showBrand", String(filters.showBrand));
        if (filters.showDivision !== undefined) queryParams.append("showDivision", String(filters.showDivision));
        if (filters.showCategory !== undefined) queryParams.append("showCategory", String(filters.showCategory));
        if (filters.showGender !== undefined) queryParams.append("showGender", String(filters.showGender));
        if (filters.showSilhouette !== undefined) queryParams.append("showSilhouette", String(filters.showSilhouette));
        if (filters.showArticle !== undefined) queryParams.append("showArticle", String(filters.showArticle));
        if (filters.showVariant !== undefined) queryParams.append("showVariant", String(filters.showVariant));

        const queryString = queryParams.toString();
        const url = `/stock-ledger/available-stock-summary${queryString ? `?${queryString}` : ""}`;

        const response = await authFetch(url, { method: "GET" });
        return response.data;
    } catch (error: any) {
        console.error("Get available stock summary report error:", error);
        return { status: false, data: [], message: "Failed to fetch available stock summary report" };
    }
}

export async function queueAvailableStockSummaryPreview(filters: {
    locationId?: string;
    warehouseId?: string;
    asOfDate?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
    reportType?: "merged" | "separate";
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
        const response = await authFetch("/stock-ledger/available-stock-summary/queue", {
            method: "POST",
            body: filters,
        });
        return response.data;
    } catch (error: any) {
        console.error("Queue available stock summary preview error:", error);
        return { status: false, message: error.message || "Failed to queue available stock summary report preview" };
    }
}

export async function getAvailableStockSummaryResult(jobId: string) {
    try {
        const response = await authFetch(`/stock-ledger/available-stock-summary/result/${jobId}`, {
            method: "GET",
        });
        return response.data;
    } catch (error: any) {
        console.error("Get available stock summary result error:", error);
        return { status: false, message: error.message || "Failed to fetch report result" };
    }
}

export async function queueAvailableStockSummaryReportExport(filters: {
    locationId?: string;
    warehouseId?: string;
    asOfDate?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
    format: "xlsx" | "pdf";
    exportType?: "hierarchical" | "flat";
    reportType?: "merged" | "separate";
    summaryOnly?: boolean;
    showBrand?: boolean;
    showDivision?: boolean;
    showCategory?: boolean;
    showGender?: boolean;
    showSilhouette?: boolean;
    showArticle?: boolean;
    showVariant?: boolean;
    includeCosting?: boolean;
    previewJobId?: string;
}): Promise<{ status: boolean; data?: { jobId: string }; message?: string }> {
    try {
        const url = `/stock-ledger/available-stock-summary/export/queue`;
        const response = await authFetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(filters),
        });
        return response.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        console.error("Queue available stock summary report export error:", error);
        return { status: false, message: "Failed to connect to server" };
    }
}

export async function getAvailableStockSummaryReportExportStatus(jobId: string): Promise<{ status: boolean; data?: { state: string; progress: number }; message?: string }> {
    try {
        const url = `/stock-ledger/available-stock-summary/export/${jobId}/status`;
        const response = await authFetch(url, { method: "GET" });
        return response.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        console.error("Get available stock summary report status error:", error);
        return { status: false, message: "Failed to connect to server" };
    }
}

export async function registerClientGeneratedExport(
    formData: FormData
): Promise<{ status: boolean; data?: { jobId: string }; message?: string }> {
    try {
        const url = `/stock-ledger/available-stock-summary/export/register-client-export`;
        const response = await authFetch(url, {
            method: "POST",
            body: formData,
        });
        return response.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        console.error("Register client export error:", error);
        return { status: false, message: "Failed to connect to server" };
    }
}

export async function registerOverallAvailableReservedStockClientExport(
    formData: FormData
): Promise<{ status: boolean; data?: { jobId: string }; message?: string }> {
    try {
        const url = `/stock-ledger/overall-available-reserved-stock/export/register-client-export`;
        const response = await authFetch(url, {
            method: "POST",
            body: formData,
        });
        return response.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        console.error("Register overall available reserved stock client export error:", error);
        return { status: false, message: "Failed to connect to server" };
    }
}

export async function getOverallAvailableReservedStockReport(filters: {
    locationId?: string;
    warehouseId?: string;
    asOfDate?: string;
    summaryOnly?: boolean;
    showBrand?: boolean;
    showDivision?: boolean;
    showCategory?: boolean;
    showGender?: boolean;
    showSilhouette?: boolean;
    showArticle?: boolean;
    showVariant?: boolean;
    includeCosting?: boolean;
}) {
    try {
        const queryParams = new URLSearchParams();
        if (filters.locationId) queryParams.append("locationId", filters.locationId);
        if (filters.warehouseId) queryParams.append("warehouseId", filters.warehouseId);
        if (filters.asOfDate) queryParams.append("asOfDate", filters.asOfDate);
        if (filters.summaryOnly) queryParams.append("summaryOnly", "true");
        if (filters.showBrand !== undefined) queryParams.append("showBrand", String(filters.showBrand));
        if (filters.showDivision !== undefined) queryParams.append("showDivision", String(filters.showDivision));
        if (filters.showCategory !== undefined) queryParams.append("showCategory", String(filters.showCategory));
        if (filters.showGender !== undefined) queryParams.append("showGender", String(filters.showGender));
        if (filters.showSilhouette !== undefined) queryParams.append("showSilhouette", String(filters.showSilhouette));
        if (filters.showArticle !== undefined) queryParams.append("showArticle", String(filters.showArticle));
        if (filters.showVariant !== undefined) queryParams.append("showVariant", String(filters.showVariant));
        if (filters.includeCosting !== undefined) queryParams.append("includeCosting", String(filters.includeCosting));

        const queryString = queryParams.toString();
        const url = `/stock-ledger/overall-available-reserved-stock${queryString ? `?${queryString}` : ""}`;

        const response = await authFetch(url, { method: "GET" });
        return response.data;
    } catch (error) {
        console.error("Get overall available reserved stock report error:", error);
        return { status: false, data: [], message: "Failed to fetch overall available reserved stock report" };
    }
}

export async function queueOverallAvailableReservedStockPreview(filters: {
    locationId?: string;
    warehouseId?: string;
    asOfDate?: string;
    summaryOnly?: boolean;
    showBrand?: boolean;
    showDivision?: boolean;
    showCategory?: boolean;
    showGender?: boolean;
    showSilhouette?: boolean;
    showArticle?: boolean;
    showVariant?: boolean;
    includeCosting?: boolean;
}): Promise<{ status: boolean; data?: { jobId: string; queuePosition: number; waitingCount: number }; message?: string }> {
    try {
        const url = `/stock-ledger/overall-available-reserved-stock/queue`;
        const response = await authFetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(filters),
        });
        return response.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        console.error("Queue overall available reserved stock preview error:", error);
        return { status: false, message: "Failed to connect to server" };
    }
}

export async function getOverallAvailableReservedStockResult(jobId: string): Promise<{ status: boolean; data?: any; message?: string }> {
    try {
        const url = `/stock-ledger/overall-available-reserved-stock/result/${jobId}`;
        const response = await authFetch(url, { method: "GET" });
        return response.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        console.error("Get overall available reserved stock result error:", error);
        return { status: false, message: "Failed to fetch report result" };
    }
}

export async function cancelOverallAvailableReservedStockPreview(jobId: string): Promise<{ status: boolean; message?: string }> {
    try {
        const url = `/stock-ledger/overall-available-reserved-stock/cancel-preview/${jobId}`;
        const response = await authFetch(url, { method: "POST" });
        return response.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        console.error("Cancel overall available reserved stock preview error:", error);
        return { status: false, message: "Failed to cancel report preview" };
    }
}

export async function queueOverallAvailableReservedStockReportExport(filters: {
    locationId?: string;
    warehouseId?: string;
    asOfDate?: string;
    format: "xlsx" | "pdf";
    summaryOnly?: boolean;
    showBrand?: boolean;
    showDivision?: boolean;
    showCategory?: boolean;
    showGender?: boolean;
    showSilhouette?: boolean;
    showArticle?: boolean;
    showVariant?: boolean;
    includeCosting?: boolean;
    previewJobId?: string;
}): Promise<{ status: boolean; data?: { jobId: string }; message?: string }> {
    try {
        const url = `/stock-ledger/overall-available-reserved-stock/export/queue`;
        const response = await authFetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(filters),
        });
        return response.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        console.error("Queue overall available reserved stock report export error:", error);
        return { status: false, message: "Failed to connect to server" };
    }
}

export async function getOverallAvailableReservedStockReportExportStatus(jobId: string): Promise<{ status: boolean; data?: { state: string; progress: number }; message?: string }> {
    try {
        const url = `/stock-ledger/overall-available-reserved-stock/export/${jobId}/status`;
        const response = await authFetch(url, { method: "GET" });
        return response.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        console.error("Get overall available reserved stock report status error:", error);
        return { status: false, message: "Failed to connect to server" };
    }
}

export async function queueStockTransactionDetailPreview(filters: {
    locationId?: string;
    warehouseId?: string;
    itemId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    showBrand?: boolean;
    showDivision?: boolean;
    showCategory?: boolean;
    showGender?: boolean;
    showSilhouette?: boolean;
    showArticle?: boolean;
    showVariant?: boolean;
}): Promise<{ status: boolean; data?: { jobId: string }; message?: string }> {
    try {
        const url = `/stock-ledger/stock-transaction-detail/queue`;
        const response = await authFetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(filters),
        });
        return response.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        console.error("Queue stock transaction detail report preview error:", error);
        return { status: false, message: "Failed to queue preview computation" };
    }
}

export async function getStockTransactionDetailResult(jobId: string): Promise<any> {
    try {
        const url = `/stock-ledger/stock-transaction-detail/result/${jobId}`;
        const response = await authFetch(url, { method: "GET" });
        return response.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        console.error("Get stock transaction detail result error:", error);
        return { status: false, message: "Failed to fetch report result" };
    }
}



// ─── Out-of-Stock Items Report ───────────────────────────────────────────────
export async function getOutOfStockReport(filters: {
    locationId?: string;
    warehouseId?: string;
    brandIds?: string[];
    categoryIds?: string[];
    divisionIds?: string[];
    genderIds?: string[];
    seasonIds?: string[];
    search?: string;
    threshold?: 'zero' | 'negative' | 'low_stock' | 'all';
    minThreshold?: number;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}) {
    try {
        const queryParams = new URLSearchParams();
        if (filters?.locationId && filters.locationId !== "all") queryParams.append("locationId", filters.locationId);
        if (filters?.warehouseId && filters.warehouseId !== "all") queryParams.append("warehouseId", filters.warehouseId);
        if (filters?.brandIds && filters.brandIds.length > 0) queryParams.append("brandIds", filters.brandIds.join(","));
        if (filters?.categoryIds && filters.categoryIds.length > 0) queryParams.append("categoryIds", filters.categoryIds.join(","));
        if (filters?.divisionIds && filters.divisionIds.length > 0) queryParams.append("divisionIds", filters.divisionIds.join(","));
        if (filters?.genderIds && filters.genderIds.length > 0) queryParams.append("genderIds", filters.genderIds.join(","));
        if (filters?.seasonIds && filters.seasonIds.length > 0) queryParams.append("seasonIds", filters.seasonIds.join(","));
        if (filters?.search) queryParams.append("search", filters.search);
        if (filters?.threshold) queryParams.append("threshold", filters.threshold);
        if (filters?.minThreshold) queryParams.append("minThreshold", String(filters.minThreshold));
        if (filters?.page) queryParams.append("page", String(filters.page));
        if (filters?.limit) queryParams.append("limit", String(filters.limit));
        if (filters?.sortBy) queryParams.append("sortBy", filters.sortBy);
        if (filters?.sortOrder) queryParams.append("sortOrder", filters.sortOrder);

        const response = await authFetch(`/stock-ledger/out-of-stock-report?${queryParams.toString()}`, { method: "GET" });
        return response.data ?? { status: false, data: { data: [], summary: {}, meta: {} } };
    } catch (error) {
        console.error("getOutOfStockReport error:", error);
        return { status: false, data: { data: [], summary: {}, meta: {} } };
    }
}

export async function queueOutOfStockReportExport(payload: {
    locationId?: string;
    warehouseId?: string;
    brandIds?: string[];
    categoryIds?: string[];
    divisionIds?: string[];
    genderIds?: string[];
    seasonIds?: string[];
    search?: string;
    threshold?: 'zero' | 'negative' | 'low_stock' | 'all';
    minThreshold?: number;
    format?: 'xlsx' | 'pdf';
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}) {
    try {
        const response = await authFetch("/stock-ledger/out-of-stock-report/export/queue", {
            method: "POST",
            body: JSON.stringify(payload),
        });
        return response.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        console.error("queueOutOfStockReportExport error:", error);
        return { status: false, message: "Failed to connect to export server" };
    }
}

export async function getOutOfStockReportExportStatus(jobId: string) {
    try {
        const response = await authFetch(`/stock-ledger/out-of-stock-report/export/${jobId}/status`, {
            method: "GET",
        });
        return response.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        console.error("getOutOfStockReportExportStatus error:", error);
        return { status: false, message: "Failed to connect to server" };
    }
}
