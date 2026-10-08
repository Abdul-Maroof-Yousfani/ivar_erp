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
    refBillNo2?: string;
    taxType?: string;
}

export interface ReceiptVoucher {
    id: string;
    type: "bank" | "cash";
    rvNo: string;
    rvDate: string;
    refBillNo?: string;
    refBillNo2?: string;
    billDate?: string;
    debitAccountId: string;
    debitAccountName?: string;
    debitAccountCode?: string;
    debitAmount: number;
    customerId?: string;
    status: "draft" | "pending_check" | "pending_approval" | "approved" | "rejected";
    makerId?: string;
    checkerId?: string;
    authorizerId?: string;
    checkedAt?: string;
    approvedAt?: string;
    rejectionReason?: string;
    remarks?: string;
    description?: string;
    taxType?: string;
    isAdvance?: boolean;
    chequeNo?: string;
    chequeDate?: string;
    details: ReceiptVoucherDetail[];
    invoices?: { salesInvoiceId: string; receivedAmount: number }[];
    folio?: string | null;
    lastPrintedAt?: string | null;
    createdAt: string;
    createdBy: string;
}

export interface ReceiptVoucherFilters {
    type?: string;
    status?: string;
    fromDate?: string;
    toDate?: string;
    accountId?: string;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: string;
}

export async function getReceiptVouchers(filters?: ReceiptVoucherFilters) {
    try {
        const queryParams = new URLSearchParams();
        if (filters?.type && filters.type !== "all") queryParams.append("type", filters.type);
        if (filters?.status && filters.status !== "all") queryParams.append("status", filters.status);
        if (filters?.fromDate) queryParams.append("fromDate", filters.fromDate);
        if (filters?.toDate) queryParams.append("toDate", filters.toDate);
        if (filters?.accountId && filters.accountId !== "all") queryParams.append("accountId", filters.accountId);
        if (filters?.search?.trim()) queryParams.append("search", filters.search.trim());
        if (filters?.page) queryParams.append("page", String(filters.page));
        if (filters?.limit) queryParams.append("limit", String(filters.limit));
        if (filters?.sortBy) queryParams.append("sortBy", filters.sortBy);
        if (filters?.sortOrder) queryParams.append("sortOrder", filters.sortOrder);

        const response = await authFetch(`/finance/receipt-vouchers?${queryParams.toString()}`, { cache: 'no-store' });
        if (!response.ok) return { status: false, data: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 1 } };
        const data = response.data;
        const vouchersArray = Array.isArray(data) ? data : (data?.data || []);
        const pagination = data.pagination || {
            total: vouchersArray.length,
            page: filters?.page || 1,
            limit: filters?.limit || 10,
            totalPages: Math.ceil(vouchersArray.length / (filters?.limit || 10)) || 1,
        };
        
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
            pagination,
        };
    } catch {
        return { status: false, data: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 1 } };
    }
}

export async function getRsrvVouchers(filters?: ReceiptVoucherFilters) {
    return getReceiptVouchers({ ...filters, type: "rs_rv" });
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

export async function updateReceiptVoucher(id: string, data: any) {
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

        const response = await authFetch(`/finance/receipt-vouchers/${id}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const err = response.data || {};
            return { status: false, message: err.message || `Failed to update Receipt Voucher: ${response.status}` };
        }

        revalidatePath("/erp/finance/receipt-voucher/list");
        revalidatePath(`/erp/finance/receipt-voucher/${id}`);
        return { status: true, message: "Receipt Voucher updated successfully" };
    } catch (e: any) {
        return { status: false, message: e.message || "An unexpected error occurred" };
    }
}

export async function updateReceiptVoucherStatus(id: string, status: "draft" | "pending_check" | "pending_approval" | "approved" | "rejected", remarks?: string) {
    try {
        const response = await authFetch(`/finance/receipt-vouchers/${id}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status, remarks }),
        });

        if (!response.ok) {
            const err = response.data || {};
            return { status: false, message: err.message || `Failed to update status: ${response.status}` };
        }

        revalidatePath("/erp/finance/receipt-voucher/list");
        revalidatePath("/erp/finance/retail-sale-receipt-voucher/list");
        revalidatePath(`/erp/finance/receipt-voucher/${id}`);
        return { status: true, message: `Receipt Voucher ${status} successfully` };
    } catch (e: any) {
        return { status: false, message: e.message || "An unexpected error occurred" };
    }
}

export async function unapproveReceiptVoucher(id: string, remarks?: string) {
    try {
        const response = await authFetch(`/finance/receipt-vouchers/${id}/unapprove`, {
            method: "PATCH",
            body: JSON.stringify({ remarks }),
        });

        if (!response.ok) {
            const err = response.data || {};
            return { status: false, message: err.message || `Failed to unapprove voucher: ${response.status}` };
        }

        revalidatePath("/erp/finance/receipt-voucher/list");
        revalidatePath("/erp/finance/retail-sale-receipt-voucher/list");
        revalidatePath(`/erp/finance/receipt-voucher/${id}`);
        return { status: true, message: "Receipt Voucher unapproved successfully" };
    } catch (e: any) {
        return { status: false, message: e.message || "An unexpected error occurred" };
    }
}

export async function bulkUpdateReceiptVoucherStatus(
    ids: string[],
    status: "draft" | "pending_check" | "pending_approval" | "approved" | "rejected",
    remarks?: string
) {
    try {
        let successCount = 0;
        let failCount = 0;

        for (const id of ids) {
            const res = await updateReceiptVoucherStatus(id, status, remarks);
            if (res.status) {
                successCount++;
            } else {
                failCount++;
            }
        }

        revalidatePath("/erp/finance/receipt-voucher/list");
        revalidatePath("/erp/finance/retail-sale-receipt-voucher/list");

        return {
            status: true,
            message: `Bulk operation finished: ${successCount} updated successfully${failCount > 0 ? `, ${failCount} failed` : ''}.`,
            successCount,
            failCount,
        };
    } catch (e: any) {
        return { status: false, message: e.message || "An unexpected error occurred" };
    }
}

// ── Background export ─────────────────────────────────────────────────────────
export async function queueReceiptVouchersExport(opts?: {
    type?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    accountId?: string;
    search?: string;
    ids?: string[];
}): Promise<{ status: boolean; jobId?: string; message?: string }> {
    try {
        const params = new URLSearchParams();
        if (opts?.type      && opts.type      !== 'all') params.set('type',      opts.type);
        if (opts?.status    && opts.status    !== 'all') params.set('status',    opts.status);
        if (opts?.dateFrom)                              params.set('dateFrom',  opts.dateFrom);
        if (opts?.dateTo)                                params.set('dateTo',    opts.dateTo);
        if (opts?.accountId && opts.accountId !== 'all') params.set('accountId', opts.accountId);
        if (opts?.search    && opts.search.trim())       params.set('search',    opts.search.trim());
        if (opts?.ids       && opts.ids.length > 0)      params.set('ids',       opts.ids.join(','));

        const response = await authFetch(
            `/finance/receipt-vouchers/export?${params.toString()}`,
            { method: 'POST' },
        );

        if (!response.ok) {
            const err = response.data || {};
            return { status: false, message: err.message || 'Failed to queue export' };
        }

        const result = response.data;
        return { status: true, jobId: result?.data?.jobId };
    } catch (error: any) {
        return { status: false, message: error.message || 'An unexpected error occurred' };
    }
}

export async function markReceiptVoucherAsPrinted(id: string) {
    try {
        const response = await authFetch(`/finance/receipt-vouchers/${id}/print`, {
            method: "PATCH",
        });
        if (!response.ok) {
            return { status: false, message: "Failed to mark receipt voucher as printed" };
        }
        revalidatePath("/erp/finance/receipt-voucher");
        return { status: true, data: response.data };
    } catch {
        return { status: false, message: "Network error occurred" };
    }
}

