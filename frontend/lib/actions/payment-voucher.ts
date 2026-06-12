"use server";

import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface PaymentVoucherDetail {
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

export interface PaymentVoucher {
    id: string;
    type: "bank" | "cash";
    pvNo: string;
    pvDate: string; // ISO string from API
    refBillNo?: string;
    billDate?: string; // ISO string
    creditAccountId: string;
    creditAccountCode?: string;
    creditAccount?: any; // populated from backend
    creditAccountName?: string; // helper for UI
    creditAmount: number;
    status: "pending" | "approved" | "rejected";
    description: string;
    isTaxApplicable: boolean;
    isAdvance: boolean;
    chequeNo?: string;
    chequeDate?: string; // ISO string
    details: PaymentVoucherDetail[];
    createdAt: string;
    createdBy: string;
}

export async function getPaymentVouchers(type?: "bank" | "cash") {
    try {
        const queryParams = new URLSearchParams();
        if (type) {
            queryParams.append("type", type);
        }

        const response = await authFetch(`/finance/payment-vouchers?${queryParams.toString()}`, {
            cache: 'no-store',
            next: { revalidate: 0 }
        });

        if (!response.ok) {
            console.error("Failed to fetch payment vouchers", response.status);
            return {
                status: false,
                data: []
            };
        }

        const result = response.data;
        const vouchersArray = result.data || result;

        if (!Array.isArray(vouchersArray)) {
            console.error("Vouchers data is not an array:", result);
            return {
                status: false,
                data: []
            };
        }

        // Map backend data to frontend interface
        const mappedData = vouchersArray.map((pv: any) => ({
            ...pv,
            creditAmount: pv.creditAmount !== undefined ? Number(pv.creditAmount) : 0,
            creditAccountName: pv.creditAccount?.name || "Unknown Account",
            creditAccountCode: pv.creditAccount?.code || "",
            details: pv.details?.map((d: any) => ({
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
        console.error("Error fetching payment vouchers:", error);
        return {
            status: false,
            data: []
        };
    }
}

export async function createPaymentVoucher(data: any) {
    try {
        // Ensure dates are stringified if they aren't already
        const payload = {
            ...data,
            pvDate: new Date(data.pvDate).toISOString(),
            billDate: data.billDate ? new Date(data.billDate).toISOString() : undefined,
            chequeDate: data.chequeDate ? new Date(data.chequeDate).toISOString() : undefined,
        };

        const response = await authFetch("/finance/payment-vouchers", {
            method: "POST",
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorData = response.data || {};
            return {
                status: false,
                message: errorData.message || `Failed to create Payment Voucher: ${response.statusText || response.status}`
            };
        }

        revalidatePath("/finance/payment-voucher/list");
        revalidatePath("/erp/finance/payment-voucher/list");

        return { status: true, message: "Payment Voucher created successfully" };
    } catch (error: any) {
        console.error("Error creating payment voucher:", error);
        return { status: false, message: error.message || "An unexpected error occurred" };
    }
}

// Get suppliers with pending invoices
export async function getSuppliersWithPendingInvoices() {
    try {
        console.log('FRONTEND - Calling API: /finance/payment-vouchers/suppliers-with-pending-invoices');
        const response = await authFetch("/finance/payment-vouchers/suppliers-with-pending-invoices", {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            cache: 'no-store',
            next: { revalidate: 0 }
        });

        console.log('FRONTEND - API Response status:', response.status);
        console.log('FRONTEND - API Response headers:', response.headers);
        
        if (!response.ok) {
            const errorText = response.data?.message || 'Unknown error';
            console.error("FRONTEND - Failed to fetch suppliers with pending invoices", response.status, errorText);
            return {
                status: false,
                data: [],
                error: `HTTP ${response.status}: ${errorText}`
            };
        }

        const data = response.data;
        console.log('FRONTEND - Raw API Response data:', data);
        console.log('FRONTEND - Data type:', typeof data);
        console.log('FRONTEND - Data length:', Array.isArray(data) ? data.length : 'Not an array');
        
        return {
            status: true,
            data: data
        };
    } catch (error: any) {
        console.error("FRONTEND - Error fetching suppliers with pending invoices:", error);
        return {
            status: false,
            data: [],
            error: error.message
        };
    }
}

// Get all suppliers (fallback for testing)
export async function getAllSuppliers() {
    try {
        console.log('Calling API: /finance/suppliers');
        const response = await authFetch("/finance/suppliers", {
            cache: 'no-store',
            next: { revalidate: 0 }
        });

        console.log('All suppliers API Response status:', response.status);
        
        if (!response.ok) {
            const errorText = response.data?.message || 'Unknown error';
            console.error("Failed to fetch all suppliers", response.status, errorText);
            return {
                status: false,
                data: [],
                error: `HTTP ${response.status}: ${errorText}`
            };
        }

        const result = response.data;
        console.log('All suppliers API Response:', result);
        
        return {
            status: result.status || true,
            data: result.data || result || []
        };
    } catch (error: any) {
        console.error("Error fetching all suppliers:", error);
        return {
            status: false,
            data: [],
            error: error.message
        };
    }
}

// Get vendor with their linked chart of accounts
export async function getVendorWithAccounts(supplierId: string) {
    try {
        const response = await authFetch(`/finance/suppliers/${supplierId}`, {
            cache: 'no-store',
        });
        if (!response.ok) return { status: false, data: null };
        return { status: true, data: response.data?.data ?? response.data };
    } catch (error) {
        return { status: false, data: null };
    }
}

// Get pending invoices for a specific supplier
export async function getPendingInvoicesBySupplier(supplierId: string) {
    try {
        const response = await authFetch(`/finance/payment-vouchers/pending-invoices/${supplierId}`, {
            cache: 'no-store',
            next: { revalidate: 0 }
        });

        if (!response.ok) {
            console.error("Failed to fetch pending invoices", response.status);
            return { status: false, data: [] };
        }

        return { status: true, data: response.data };
    } catch (error) {
        console.error("Error fetching pending invoices:", error);
        return { status: false, data: [] };
    }
}

// Get unapplied advance payment vouchers for a supplier
export async function getAdvancesBySupplier(supplierId: string) {
    try {
        const response = await authFetch(`/finance/payment-vouchers/advances/${supplierId}`, {
            cache: 'no-store',
            next: { revalidate: 0 }
        });
        if (!response.ok) return { status: false, data: [] };
        return { status: true, data: response.data };
    } catch (error) {
        return { status: false, data: [] };
    }
}

// Get AP balance + advance balance summary for a supplier
export async function getSupplierSummary(supplierId: string) {
    try {
        const response = await authFetch(`/finance/payment-vouchers/supplier-summary/${supplierId}`, {
            cache: 'no-store',
        });
        if (!response.ok) return { status: false, data: null };
        return { status: true, data: response.data };
    } catch {
        return { status: false, data: null };
    }
}

// Get a single payment voucher by ID
export async function getPaymentVoucher(id: string): Promise<{ status: boolean; data: PaymentVoucher | null; message?: string }> {
    try {
        const response = await authFetch(`/finance/payment-vouchers/${id}`, {
            cache: 'no-store',
            next: { revalidate: 0 },
        });

        if (!response.ok) {
            return { status: false, data: null, message: `Failed to fetch voucher: ${response.status}` };
        }

        const raw = response.data?.data ?? response.data;
        const voucher: PaymentVoucher = {
            ...raw,
            creditAmount: raw.creditAmount !== undefined ? Number(raw.creditAmount) : 0,
            creditAccountName: raw.creditAccount?.name || raw.creditAccountName || "Unknown Account",
            creditAccountCode: raw.creditAccount?.code || raw.creditAccountCode || "",
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
        console.error("Error fetching payment voucher:", error);
        return { status: false, data: null, message: error.message };
    }
}

export async function updatePaymentVoucher(id: string, data: any) {
    try {
        const payload = {
            ...data,
            pvDate: new Date(data.pvDate).toISOString(),
            billDate: data.billDate ? new Date(data.billDate).toISOString() : undefined,
            chequeDate: data.chequeDate ? new Date(data.chequeDate).toISOString() : undefined,
        };

        const response = await authFetch(`/finance/payment-vouchers/${id}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorData = response.data || {};
            return {
                status: false,
                message: errorData.message || `Failed to update Payment Voucher: ${response.statusText || response.status}`
            };
        }

        revalidatePath("/finance/payment-voucher/list");
        revalidatePath(`/erp/finance/payment-voucher/${id}`);
        revalidatePath("/erp/finance/payment-voucher/list");

        return { status: true, message: "Payment Voucher updated successfully" };
    } catch (error: any) {
        console.error("Error updating payment voucher:", error);
        return { status: false, message: error.message || "An unexpected error occurred" };
    }
}

export async function updatePaymentVoucherStatus(id: string, status: "approved" | "rejected" | "pending", remarks?: string) {
    try {
        const response = await authFetch(`/finance/payment-vouchers/${id}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status, remarks }),
        });

        if (!response.ok) {
            const errorData = response.data || {};
            return {
                status: false,
                message: errorData.message || `Failed to update status: ${response.statusText || response.status}`
            };
        }

        revalidatePath("/finance/payment-voucher/list");
        revalidatePath(`/erp/finance/payment-voucher/${id}`);
        revalidatePath("/erp/finance/payment-voucher/list");

        return { status: true, message: `Payment Voucher ${status} successfully` };
    } catch (error: any) {
        console.error("Error updating payment voucher status:", error);
        return { status: false, message: error.message || "An unexpected error occurred" };
    }
}
