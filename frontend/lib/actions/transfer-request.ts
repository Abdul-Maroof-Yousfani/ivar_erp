"use server";

import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getTransferRequests(params?: { warehouseId?: string; status?: string }) {
    try {
        const query = params ? new URLSearchParams(params as any).toString() : '';
        const response = await authFetch(`/transfer-request?${query}`);
        return response.data ?? { status: false, data: [] };
    } catch (error) {
        console.error("Get transfer requests error:", error);
        return { status: false, data: [] };
    }
}

export async function getIncomingTransferRequests(locationId: string) {
    try {
        const response = await authFetch(`/transfer-request/incoming?locationId=${locationId}`);
        return response.data ?? { status: false, data: [] };
    } catch (error) {
        console.error("Get incoming transfer requests error:", error);
        return { status: false, data: [] };
    }
}

export async function getReturnTransferRequests(locationId: string) {
    try {
        const response = await authFetch(`/transfer-request/return-requests?locationId=${locationId}`);
        return response.data ?? { status: false, data: [] };
    } catch (error) {
        console.error("Get return transfer requests error:", error);
        return { status: false, data: [] };
    }
}

export async function getOutboundTransferRequests(locationId: string) {
    try {
        const response = await authFetch(`/transfer-request/outbound-requests?locationId=${locationId}`);
        return response.data ?? { status: false, data: [] };
    } catch (error) {
        console.error("Get outbound transfer requests error:", error);
        return { status: false, data: [] };
    }
}

export async function getInboundTransferRequests(locationId: string) {
    try {
        const response = await authFetch(`/transfer-request/inbound-requests?locationId=${locationId}`);
        return response.data ?? { status: false, data: [] };
    } catch (error) {
        console.error("Get inbound transfer requests error:", error);
        return { status: false, data: [] };
    }
}

export async function createTransferRequest(data: any) {
    try {
        const response = await authFetch("/transfer-request", {
            method: "POST",
            body: JSON.stringify(data),
        });
        revalidatePath("/erp/inventory/transactions/stock-transfer");
        return response.data ?? { status: false, message: "Failed to create transfer request" };
    } catch (error) {
        console.error("Create transfer request error:", error);
        throw error;
    }
}

export async function createReturnTransferRequest(data: {
    fromLocationId: string;
    fromWarehouseId: string;
    items: { itemId: string; quantity: number }[];
    notes?: string;
    createdById?: string;
}) {
    return createTransferRequest({
        ...data,
        transferType: "OUTLET_TO_WAREHOUSE",
        toLocationId: null,
    });
}

export async function createOutletToOutletTransferRequest(data: {
    fromLocationId: string;
    toLocationId: string;
    items: { itemId: string; quantity: number }[];
    notes?: string;
    createdById?: string;
}) {
    return createTransferRequest({
        ...data,
        transferType: "OUTLET_TO_OUTLET",
    });
}

export async function updateTransferRequestStatus(id: string, status: string) {
    try {
        const response = await authFetch(`/transfer-request/${id}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status }),
        });
        revalidatePath("/erp/inventory/transactions/stock-transfer");
        return response.data ?? { status: false, message: "Failed to update status" };
    } catch (error) {
        console.error("Update transfer request status error:", error);
        throw error;
    }
}

export async function acceptTransferRequest(id: string, userId?: string) {
    try {
        const response = await authFetch(`/transfer-request/${id}/accept`, {
            method: "POST",
            body: JSON.stringify({ userId }),
        });
        revalidatePath("/erp/inventory/transactions/stock-transfer");
        return response.data ?? { status: false, message: "Failed to accept transfer request" };
    } catch (error) {
        console.error("Accept transfer request error:", error);
        throw error;
    }
}

export async function approveSourceTransferRequest(id: string, userId?: string) {
    try {
        const response = await authFetch(`/transfer-request/${id}/approve-source`, {
            method: "POST",
            body: JSON.stringify({ userId }),
        });
        revalidatePath("/erp/inventory/transactions/stock-transfer");
        return response.data ?? { status: false, message: "Failed to approve source" };
    } catch (error) {
        console.error("Approve source transfer request error:", error);
        throw error;
    }
}
