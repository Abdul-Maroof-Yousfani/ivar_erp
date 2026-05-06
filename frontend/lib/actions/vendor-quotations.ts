"use server";

import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getVendorQuotations(rfqId?: string) {
    try {
        const response = await authFetch(`/vendor-quotation${rfqId ? `?rfqId=${rfqId}` : ""}`);
        const result = response.data;
        return result;
    } catch (error) {
        console.error("Get vendor quotations error:", error);
        return { status: false, message: "Failed to fetch vendor quotations", data: [] };
    }
}

export async function getVendorQuotation(id: string) {
    try {
        const response = await authFetch(`/vendor-quotation/${id}`);
        const result = response.data;
        return result;
    } catch (error) {
        console.error("Get vendor quotation error:", error);
        return { status: false, message: "Failed to fetch vendor quotation", data: null };
    }
}

export async function createVendorQuotation(data: any) {
    try {
        const response = await authFetch("/vendor-quotation", {
            method: "POST",
            body: JSON.stringify(data),
        });
        const result = response.data;
        if (result.status) {
            revalidatePath("/erp/procurement/vendor-quotation");
            if (data.rfqId) {
                revalidatePath(`/erp/procurement/rfq/${data.rfqId}`);
            }
        }
        return result;
    } catch (error) {
        console.error("Create vendor quotation error:", error);
        return { status: false, message: "Failed to create vendor quotation" };
    }
}

export async function compareQuotations(rfqId: string) {
    try {
        const response = await authFetch(`/vendor-quotation/compare/${rfqId}`);
        const result = response.data;
        return result;
    } catch (error) {
        console.error("Compare quotations error:", error);
        return { status: false, message: "Failed to compare quotations", data: [] };
    }
}

export async function submitVendorQuotation(id: string) {
    try {
        const response = await authFetch(`/vendor-quotation/${id}/submit`, {
            method: "POST",
        });
        const result = response.data;
        if (result.status) {
            revalidatePath("/erp/procurement/vendor-quotation");
            revalidatePath(`/erp/procurement/vendor-quotation/list${id}`);
        }
        return result;
    } catch (error) {
        console.error("Submit vendor quotation error:", error);
        return { status: false, message: "Failed to submit vendor quotation" };
    }
}

export async function selectVendorQuotation(id: string) {
    try {
        const response = await authFetch(`/vendor-quotation/${id}/select`, {
            method: "POST",
        });
        const result = response.data;
        if (result.status) {
            revalidatePath("/erp/procurement/vendor-quotation");
            revalidatePath(`/erp/procurement/vendor-quotation/${id}`);
        }
        return result;
    } catch (error) {
        console.error("Select vendor quotation error:", error);
        return { status: false, message: "Failed to select vendor quotation" };
    }
}
