'use server';

import { authFetch } from '@/lib/auth';
import { revalidatePath } from "next/cache";

export interface Location {
    id: string;
    name: string;
    code: string;
    address: string | null;
    cityId: string | null;
    companyId: string | null;
    geoFenceEnabled: boolean;
    geoFenceRadius: number;
    ipWhitelist: string | null;
    ipWhitelistEnabled: boolean;
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
export async function createLocations(items: { name: string; code: string; address?: string; cityId?: string; companyId?: string }[]): Promise<{ status: boolean; message: string; data?: Location[] }> {
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