"use server";

import { revalidatePath } from "next/cache";
import { authFetch } from "@/lib/auth";

export interface JournalVoucherDetail {
    accountId: string;
    accountName?: string; // Optional for display
    debit: number;
    credit: number;
}

export interface JournalVoucher {
    id: string;
    jvNo: string;
    jvDate: string;
    description: string;
    details: JournalVoucherDetail[];
    status: string;
    createdAt: string;
    updatedAt: string;
}

export async function getJournalVouchers() {
    try {
        const response = await authFetch("/finance/journal-voucher", {
            cache: 'no-store',
            next: { revalidate: 0 }
        });

        if (!response.ok) {
            console.error("Failed to fetch journal vouchers", response.status);
            return {
                status: false,
                data: []
            };
        }

        const data = response.data;
        return {
            status: true,
            data: data
        };
    } catch (error) {
        console.error("Error fetching journal vouchers:", error);
        return {
            status: false,
            data: []
        };
    }
}

export async function createJournalVoucher(data: any) {
    try {
        const response = await authFetch("/finance/journal-voucher", {
            method: "POST",
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorData = response.data || {};
            return {
                status: false,
                message: errorData.message || `Failed to create Journal Voucher: ${response.statusText || response.status}`
            };
        }

        const result = response.data;

        revalidatePath("/finance/journal-voucher/list");
        revalidatePath("/erp/finance/journal-voucher/list"); // Ensure correct path revalidation

        return { status: true, message: "Journal Voucher created successfully", data: result };
    } catch (error: any) {
        console.error("Error creating journal voucher:", error);
        return { status: false, message: error.message || "An unexpected error occurred" };
    }
}

export async function getJournalVoucher(id: string) {
    try {
        const response = await authFetch(`/finance/journal-voucher/${id}`, {
            cache: 'no-store',
        });
        if (!response.ok) {
            return { status: false, data: null, message: response.data?.message || 'Failed to fetch journal voucher' };
        }
        return { status: true, data: response.data?.data || response.data };
    } catch (error: any) {
        return { status: false, data: null, message: error.message };
    }
}

export async function updateJournalVoucher(id: string, data: any) {
    try {
        const response = await authFetch(`/finance/journal-voucher/${id}`, {
            method: "PUT",
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            return { status: false, message: response.data?.message || 'Failed to update journal voucher' };
        }
        revalidatePath("/finance/journal-voucher/list");
        revalidatePath("/erp/finance/journal-voucher/list");
        revalidatePath(`/erp/finance/journal-voucher/${id}`);
        return { status: true, message: "Journal voucher updated successfully", data: response.data };
    } catch (error: any) {
        return { status: false, message: error.message };
    }
}
