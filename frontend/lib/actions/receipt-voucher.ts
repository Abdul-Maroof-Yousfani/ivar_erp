"use server";

import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface ReceiptVoucherDetail {
    id: string;
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

export interface ReceiptVoucher {
    id: string;
    type: "bank" | "cash";
    rvNo: string;
    rvDate: string;
    refBillNo?: string;
    billDate?: string;
    debitAccountId: string;
    debitAccountName?: string;
    debitAccountCode?: string;
    debitAmount: number;
    customerId?: string;
    status: "pending" | "approved" | "rejected";
    description: string;
    isTaxApplicable?: boolean;
    isAdvance?: boolean;
    chequeNo?: string;
    chequeDate?: string;
    details: ReceiptVoucherDetail[];
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
        const vouchersArray = data.data || data;
        
        if (!Array.isArray(vouchersArray)) {
            return { status: false, data: [] };
        }

        return {
            status: true,
            data: vouchersArray.map((rv: any) => ({
                ...rv,
                debitAmount: rv.debitAmount !== undefined ? Number(rv.debitAmount) : 0,
                debitAccountName: rv.debitAccount?.name || rv.debitAccountName || "Unknown Account",
                debitAccountCode: rv.debitAccount?.code || "",
                details: rv.details?.map((d: any) => ({
                    ...d,
                    accountName:     d.account?.name     || d.accountName     || "Unknown Account",
                    accountCode:     d.account?.code     || d.accountCode     || "",
                    tagAccountName:  d.tagAccount?.name  || d.tagAccountName  || "",
                    tagAccountCode:  d.tagAccount?.code  || d.tagAccountCode  || "",
                    debit:           Number(d.debit)  || 0,
                    credit:          Number(d.credit) || 0,
                })) || [],
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

// Get a single receipt voucher by ID
export async function getReceiptVoucher(id: string): Promise<{ status: boolean; data: ReceiptVoucher | null; message?: string }> {
    try {
        const response = await authFetch(`/finance/receipt-vouchers/${id}`, {
            cache: 'no-store',
            next: { revalidate: 0 },
        });

        if (!response.ok) {
            return { status: false, data: null, message: `Failed to fetch voucher: ${response.status}` };
        }

        const raw = response.data?.data ?? response.data;
        const voucher: ReceiptVoucher = {
            ...raw,
            debitAmount: raw.debitAmount !== undefined ? Number(raw.debitAmount) : 0,
            debitAccountName: raw.debitAccount?.name || raw.debitAccountName || "Unknown Account",
            debitAccountCode: raw.debitAccount?.code || raw.debitAccountCode || "",
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
        console.error("Error fetching receipt voucher:", error);
        return { status: false, data: null, message: error.message };
    }
}
