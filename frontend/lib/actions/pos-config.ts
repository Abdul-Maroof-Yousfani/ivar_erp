'use server';

import { authFetch } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

// ══════════════════════════════════════════════════════════════
//  Types
// ══════════════════════════════════════════════════════════════

export interface PromoCampaign {
    id: string;
    name: string;
    code: string;
    type: string;
    value: number;
    minOrderAmount?: number;
    maxDiscount?: number;
    startDate: string;
    endDate: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    locations: { id: string; location: { id: string; name: string; code: string } }[];
}

export interface CouponCode {
    id: string;
    code: string;
    description?: string;
    discountType: string;
    discountValue: number;
    maxUses?: number;
    usedCount: number;
    minOrderAmount?: number;
    maxDiscount?: number;
    expiresAt?: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    locations: { id: string; location: { id: string; name: string; code: string } }[];
}

export interface AllianceDiscount {
    id: string;
    partnerName: string;
    code: string;
    discountPercent: number;
    maxDiscount?: number;
    description?: string;
    startDate?: string;
    endDate?: string;
    /** BIN prefixes (4–8 digits) that qualify for this alliance */
    binNumbers: string[];
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    locations: { id: string; location: { id: string; name: string; code: string } }[];
}

// ══════════════════════════════════════════════════════════════
//  Promo Campaigns
// ══════════════════════════════════════════════════════════════

export async function getPromos(): Promise<{ status: boolean; data?: PromoCampaign[]; message?: string }> {
    try {
        const res = await authFetch(`/pos-config/promos`, {});
        return res.data;
    } catch {
        return { status: false, message: 'Failed to fetch promo campaigns' };
    }
}

export async function getPromoById(id: string): Promise<{ status: boolean; data?: PromoCampaign; message?: string }> {
    try {
        const res = await authFetch(`/pos-config/promos/${id}`, {});
        return res.data;
    } catch {
        return { status: false, message: 'Failed to fetch promo campaign' };
    }
}

export async function createPromo(data: {
    name: string;
    code: string;
    type: string;
    value: number;
    minOrderAmount?: number;
    maxDiscount?: number;
    startDate: string;
    endDate: string;
    isActive?: boolean;
    locationIds: string[];
}): Promise<{ status: boolean; message: string; data?: PromoCampaign }> {
    try {
        const res = await authFetch(`/pos-config/promos`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
        const result = res.data;
        if (result.status) revalidatePath('/master/pos-config');
        return result;
    } catch {
        return { status: false, message: 'Failed to create promo campaign' };
    }
}

export async function updatePromo(id: string, data: any): Promise<{ status: boolean; message: string }> {
    try {
        const res = await authFetch(`/pos-config/promos/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
        const result = res.data;
        if (result.status) revalidatePath('/master/pos-config');
        return result;
    } catch {
        return { status: false, message: 'Failed to update promo campaign' };
    }
}

/** Soft-deactivate — sets isActive = false. No hard delete allowed. */
export async function deactivatePromo(id: string): Promise<{ status: boolean; message: string }> {
    try {
        const res = await authFetch(`/pos-config/promos/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ isActive: false }),
        });
        const result = res.data;
        if (result.status) revalidatePath('/master/pos-config');
        return result;
    } catch {
        return { status: false, message: 'Failed to deactivate promo campaign' };
    }
}

// ══════════════════════════════════════════════════════════════
//  Coupon Codes
// ══════════════════════════════════════════════════════════════

export async function getCoupons(): Promise<{ status: boolean; data?: CouponCode[]; message?: string }> {
    try {
        const res = await authFetch(`/pos-config/coupons`, {});
        return res.data;
    } catch {
        return { status: false, message: 'Failed to fetch coupon codes' };
    }
}

export async function getCouponById(id: string): Promise<{ status: boolean; data?: CouponCode; message?: string }> {
    try {
        const res = await authFetch(`/pos-config/coupons/${id}`, {});
        return res.data;
    } catch {
        return { status: false, message: 'Failed to fetch coupon code' };
    }
}

export async function createCoupon(data: {
    code: string;
    description?: string;
    discountType: string;
    discountValue: number;
    maxUses?: number;
    minOrderAmount?: number;
    maxDiscount?: number;
    expiresAt?: string;
    isActive?: boolean;
    locationIds: string[];
}): Promise<{ status: boolean; message: string; data?: CouponCode }> {
    try {
        const res = await authFetch(`/pos-config/coupons`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
        const result = res.data;
        if (result.status) revalidatePath('/master/pos-config');
        return result;
    } catch {
        return { status: false, message: 'Failed to create coupon code' };
    }
}

export async function updateCoupon(id: string, data: any): Promise<{ status: boolean; message: string }> {
    try {
        const res = await authFetch(`/pos-config/coupons/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
        const result = res.data;
        if (result.status) revalidatePath('/master/pos-config');
        return result;
    } catch {
        return { status: false, message: 'Failed to update coupon code' };
    }
}

/** Soft-deactivate — sets isActive = false. No hard delete allowed. */
export async function deactivateCoupon(id: string): Promise<{ status: boolean; message: string }> {
    try {
        const res = await authFetch(`/pos-config/coupons/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ isActive: false }),
        });
        const result = res.data;
        if (result.status) revalidatePath('/master/pos-config');
        return result;
    } catch {
        return { status: false, message: 'Failed to deactivate coupon code' };
    }
}

// ══════════════════════════════════════════════════════════════
//  Alliance Discounts
// ══════════════════════════════════════════════════════════════

export async function getAlliances(): Promise<{ status: boolean; data?: AllianceDiscount[]; message?: string }> {
    try {
        const res = await authFetch(`/pos-config/alliances`, {});
        return res.data;
    } catch {
        return { status: false, message: 'Failed to fetch alliance discounts' };
    }
}

export async function getAllianceById(id: string): Promise<{ status: boolean; data?: AllianceDiscount; message?: string }> {
    try {
        const res = await authFetch(`/pos-config/alliances/${id}`, {});
        return res.data;
    } catch {
        return { status: false, message: 'Failed to fetch alliance discount' };
    }
}

export async function createAlliance(data: {
    partnerName: string;
    code: string;
    discountPercent: number;
    maxDiscount?: number;
    description?: string;
    startDate?: string;
    endDate?: string;
    isActive?: boolean;
    locationIds: string[];
    binNumbers?: string[];
}): Promise<{ status: boolean; message: string; data?: AllianceDiscount }> {
    try {
        const res = await authFetch(`/pos-config/alliances`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
        const result = res.data;
        if (result.status) revalidatePath('/master/pos-config');
        return result;
    } catch {
        return { status: false, message: 'Failed to create alliance discount' };
    }
}

export async function updateAlliance(id: string, data: any): Promise<{ status: boolean; message: string }> {
    try {
        const res = await authFetch(`/pos-config/alliances/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
        const result = res.data;
        if (result.status) revalidatePath('/master/pos-config');
        return result;
    } catch {
        return { status: false, message: 'Failed to update alliance discount' };
    }
}

/** Soft-deactivate — sets isActive = false. No hard delete allowed. */
export async function deactivateAlliance(id: string): Promise<{ status: boolean; message: string }> {
    try {
        const res = await authFetch(`/pos-config/alliances/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ isActive: false }),
        });
        const result = res.data;
        if (result.status) revalidatePath('/master/pos-config');
        return result;
    } catch {
        return { status: false, message: 'Failed to deactivate alliance discount' };
    }
}

// ══════════════════════════════════════════════════════════════
//  Merchants Exporter
// ══════════════════════════════════════════════════════════════

export async function queueMerchantsExport(filters: {
    search?: string;
    locationId?: string;
    bankName?: string;
    isActive?: boolean;
}): Promise<{ status: boolean; message: string; data?: { jobId: string } }> {
    try {
        const queryParams = new URLSearchParams();
        if (filters.search) queryParams.append('search', filters.search);
        if (filters.locationId) queryParams.append('locationId', filters.locationId);
        if (filters.bankName) queryParams.append('bankName', filters.bankName);
        if (filters.isActive !== undefined) queryParams.append('isActive', String(filters.isActive));

        const res = await authFetch(`/pos-config/merchants/export?${queryParams.toString()}`, {
            method: 'POST',
        });
        return res.data;
    } catch {
        return { status: false, message: 'Failed to queue merchant background export' };
    }
}

