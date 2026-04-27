"use server";

import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface ReceiptVoucher {
    id: string;
    type: "bank" | "cash";
    rvNo: string;
    rvDate: string;
    refBillNo?: string;
    billDate?: string;
    debitAccountId: string;
    debitAccount?: any;
    debitAccountName?: string;
    debitAmount: number;
    customerId?: string;
    status: "pending" | "approved" | "rejected";
    description: string;
    chequeNo?: string;
    chequeDate?: string;
    details: { accountId: string; accountName?: string; credit: number }[];
    invoices?: { salesInvoiceId: string; receivedAmount: number }[];
    createdAt: string;
    createdBy: string;
}

export async function getReceiptVouchers(type?: "bank" | "cash") {
    try {
        const q = type ? `?type=${type}` : "";
        const response = await authFetch(`/finance/receipt-vouchers${q}`, { cache: 'no-store' });
        if (!response.ok) return { status: false, data: [] };
        const data = response.data;
        return {
            status: true,
            data: data.map((rv: any) => ({
                ...rv,
                debitAccountName: rv.debitAccount?.name || "Unknown Account",
                details: rv.details?.map((d: any) => ({ ...d, accountName: d.account?.name || "Unknown" })) || [],
            })),
        };
    } catch {
        return { status: false, data: [] };
    }
}

export async function createReceiptVoucher(data: any) {
    try {
        const payload = {
            ...data,
            rvDate: new Date(data.rvDate).toISOString(),
            billDate: data.billDate ? new Date(data.billDate).toISOString() : null,
            chequeDate: data.chequeDate ? new Date(data.chequeDate).toISOString() : null,
        };
        
        // Remove null/undefined values
        Object.keys(payload).forEach(key => {
            if (payload[key] === null || payload[key] === undefined || payload[key] === '') {
                delete payload[key];
            }
        });

        console.log('Sending payload:', payload);

        const response = await authFetch("/finance/receipt-vouchers", {
            method: "POST",
            body: JSON.stringify(payload),
        });
        if (!response.ok) {
            const err = response.data || {};
            return { status: false, message: err.message || `Failed: ${response.status}` };
        }
        revalidatePath("/erp/finance/receipt-voucher/list");
        return { status: true, message: "Receipt Voucher created successfully" };
    } catch (e: any) {
        return { status: false, message: e.message || "An unexpected error occurred" };
    }
}

export async function getAllCustomers() {
    try {
        const response = await authFetch("/finance/receipt-vouchers/customers", { cache: 'no-store' });
        if (!response.ok) return { status: false, data: [] };
        return { status: true, data: response.data };
    } catch {
        return { status: false, data: [] };
    }
}

export async function getPendingInvoicesByCustomer(customerId: string) {
    try {
        const response = await authFetch(`/finance/receipt-vouchers/pending-invoices/${customerId}`, { cache: 'no-store' });
        if (!response.ok) return { status: false, data: [] };
        return { status: true, data: response.data };
    } catch {
        return { status: false, data: [] };
    }
}

export async function getSalesInvoices(search?: string, status?: string) {
    try {
        const q = new URLSearchParams();
        if (search) q.set("search", search);
        if (status && status !== "all") q.set("status", status);
        const response = await authFetch(`/sales/invoices?${q.toString()}`, { cache: 'no-store' });
        if (!response.ok) {
            console.error('Sales invoices API error:', response);
            return { status: false, data: [] };
        }
        return response.data || { status: true, data: [] };
    } catch (error) {
        console.error('Sales invoices fetch error:', error);
        return { status: false, data: [] };
    }
}
