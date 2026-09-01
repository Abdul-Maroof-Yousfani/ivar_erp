'use server';

import { authFetch } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export type VoucherType = 'GIFT' | 'EXCHANGE' | 'CREDIT' | 'CORPORATE' | 'OUTLET_GIFT' | 'REFUND';

export interface Voucher {
    id: string;
    code: string;
    voucherType: VoucherType;
    faceValue: number;
    discount?: number;
    description?: string;
    customerId?: string;
    companyName?: string;
    companyGlCode?: string;
    requireCustomerMatch: boolean;
    issuedByLocationId?: string;
    sourceOrderId?: string;
    isActive: boolean;
    isRedeemed: boolean;
    isDeleted?: boolean;
    expiresAt?: string;
    createdAt: string;
    locations: { id: string; location: { id: string; name: string; code: string } }[];
    redemptions?: { amountUsed: number; orderId: string }[];
    paymentMode?: string;
    cardholderName?: string;
    cardLast4?: string;
    slipNo?: string;
    merchantId?: string;
}

export interface MerchantConfig {
    id: string;
    description: string;
    bankName: string;
    merchantCode: number;
    commissionRate: number | string;
    tagId: string;
    costCentreTag: string;
    bankGlCode: string;
}

export async function getMerchants(filters?: { locationId?: string }): Promise<{ status: boolean; data?: MerchantConfig[]; message?: string }> {
    try {
        const params = new URLSearchParams();
        if (filters?.locationId) params.set('locationId', filters.locationId);
        const res = await authFetch(`/pos-config/merchants?${params.toString()}`, {});
        return res.data;
    } catch {
        return { status: false, message: 'Failed to fetch merchants' };
    }
}

export interface VoucherValidation {
    id: string;
    code: string;
    voucherType: VoucherType;
    faceValue: number;
    discount?: number;
    description?: string;
    customerId?: string;
    requireCustomerMatch: boolean;
    expiresAt?: string;
}

export async function getVouchers(filters?: {
    voucherType?: string;
    locationId?: string;
    search?: string;
}): Promise<{ status: boolean; data?: Voucher[]; message?: string }> {
    try {
        const params = new URLSearchParams();
        if (filters?.voucherType) params.set('voucherType', filters.voucherType);
        if (filters?.locationId) params.set('locationId', filters.locationId);
        if (filters?.search) params.set('search', filters.search);
        const res = await authFetch(`/pos-config/vouchers?${params.toString()}`, {});
        return res.data;
    } catch {
        return { status: false, message: 'Failed to fetch vouchers' };
    }
}

export async function issueVoucher(data: {
    voucherType: VoucherType;
    faceValue: number;
    discount?: number;
    description?: string;
    customerId?: string;
    companyName?: string;
    companyGlCode?: string;
    requireCustomerMatch?: boolean;
    expiresAt?: string;
    locationIds?: string[];
    paymentMode?: string;
    cardholderName?: string;
    cardLast4?: string;
    slipNo?: string;
    merchantId?: string;
}): Promise<{ status: boolean; data?: Voucher; message?: string }> {
    try {
        const res = await authFetch('/pos-config/vouchers', {
            method: 'POST',
            body: JSON.stringify(data),
        });
        const result = res.data;
        if (result.status) {
            revalidatePath('/pos/vouchers');
            revalidatePath('/master/pos-config');
        }
        return result;
    } catch {
        return { status: false, message: 'Failed to issue voucher' };
    }
}

export async function voidVoucher(
    id: string,
    reason?: string,
): Promise<{ status: boolean; message?: string }> {
    try {
        const res = await authFetch(`/pos-config/vouchers/${id}/void`, {
            method: 'PUT',
            body: JSON.stringify({ reason }),
        });
        const result = res.data;
        if (result.status) {
            revalidatePath('/pos/vouchers');
            revalidatePath('/master/pos-config');
        }
        return result;
    } catch {
        return { status: false, message: 'Failed to void voucher' };
    }
}

export async function updateVoucherExpiry(
    id: string,
    expiresAt: string | null,
): Promise<{ status: boolean; message?: string }> {
    try {
        const res = await authFetch(`/pos-config/vouchers/${id}/expiry`, {
            method: 'PUT',
            body: JSON.stringify({ expiresAt }),
        });
        const result = res.data;
        if (result.status) {
            revalidatePath('/pos/vouchers');
            revalidatePath('/master/pos-config');
        }
        return result;
    } catch {
        return { status: false, message: 'Failed to update voucher expiry' };
    }
}

