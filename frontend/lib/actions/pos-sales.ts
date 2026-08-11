"use server";

import { authFetch } from "@/lib/auth";

export interface SalesOrder {
    id: string;
    orderNumber: string;
    status: string;
    grandTotal: number;
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    paymentMethod: string | null;
    tenderType: string | null;
    cashAmount: number;
    cardAmount: number;
    isGiftReceipt: boolean;
    createdAt: string;
    updatedAt: string;
    tenders: { method: string; amount: number; cardLast4?: string; slipNo?: string }[];
    items: any[];
    promo: { name: string; code: string } | null;
    coupon: { code: string; description: string } | null;
    alliance: { partnerName: string; code: string; discountPercent: number; maxDiscount: number } | null;
    claims?: Array<{
        id: string;
        claimNumber: string;
        claimType: string;
        status: string;
        claimedAmount: number;
        approvedAmount: number;
        submittedAt: string;
        reviewedAt: string | null;
        items: Array<{
            itemId: string;
            claimedQty: number;
            approvedQty: number;
            itemStatus: string;
        }>;
    }>;
}

export interface ListOrdersResult {
    status: boolean;
    data: SalesOrder[];
    meta: { total: number; page: number; limit: number; totalPages: number };
    message?: string;
}

export async function listSalesOrders(params?: {
    page?: number;
    limit?: number;
    search?: string;
    startDate?: string;
    endDate?: string;
}): Promise<ListOrdersResult> {
    try {
        const res = await authFetch("/pos-sales/orders", {
            params: {
                page: params?.page ?? 1,
                limit: params?.limit ?? 100,
                search: params?.search || undefined,
                startDate: params?.startDate || undefined,
                endDate: params?.endDate || undefined,
            },
        });

        if (res.ok && res.data?.status) {
            return {
                status: true,
                data: res.data.data ?? [],
                meta: res.data.meta ?? { total: 0, page: 1, limit: 100, totalPages: 0 },
            };
        }

        return { status: false, data: [], meta: { total: 0, page: 1, limit: 100, totalPages: 0 }, message: res.data?.message };
    } catch (error) {
        console.error("listSalesOrders error:", error);
        return { status: false, data: [], meta: { total: 0, page: 1, limit: 100, totalPages: 0 }, message: "Failed to fetch orders" };
    }
}

export async function queuePosSalesExport(params?: {
    startDate?: string;
    endDate?: string;
    locationId?: string;
    cashierUserId?: string;
    paymentMethod?: string;
    status?: string;
    search?: string;
}): Promise<{ status: boolean; data?: { jobId: string }; message?: string }> {
    try {
        const res = await authFetch("/pos-sales/export", {
            method: "POST",
            params: {
                startDate: params?.startDate || undefined,
                endDate: params?.endDate || undefined,
                locationId: params?.locationId || undefined,
                cashierUserId: params?.cashierUserId || undefined,
                paymentMethod: params?.paymentMethod || undefined,
                status: params?.status || undefined,
                search: params?.search || undefined,
            },
        });
        return res.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        console.error("queuePosSalesExport error:", error);
        return { status: false, message: "Failed to queue export" };
    }
}

export async function getNetSalesSummaryReport(filters: {
    locationId: string;
    startDate?: string;
    endDate?: string;
    cashierUserId?: string;
    summaryOnly?: boolean;
    showSalesperson?: boolean;
    showYear?: boolean;
    showMonth?: boolean;
    showDay?: boolean;
    showDocument?: boolean;
    showBrand?: boolean;
    showDivision?: boolean;
    showSalesTax?: boolean;
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
        if (filters.cashierUserId) queryParams.append("cashierUserId", filters.cashierUserId);
        if (filters.summaryOnly !== undefined) queryParams.append("summaryOnly", String(filters.summaryOnly));
        if (filters.showSalesperson !== undefined) queryParams.append("showSalesperson", String(filters.showSalesperson));
        if (filters.showYear !== undefined) queryParams.append("showYear", String(filters.showYear));
        if (filters.showMonth !== undefined) queryParams.append("showMonth", String(filters.showMonth));
        if (filters.showDay !== undefined) queryParams.append("showDay", String(filters.showDay));
        if (filters.showDocument !== undefined) queryParams.append("showDocument", String(filters.showDocument));
        if (filters.showBrand !== undefined) queryParams.append("showBrand", String(filters.showBrand));
        if (filters.showDivision !== undefined) queryParams.append("showDivision", String(filters.showDivision));
        if (filters.showSalesTax !== undefined) queryParams.append("showSalesTax", String(filters.showSalesTax));
        if (filters.showCategory !== undefined) queryParams.append("showCategory", String(filters.showCategory));
        if (filters.showGender !== undefined) queryParams.append("showGender", String(filters.showGender));
        if (filters.showSilhouette !== undefined) queryParams.append("showSilhouette", String(filters.showSilhouette));
        if (filters.showArticle !== undefined) queryParams.append("showArticle", String(filters.showArticle));
        if (filters.showVariant !== undefined) queryParams.append("showVariant", String(filters.showVariant));

        const queryString = queryParams.toString();
        const url = `/pos-sales/reports/net-sales-summary${queryString ? `?${queryString}` : ""}`;

        const response = await authFetch(url, { method: "GET" });
        return response.data;
    } catch (error) {
        console.error("Get net sales summary report error:", error);
        return { status: false, data: [], message: "Failed to fetch net sales summary report" };
    }
}

export async function queueNetSalesSummaryReportExport(filters: {
    locationId: string;
    startDate?: string;
    endDate?: string;
    cashierUserId?: string;
    format: "xlsx" | "pdf";
    summaryOnly?: boolean;
    showSalesperson?: boolean;
    showYear?: boolean;
    showMonth?: boolean;
    showDay?: boolean;
    showDocument?: boolean;
    showBrand?: boolean;
    showDivision?: boolean;
    showSalesTax?: boolean;
    showCategory?: boolean;
    showGender?: boolean;
    showSilhouette?: boolean;
    showArticle?: boolean;
    showVariant?: boolean;
}) {
    try {
        const response = await authFetch("/pos-sales/reports/net-sales-summary/export/queue", {
            method: "POST",
            body: JSON.stringify(filters),
        });
        return response.data;
    } catch (error) {
        console.error("Queue net sales summary report export error:", error);
        return { status: false, message: "Failed to queue net sales summary report export" };
    }
}

export async function getNetSalesSummaryReportExportStatus(jobId: string) {
    try {
        const response = await authFetch(`/pos-sales/reports/net-sales-summary/export/${jobId}/status`, {
            method: "GET",
        });
        return response.data;
    } catch (error) {
        console.error("Get net sales summary report export status error:", error);
        return { status: false, message: "Failed to get net sales summary report export status" };
    }
}

export async function getSalespersons(locationId: string) {
    try {
        const response = await authFetch(`/pos-sales/cashiers?locationId=${locationId}`, {
            method: "GET",
        });
        return response.data;
    } catch (error) {
        console.error("Get salespersons error:", error);
        return { status: false, data: [], message: "Failed to fetch salespersons" };
    }
}

export async function listSalesActivities(params?: {
    page?: number;
    limit?: number;
    search?: string;
    startDate?: string;
    endDate?: string;
    activityType?: string;
    locationId?: string;
    posId?: string;
    merchantId?: string;
    paymentMethod?: string;
}) {
    try {
        const res = await authFetch("/pos-sales/activities", {
            params: {
                page: params?.page ?? 1,
                limit: params?.limit ?? 20,
                search: params?.search || undefined,
                startDate: params?.startDate || undefined,
                endDate: params?.endDate || undefined,
                activityType: params?.activityType || undefined,
                locationId: params?.locationId || undefined,
                posId: params?.posId || undefined,
                merchantId: params?.merchantId || undefined,
                paymentMethod: params?.paymentMethod || undefined,
            },
        });

        if (res.ok && res.data?.status) {
            return {
                status: true,
                data: res.data.data ?? [],
                meta: res.data.meta ?? { total: 0, page: 1, limit: 20, totalPages: 0 },
            };
        }

        return { status: false, data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 }, message: res.data?.message };
    } catch (error) {
        console.error("listSalesActivities error:", error);
        return { status: false, data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 }, message: "Failed to fetch activities" };
    }
}


export async function getSalesRegisterReport(filters: {
    locationId: string;
    startDate?: string;
    endDate?: string;
    cashierUserId?: string;
    search?: string;
}) {
    try {
        const queryParams = new URLSearchParams();
        queryParams.append("locationId", filters.locationId);
        if (filters.startDate) queryParams.append("startDate", filters.startDate);
        if (filters.endDate) queryParams.append("endDate", filters.endDate);
        if (filters.cashierUserId) queryParams.append("cashierUserId", filters.cashierUserId);
        if (filters.search) queryParams.append("search", filters.search);

        const res = await authFetch(`/pos-sales/reports/sales-register?${queryParams.toString()}`, { method: "GET" });
        return res.data;
    } catch (error) {
        console.error("getSalesRegisterReport error:", error);
        return { status: false, data: [], message: "Failed to fetch Sales Register Report" };
    }
}

export async function queueSalesRegisterReportExport(filters: {
    locationId: string;
    startDate?: string;
    endDate?: string;
    cashierUserId?: string;
    format: "xlsx" | "pdf";
    search?: string;
}) {
    try {
        const res = await authFetch(`/pos-sales/reports/sales-register/export/queue`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(filters),
        });
        return res.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        console.error("queueSalesRegisterReportExport error:", error);
        return { status: false, message: "Failed to connect to server" };
    }
}

export async function getSalesRegisterReportExportStatus(jobId: string) {
    try {
        const res = await authFetch(`/pos-sales/reports/sales-register/export/${jobId}/status`, { method: "GET" });
        return res.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        console.error("getSalesRegisterReportExportStatus error:", error);
        return { status: false, message: "Failed to connect to server" };
    }
}

export async function queueSalesActivityExport(params?: {
    startDate?: string;
    endDate?: string;
    activityType?: string;
    locationId?: string;
    posId?: string;
    merchantId?: string;
    paymentMethod?: string;
    search?: string;
}): Promise<{ status: boolean; data?: { jobId: string }; message?: string }> {
    try {
        const res = await authFetch("/pos-sales/activity/export", {
            method: "POST",
            params: {
                startDate: params?.startDate || undefined,
                endDate: params?.endDate || undefined,
                activityType: params?.activityType || undefined,
                locationId: params?.locationId || undefined,
                posId: params?.posId || undefined,
                merchantId: params?.merchantId || undefined,
                paymentMethod: params?.paymentMethod || undefined,
                search: params?.search || undefined,
            },
        });

        if (res.ok && res.data?.status) {
            return {
                status: true,
                data: res.data.data,
                message: res.data.message,
            };
        }

        return { status: false, message: res.data?.message || "Failed to queue sales activity export" };
    } catch (error) {
        console.error("queueSalesActivityExport error:", error);
        return { status: false, message: "Failed to queue sales activity export" };
    }
}

export async function queueSalesListReportExport(filters: any) {
    try {
        const res = await authFetch("/pos-sales/reports/sales-list/export/queue", {
            method: "POST",
            body: JSON.stringify(filters),
        });
        return res.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        console.error("queueSalesListReportExport error:", error);
        return { status: false, message: "Failed to queue export" };
    }
}

export async function getSalesListReportExportStatus(jobId: string) {
    try {
        const res = await authFetch(`/pos-sales/reports/sales-list/export/${jobId}/status`, { method: "GET" });
        return res.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        console.error("getSalesListReportExportStatus error:", error);
        return { status: false, message: "Failed to get export status" };
    }
}

export async function queueGrossSalesSummaryReportExport(filters: any) {
    try {
        const res = await authFetch("/pos-sales/reports/gross-sales-summary/export/queue", {
            method: "POST",
            body: JSON.stringify(filters),
        });
        return res.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        console.error("queueGrossSalesSummaryReportExport error:", error);
        return { status: false, message: "Failed to queue export" };
    }
}

export async function getGrossSalesSummaryReportExportStatus(jobId: string) {
    try {
        const res = await authFetch(`/pos-sales/reports/gross-sales-export/${jobId}/status`, { method: "GET" });
        return res.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        console.error("getGrossSalesSummaryReportExportStatus error:", error);
        return { status: false, message: "Failed to get export status" };
    }
}

export async function getGrossSalesExportStatus(jobId: string) {
    try {
        const res = await authFetch(`/pos-sales/reports/gross-sales-export/${jobId}/status`, { method: "GET" });
        return res.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        console.error("getGrossSalesExportStatus error:", error);
        return { status: false, message: "Failed to get export status" };
    }
}

export async function queueGrossSalesReturnReportExport(filters: any) {
    try {
        const res = await authFetch("/pos-sales/reports/gross-sales-return/export/queue", {
            method: "POST",
            body: JSON.stringify(filters),
        });
        return res.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        console.error("queueGrossSalesReturnReportExport error:", error);
        return { status: false, message: "Failed to queue export" };
    }
}

export async function getGrossSalesReturnReportExportStatus(jobId: string) {
    try {
        const res = await authFetch(`/pos-sales/reports/gross-sales-export/${jobId}/status`, { method: "GET" });
        return res.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        console.error("getGrossSalesReturnReportExportStatus error:", error);
        return { status: false, message: "Failed to get export status" };
    }
}

export async function queueAllianceRegisterReportExport(filters: any) {
    try {
        const res = await authFetch("/pos-sales/reports/alliance-register/export/queue", {
            method: "POST",
            body: JSON.stringify(filters),
        });
        return res.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        console.error("queueAllianceRegisterReportExport error:", error);
        return { status: false, message: "Failed to queue export" };
    }
}

export async function getAllianceRegisterReportExportStatus(jobId: string) {
    try {
        const res = await authFetch(`/pos-sales/reports/alliance-register/export/${jobId}/status`, { method: "GET" });
        return res.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        console.error("getAllianceRegisterReportExportStatus error:", error);
        return { status: false, message: "Failed to get export status" };
    }
}

export async function queueCostOfSalesReportExport(filters: any) {
    try {
        const res = await authFetch("/pos-sales/reports/cost-of-sales/export", {
            method: "POST",
            body: JSON.stringify(filters),
        });
        return res.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        return { status: false, message: "Failed to queue export" };
    }
}

export async function getCostOfSalesReportExportStatus(jobId: string) {
    try {
        const res = await authFetch(`/pos-sales/reports/cost-of-sales/export-status/${jobId}`, { method: "GET" });
        return res.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        return { status: false, message: "Failed to get export status" };
    }
}

export async function queueGiftVoucherSaleRegisterReportExport(filters: any) {
    try {
        const res = await authFetch("/pos-sales/reports/gift-voucher-sale-register/export", {
            method: "POST",
            body: JSON.stringify(filters),
        });
        return res.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        return { status: false, message: "Failed to queue export" };
    }
}

export async function getGiftVoucherSaleRegisterReportExportStatus(jobId: string) {
    try {
        const res = await authFetch(`/pos-sales/reports/gift-voucher-sale-register/export-status/${jobId}`, { method: "GET" });
        return res.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        return { status: false, message: "Failed to get export status" };
    }
}

export async function queueCorporateVoucherReportExport(filters: any) {
    try {
        const res = await authFetch("/pos-sales/reports/corporate-voucher/export", {
            method: "POST",
            body: JSON.stringify(filters),
        });
        return res.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        return { status: false, message: "Failed to queue export" };
    }
}

export async function getCorporateVoucherReportExportStatus(jobId: string) {
    try {
        const res = await authFetch(`/pos-sales/reports/corporate-voucher/export-status/${jobId}`, { method: "GET" });
        return res.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        return { status: false, message: "Failed to get export status" };
    }
}

export async function queueCreditVoucherReportExport(filters: any) {
    try {
        const res = await authFetch("/pos-sales/reports/credit-voucher/export", {
            method: "POST",
            body: JSON.stringify(filters),
        });
        return res.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        return { status: false, message: "Failed to queue export" };
    }
}

export async function getCreditVoucherReportExportStatus(jobId: string) {
    try {
        const res = await authFetch(`/pos-sales/reports/credit-voucher/export-status/${jobId}`, { method: "GET" });
        return res.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        return { status: false, message: "Failed to get export status" };
    }
}

export async function queueVoucherRegisterReportExport(filters: any) {
    try {
        const res = await authFetch("/pos-sales/reports/voucher-register/export", {
            method: "POST",
            body: JSON.stringify(filters),
        });
        return res.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        return { status: false, message: "Failed to queue export" };
    }
}

export async function getVoucherRegisterReportExportStatus(jobId: string) {
    try {
        const res = await authFetch(`/pos-sales/reports/voucher-register/export-status/${jobId}`, { method: "GET" });
        return res.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        return { status: false, message: "Failed to get export status" };
    }
}

export async function queueClaimRegisterReportExport(filters: any) {
    try {
        const res = await authFetch("/pos-sales/reports/claim-register/export", {
            method: "POST",
            body: JSON.stringify(filters),
        });
        return res.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        return { status: false, message: "Failed to queue export" };
    }
}

export async function queueGiftVoucherSaleRegisterExport(filters: any) {
    return queueGiftVoucherSaleRegisterReportExport(filters);
}

export async function getGiftVoucherSaleRegisterExportStatus(jobId: string) {
    return getGiftVoucherSaleRegisterReportExportStatus(jobId);
}

export async function queueVoucherRegisterExport(filters: any) {
    return queueVoucherRegisterReportExport(filters);
}

export async function getVoucherRegisterExportStatus(jobId: string) {
    return getVoucherRegisterReportExportStatus(jobId);
}

export async function queueCorporateVoucherExport(filters: any) {
    return queueCorporateVoucherReportExport(filters);
}

export async function getCorporateVoucherExportStatus(jobId: string) {
    return getCorporateVoucherReportExportStatus(jobId);
}

export async function queueCreditVoucherExport(filters: any) {
    return queueCreditVoucherReportExport(filters);
}

export async function getCreditVoucherExportStatus(jobId: string) {
    return getCreditVoucherReportExportStatus(jobId);
}

export async function queueCostOfSalesExport(filters: any) {
    return queueCostOfSalesReportExport(filters);
}

export async function getCostOfSalesExportStatus(jobId: string) {
    return getCostOfSalesReportExportStatus(jobId);
}

export async function queueClaimRegisterExport(filters: any) {
    return queueClaimRegisterReportExport(filters);
}

export async function getClaimRegisterExportStatus(jobId: string) {
    return getClaimRegisterReportExportStatus(jobId);
}

export async function getClaimRegisterReportExportStatus(jobId: string) {
    try {
        const res = await authFetch(`/pos-sales/reports/claim-register/export-status/${jobId}`, { method: "GET" });
        return res.data ?? { status: false, message: "No response from server" };
    } catch (error) {
        return { status: false, message: "Failed to get export status" };
    }
}

export async function getSalesListReport(filters: any) {
    try {
        const queryParams = new URLSearchParams();
        Object.entries(filters || {}).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== "") queryParams.append(k, String(v));
        });
        const res = await authFetch(`/pos-sales/reports/sales-list?${queryParams.toString()}`, { method: "GET" });
        return res.data;
    } catch (error) {
        return { status: false, data: [] };
    }
}

export async function getGrossSalesSummaryReport(filters: any) {
    try {
        const queryParams = new URLSearchParams();
        Object.entries(filters || {}).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== "") queryParams.append(k, String(v));
        });
        const res = await authFetch(`/pos-sales/reports/gross-sales-summary?${queryParams.toString()}`, { method: "GET" });
        return res.data;
    } catch (error) {
        return { status: false, data: [] };
    }
}

export async function getGrossSalesReturnReport(filters: any) {
    try {
        const queryParams = new URLSearchParams();
        Object.entries(filters || {}).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== "") queryParams.append(k, String(v));
        });
        const res = await authFetch(`/pos-sales/reports/gross-sales-return?${queryParams.toString()}`, { method: "GET" });
        return res.data;
    } catch (error) {
        return { status: false, data: [] };
    }
}

export async function getAllianceRegisterReport(filters: any) {
    try {
        const queryParams = new URLSearchParams();
        Object.entries(filters || {}).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== "") queryParams.append(k, String(v));
        });
        const res = await authFetch(`/pos-sales/reports/alliance-register?${queryParams.toString()}`, { method: "GET" });
        return res.data;
    } catch (error) {
        return { status: false, data: [] };
    }
}

export async function getCostOfSalesReport(filters: any) {
    try {
        const queryParams = new URLSearchParams();
        Object.entries(filters || {}).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== "") queryParams.append(k, String(v));
        });
        const res = await authFetch(`/pos-sales/reports/cost-of-sales?${queryParams.toString()}`, { method: "GET" });
        return res.data;
    } catch (error) {
        return { status: false, data: [] };
    }
}

export async function getGiftVoucherSaleRegisterReport(filters: any) {
    try {
        const queryParams = new URLSearchParams();
        Object.entries(filters || {}).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== "") queryParams.append(k, String(v));
        });
        const res = await authFetch(`/pos-sales/reports/gift-voucher-sale-register?${queryParams.toString()}`, { method: "GET" });
        return res.data;
    } catch (error) {
        return { status: false, data: [] };
    }
}

export async function getCorporateVoucherReport(filters: any) {
    try {
        const queryParams = new URLSearchParams();
        Object.entries(filters || {}).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== "") queryParams.append(k, String(v));
        });
        const res = await authFetch(`/pos-sales/reports/corporate-voucher?${queryParams.toString()}`, { method: "GET" });
        return res.data;
    } catch (error) {
        return { status: false, data: [] };
    }
}

export async function getCreditVoucherReport(filters: any) {
    try {
        const queryParams = new URLSearchParams();
        Object.entries(filters || {}).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== "") queryParams.append(k, String(v));
        });
        const res = await authFetch(`/pos-sales/reports/credit-voucher?${queryParams.toString()}`, { method: "GET" });
        return res.data;
    } catch (error) {
        return { status: false, data: [] };
    }
}

export async function getVoucherRegisterReport(filters: any) {
    try {
        const queryParams = new URLSearchParams();
        Object.entries(filters || {}).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== "") queryParams.append(k, String(v));
        });
        const res = await authFetch(`/pos-sales/reports/voucher-register?${queryParams.toString()}`, { method: "GET" });
        return res.data;
    } catch (error) {
        return { status: false, data: [] };
    }
}

export async function getClaimRegisterReport(filters: any) {
    try {
        const queryParams = new URLSearchParams();
        Object.entries(filters || {}).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== "") queryParams.append(k, String(v));
        });
        const res = await authFetch(`/pos-sales/reports/claim-register?${queryParams.toString()}`, { method: "GET" });
        return res.data;
    } catch (error) {
        return { status: false, data: [] };
    }
}





