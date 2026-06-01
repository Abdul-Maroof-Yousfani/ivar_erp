"use server";

import { revalidatePath } from "next/cache";
import { authFetch } from "@/lib/auth";

export interface JournalVoucherDetail {
    id?: string;
    accountId: string;
    accountName?: string;
    accountCode?: string;
    tagAccountId?: string;
    tagAccountName?: string;
    tagAccountCode?: string;
    debit: number;
    credit: number;
    narration?: string;
    refBillNo?: string;
    isTaxApplicable?: boolean;
}

export interface JournalVoucher {
    id: string;
    jvNo: string;
    jvDate: string;
    description: string;
    details: JournalVoucherDetail[];
    status: "pending" | "approved" | "rejected";
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
        const mappedData = (Array.isArray(data) ? data : (data?.data ?? [])).map((jv: any) => ({
            ...jv,
            details: jv.details?.map((d: any) => ({
                ...d,
                accountName:     d.account?.name     || d.accountName     || "Unknown Account",
                accountCode:     d.account?.code     || d.accountCode     || "",
                tagAccountName:  d.tagAccount?.name  || d.tagAccountName  || "",
                tagAccountCode:  d.tagAccount?.code  || d.tagAccountCode  || "",
                debit:           Number(d.debit)  || 0,
                credit:          Number(d.credit) || 0,
            })) || []
        }));

        return {
            status: true,
            data: mappedData
        };
    } catch (error) {
        console.error("Error fetching journal vouchers:", error);
        return {
            status: false,
            data: []
        };
    }
}

export async function getJournalVoucher(id: string): Promise<{ status: boolean; data: JournalVoucher | null; message?: string }> {
    try {
        const response = await authFetch(`/finance/journal-voucher/${id}`, {
            cache: 'no-store',
            next: { revalidate: 0 },
        });

        if (!response.ok) {
            return { status: false, data: null, message: `Failed to fetch journal voucher: ${response.status}` };
        }

        const raw = response.data?.data ?? response.data;
        const voucher: JournalVoucher = {
            ...raw,
            details: (raw.details ?? []).map((d: any) => ({
                ...d,
                accountName:     d.account?.name     || d.accountName     || "Unknown Account",
                accountCode:     d.account?.code     || d.accountCode     || "",
                tagAccountName:  d.tagAccount?.name  || d.tagAccountName  || "",
                tagAccountCode:  d.tagAccount?.code  || d.tagAccountCode  || "",
                debit:           Number(d.debit)  || 0,
                credit:          Number(d.credit) || 0,
            })),
        };

        return { status: true, data: voucher };
    } catch (error: any) {
        console.error("Error fetching journal voucher:", error);
        return { status: false, data: null, message: error.message };
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
        revalidatePath("/erp/finance/journal-voucher/list");

        return { status: true, message: "Journal Voucher created successfully", data: result };
    } catch (error: any) {
        console.error("Error creating journal voucher:", error);
        return { status: false, message: error.message || "An unexpected error occurred" };
    }
}

export async function updateJournalVoucher(id: string, data: any) {
    try {
        const response = await authFetch(`/finance/journal-voucher/${id}`, {
            method: "PATCH",
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            const errorData = response.data || {};
            return {
                status: false,
                message: errorData.message || `Failed to update Journal Voucher: ${response.statusText || response.status}`
            };
        }

        const result = response.data;

        revalidatePath("/finance/journal-voucher/list");
        revalidatePath(`/erp/finance/journal-voucher/${id}`);
        revalidatePath("/erp/finance/journal-voucher/list");

        return { status: true, message: "Journal Voucher updated successfully", data: result };
    } catch (error: any) {
        console.error("Error updating journal voucher:", error);
        return { status: false, message: error.message || "An unexpected error occurred" };
    }
}

export async function deleteJournalVoucher(id: string) {
    try {
        const response = await authFetch(`/finance/journal-voucher/${id}`, {
            method: "DELETE",
        });

        if (!response.ok) {
            const errorData = response.data || {};
            return {
                status: false,
                message: errorData.message || `Failed to delete Journal Voucher: ${response.statusText || response.status}`
            };
        }

        revalidatePath("/finance/journal-voucher/list");
        revalidatePath("/erp/finance/journal-voucher/list");

        return { status: true, message: "Journal Voucher deleted successfully" };
    } catch (error: any) {
        console.error("Error deleting journal voucher:", error);
        return { status: false, message: error.message || "An unexpected error occurred" };
    }
}
