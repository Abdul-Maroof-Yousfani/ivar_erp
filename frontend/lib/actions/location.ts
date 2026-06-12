'use server';

import { authFetch } from '@/lib/auth';
import { revalidatePath } from "next/cache";

export interface Location {
    id: string;
    name: string;
    code: string;
    shortCode: string | null;
    address: string | null;
    cityId: string | null;
    companyId: string | null;
    geoFenceEnabled: boolean;
    geoFenceRadius: number;
    ipWhitelist: string | null;
    ipWhitelistEnabled: boolean;
    phone: string | null;
    latitude: number | string | null;
    longitude: number | string | null;
    fbrBposId: string | null;
    fbrBearerToken: string | null;
    fbrNtn: string | null;
    fbrSellerName: string | null;
    fbrEnabled: boolean;
    /// Whether this outlet is currently online.
    isOnline: boolean;
    /// Cash GL Account Code
    cashGLCode: string | null;
    /// Timestamp of the last known online time.
    lastOnlineAt: string | null;
    city?: {
        id: string;
        name: string;
        stateId: string;
        country?: { id: string; name: string };
    } | null;
    status: 'active' | 'inactive';
    pos?: {
        id: string;
        posId: string;
        name: string;
        status: string;
    }[];
    createdAt: string;
    updatedAt: string;
}

// Get all locations
export async function getLocations(): Promise<{ status: boolean; data?: Location[]; message?: string }> {
    try {
        const res = await authFetch(`/locations`, {});
        if (!res.ok) {
            const errorData = res.data;
            return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
        }
        return res.data;
    } catch (error) {
        console.error('Error fetching locations:', error);
        return {
            status: false,
            message: error instanceof Error ? error.message : 'Failed to fetch locations. Please check your connection.'
        };
    }
}

// Get location by id
export async function getLocationById(id: string): Promise<{ status: boolean; data?: Location; message?: string }> {
    try {
        const res = await authFetch(`/locations/${id}`, {});
        if (!res.ok) {
            const errorData = res.data;
            return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
        }
        return res.data;
    } catch (error) {
        console.error('Error fetching location:', error);
        return {
            status: false,
            message: error instanceof Error ? error.message : 'Failed to fetch location'
        };
    }
}

// Create locations bulk
export async function createLocations(items: { name: string; code: string; address?: string; cityId?: string; companyId?: string; shortCode?: string }[]): Promise<{ status: boolean; message: string; data?: Location[] }> {
    if (!items.length) {
        return { status: false, message: "At least one location is required" };
    }
    try {
        const res = await authFetch(`/locations/bulk`, {
            method: "POST",
            body: JSON.stringify({ items }),
        });
        const data = res.data;
        if (data.status) {
            revalidatePath("/master/location");
        }
        return data;
    } catch (error) {
        return { status: false, message: "Failed to create locations" };
    }
}

// Update locations bulk
export async function updateLocations(
    items: {
        id: string;
        name?: string;
        code?: string;
        address?: string;
        cityId?: string;
        companyId?: string;
        geoFenceEnabled?: boolean;
        geoFenceRadius?: number;
        ipWhitelist?: string;
        ipWhitelistEnabled?: boolean;
        cashGLCode?: string | null;
        shortCode?: string | null;
    }[]): Promise<{ status: boolean; message: string }> {
    if (!items.length) {
        return { status: false, message: "No items to update" };
    }
    try {
        const res = await authFetch(`/locations/bulk`, {
            method: "PUT",
            body: JSON.stringify({ items }),
        });
        const data = res.data;
        if (data.status) {
            revalidatePath("/master/location");
        }
        return data;
    } catch (error) {
        return { status: false, message: "Failed to update locations" };
    }
}

// Update location other details (IP, Coordinates, FBR credentials, etc.)
export async function updateLocationOtherInfo(
    id: string,
    data: {
        phone?: string;
        latitude?: number;
        longitude?: number;
        geoFenceEnabled?: boolean;
        geoFenceRadius?: number;
        ipWhitelist?: string;
        ipWhitelistEnabled?: boolean;
        fbrBposId?: string;
        fbrBearerToken?: string;
        fbrNtn?: string;
        fbrSellerName?: string;
        fbrEnabled?: boolean;
    }
): Promise<{ status: boolean; message: string; data?: Location }> {
    try {
        const res = await authFetch(`/locations/${id}/other-info`, {
            method: "PUT",
            body: JSON.stringify(data),
        });
        const resData = res.data;
        if (resData.status) {
            revalidatePath("/master/location");
        }
        return resData;
    } catch (error) {
        console.error('Error updating location other info:', error);
        return { status: false, message: "Failed to update location details" };
    }
}

// Delete locations bulk
export async function deleteLocations(ids: string[]): Promise<{ status: boolean; message: string }> {
    if (!ids.length) {
        return { status: false, message: "No items to delete" };
    }
    try {
        const res = await authFetch(`/locations/bulk`, {
            method: "DELETE",
            body: JSON.stringify({ ids }),
        });
        const data = res.data;
        if (data.status) {
            revalidatePath("/master/location");
        }
        return data;
    } catch (error) {
        return { status: false, message: "Failed to delete locations" };
    }
}

// Legacy single actions for compatibility if needed
export async function deleteLocation(id: string): Promise<{ status: boolean; message?: string }> {
    try {
        const res = await authFetch(`/locations/${id}`, {
            method: 'DELETE',
        });
        const data = res.data;
        if (data.status) revalidatePath("/master/location");
        return data;
    } catch (error) {
        return { status: false, message: 'Failed to delete location' };
    }
}

/// Toggle the online/offline status for an outlet.
export async function updateLocationOnlineStatus(
    id: string,
    isOnline: boolean,
): Promise<{ status: boolean; message?: string; data?: Location }> {
    try {
        const res = await authFetch(`/locations/${id}/online-status`, {
            method: 'PATCH',
            body: JSON.stringify({ isOnline }),
        });
        const data = res.data;
        if (data.status) {
            revalidatePath('/master/location');
        }
        return data;
    } catch (error) {
        return { status: false, message: 'Failed to update online status' };
    }
}