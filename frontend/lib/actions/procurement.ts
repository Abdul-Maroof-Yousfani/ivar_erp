"use server";

import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function getVendors() {
    try {
        const response = await authFetch("/finance/suppliers");
        const result = response.data;
        return result;
    } catch (error) {
        console.error("Get vendors error:", error);
        return { status: false, message: "Failed to fetch vendors", data: [] };
    }
}

export async function getVendor(id: string) {
    try {
        const response = await authFetch(`/finance/suppliers/${id}`);
        const result = response.data;
        return result;
    } catch (error) {
        console.error("Get vendor error:", error);
        return { status: false, message: "Failed to fetch vendor", data: null };
    }
}

export async function updateVendor(id: string, data: any) {
    try {
        // Transform data to match backend DTO
        const payload = {
            ...data,
            type: data.type === "local" ? "LOCAL" : "INTERNATIONAL",
            nature: data.type === "local" ? data.nature : undefined,
            brand: data.type === "import" ? data.brand : undefined,
            cnicNo: data.cnic,
            ntnNo: data.ntn,
            strnNo: data.strn,
            srbNo: data.srb,
            praNo: data.pra,
            ictNo: data.ict,
            // Clean up old keys
            cnic: undefined,
            ntn: undefined,
            strn: undefined,
            srb: undefined,
            pra: undefined,
            ict: undefined,
        };

        const response = await authFetch(`/finance/suppliers/${id}`, {
            method: "PATCH",
            body: JSON.stringify({
                ...payload,
                chartOfAccountId: undefined, // ensure we don't send the old key
            }),
        });

        const result = response.data;

        if (result.status) {
            revalidatePath("/erp/procurement/vendors");
            revalidatePath(`/erp/procurement/vendors/view/${id}`);
            revalidatePath(`/erp/procurement/vendors/edit/${id}`);
        }

        return result;
    } catch (error) {
        console.error("Update vendor error:", error);
        return { status: false, message: "Failed to update vendor" };
    }
}

export async function createVendor(data: any) {
    try {
        // Transform data to match backend DTO
        const payload = {
            ...data,
            type: data.type === "local" ? "LOCAL" : "INTERNATIONAL",
            nature: data.type === "local" ? data.nature : undefined,
            brand: data.type === "import" ? data.brand : undefined,
            cnicNo: data.cnic,
            ntnNo: data.ntn,
            strnNo: data.strn,
            srbNo: data.srb,
            praNo: data.pra,
            ictNo: data.ict,
            // Clean up old keys
            cnic: undefined,
            ntn: undefined,
            strn: undefined,
            srb: undefined,
            pra: undefined,
            ict: undefined,
        };

        const response = await authFetch("/finance/suppliers", {
            method: "POST",
            body: JSON.stringify({
                ...payload,
                chartOfAccountId: undefined,
            }),
        });

        const result = response.data;

        if (result.status) {
            revalidatePath("/erp/procurement/vendors"); // Or list page
        }

        return result;
    } catch (error) {
        console.error("Create vendor error:", error);
        return { status: false, message: "Failed to create vendor" };
    }
}
