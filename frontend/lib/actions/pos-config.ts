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
    } catch (error) {
        return { status: false, message: 'Failed to fetch promo campaigns' };
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
    } catch (error) {
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
    } catch (error) {
        return { status: false, message: 'Failed to update promo campaign' };
    }
}

export async function deletePromo(id: string): Promise<{ status: boolean; message: string }> {
    try {
        const res = await authFetch(`/pos-config/promos/${id}`, { method: 'DELETE' });
        const result = res.data;
        if (result.status) revalidatePath('/master/pos-config');
        return result;
    } catch (error) {
        return { status: false, message: 'Failed to delete promo campaign' };
    }
}

// ══════════════════════════════════════════════════════════════
//  Coupon Codes
// ══════════════════════════════════════════════════════════════

export async function getCoupons(): Promise<{ status: boolean; data?: CouponCode[]; message?: string }> {
    try {
        const res = await authFetch(`/pos-config/coupons`, {});
        return res.data;
    } catch (error) {
        return { status: false, message: 'Failed to fetch coupon codes' };
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
    } catch (error) {
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
    } catch (error) {
        return { status: false, message: 'Failed to update coupon code' };
    }
}

export async function deleteCoupon(id: string): Promise<{ status: boolean; message: string }> {
    try {
        const res = await authFetch(`/pos-config/coupons/${id}`, { method: 'DELETE' });
        const result = res.data;
        if (result.status) revalidatePath('/master/pos-config');
        return result;
    } catch (error) {
        return { status: false, message: 'Failed to delete coupon code' };
    }
}

// ══════════════════════════════════════════════════════════════
//  Alliance Discounts
// ══════════════════════════════════════════════════════════════

export async function getAlliances(): Promise<{ status: boolean; data?: AllianceDiscount[]; message?: string }> {
    try {
        const res = await authFetch(`/pos-config/alliances`, {});
        return res.data;
    } catch (error) {
        return { status: false, message: 'Failed to fetch alliance discounts' };
    }
}

export async function createAlliance(data: {
    partnerName: string;
    code: string;
    discountPercent: number;
    maxDiscount?: number;
    description?: string;
    isActive?: boolean;
    locationIds: string[];
}): Promise<{ status: boolean; message: string; data?: AllianceDiscount }> {
    try {
        const res = await authFetch(`/pos-config/alliances`, {
            method: 'POST',
            body: JSON.stringify(data),
        });
        const result = res.data;
        if (result.status) revalidatePath('/master/pos-config');
        return result;
    } catch (error) {
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
    } catch (error) {
        return { status: false, message: 'Failed to update alliance discount' };
    }
}

export async function deleteAlliance(id: string): Promise<{ status: boolean; message: string }> {
    try {
        const res = await authFetch(`/pos-config/alliances/${id}`, { method: 'DELETE' });
        const result = res.data;
        if (result.status) revalidatePath('/master/pos-config');
        return result;
    } catch (error) {
        return { status: false, message: 'Failed to delete alliance discount' };
    }
}
