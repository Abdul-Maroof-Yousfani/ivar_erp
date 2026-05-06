'use server';

import { authFetch } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export type VoucherType = 'GIFT' | 'EXCHANGE' | 'CREDIT' | 'CORPORATE' | 'OUTLET_GIFT';

export interface Voucher {
    id: string;
    code: string;
    voucherType: VoucherType;
    faceValue: number;
    description?: string;
    customerId?: string;
    companyName?: string;
    requireCustomerMatch: boolean;
    issuedByLocationId?: string;
    sourceOrderId?: string;
    isActive: boolean;
    isRedeemed: boolean;
    expiresAt?: string;
    createdAt: string;
    locations: { id: string; location: { id: string; name: string; code: string } }[];
    redemptions?: { amountUsed: number; orderId: string }[];
}

export interface VoucherValidation {
    id: string;
    code: string;
    voucherType: VoucherType;
    faceValue: number;
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
    description?: string;
    customerId?: string;
    companyName?: string;
    requireCustomerMatch?: boolean;
    expiresAt?: string;
    locationIds?: string[];
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
