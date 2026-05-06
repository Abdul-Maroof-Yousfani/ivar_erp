"use server";

import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getPurchaseOrders() {
    try {
        const response = await authFetch("/purchase-order");
        return response.data ?? [];
    } catch (error) {
        console.error("Get POs error:", error);
        return [];
    }
}

export async function getPurchaseOrder(id: string) {
    try {
        const response = await authFetch(`/purchase-order/${id}`);
        return response.data ?? null;
    } catch (error) {
        console.error("Get PO error:", error);
        return null;
    }
}

export async function getPendingQuotations() {
    try {
        const response = await authFetch("/purchase-order/pending-quotations");
        return response.data ?? [];
    } catch (error) {
        console.error("Get pending quotations error:", error);
        return [];
    }
}

export async function createPurchaseOrder(data: {
    vendorQuotationId?: string;
    vendorId?: string;
    purchaseRequisitionId?: string;
    items?: { itemId: string; description?: string; quantity: number; unitPrice: number }[];
    notes?: string;
    expectedDeliveryDate?: string;
    orderType?: string;
    goodsType?: string;
}) {
    try {
        const response = await authFetch("/purchase-order", {
            method: "POST",
            body: JSON.stringify(data),
        });
        const result = response.data;
        revalidatePath("/erp/procurement/purchase-order");
        return result;
    } catch (error) {
        console.error("Create PO error:", error);
        throw error;
    }
}

export async function awardFromRfq(data: {
    rfqId: string;
    awards: {
        vendorQuotationId: string;
        items: { itemId: string; quantity: number }[];
        notes?: string;
        expectedDeliveryDate?: string;
    }[];
}) {
    try {
        const response = await authFetch("/purchase-order/award-from-rfq", {
            method: "POST",
            body: JSON.stringify(data),
        });
        const result = response.data;
        revalidatePath("/erp/procurement/purchase-order");
        return result;
    } catch (error) {
        console.error("Award from RFQ error:", error);
        throw error;
    }
}

export async function createMultiDirectPurchaseOrder(data: {
    awards: {
        vendorId: string;
        items: { itemId: string; description?: string; quantity: number; unitPrice: number }[];
        notes?: string;
        expectedDeliveryDate?: string;
        orderType?: string;
        goodsType?: string;
    }[];
}) {
    try {
        const response = await authFetch("/purchase-order/multi-direct", {
            method: "POST",
            body: JSON.stringify(data),
        });
        const result = response.data;
        revalidatePath("/erp/procurement/purchase-order");
        return result;
    } catch (error) {
        console.error("Create multi-direct PO error:", error);
        throw error;
    }
}

export async function updatePurchaseOrderStatus(id: string, status: string) {
    try {
        const response = await authFetch(`/purchase-order/${id}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status }),
        });
        const result = response.data;
        revalidatePath("/erp/procurement/purchase-order");
        revalidatePath(`/erp/procurement/purchase-order/${id}`);
        return result;
    } catch (error) {
        console.error("Update PO status error:", error);
        throw error;
    }
}
