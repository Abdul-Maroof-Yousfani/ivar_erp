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
