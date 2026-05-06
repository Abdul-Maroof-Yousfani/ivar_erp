"use server"
import { authFetch } from '@/lib/auth';
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { getCookieDomain } from "@/lib/utils";

export interface Pos {
    id: string;
    posId: string;
    name: string;
    locationId: string;
    companyId: string | null;
    status: 'active' | 'inactive';
    terminalPin?: string;
    terminalCode: string;
    createdAt: string;
    updatedAt: string;
}

// Get POS by location
export async function getPosByLocation(locationId: string): Promise<{ status: boolean; data?: Pos[]; message?: string }> {
    try {
        const res = await authFetch(`/pos/location/${locationId}`, {});
        if (!res.ok) {
            const errorData = res.data || { message: 'Failed to fetch POS terminals' };
            return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
        }
        return res.data;
    } catch (error) {
        console.error('Error fetching POS terminals:', error);
        return {
            status: false,
            message: 'Failed to fetch POS terminals'
        };
    }
}

// Create POS
export async function createPos(data: {
    name: string;
    locationId: string;
    companyId?: string;
    terminalPin?: string;
    status?: string;
    terminalCode?: string;
}): Promise<{ status: boolean; message: string; data?: Pos }> {
    try {
        const res = await authFetch(`/pos`, {
            method: "POST",
            body: JSON.stringify(data),
        });
        const result = res.data;
        if (result.status) {
            revalidatePath(`/master/location/pos/${data.locationId}`);
        }
        return result;
    } catch (error) {
        return { status: false, message: "Failed to create POS" };
    }
}

// Update POS
export async function updatePos(
    id: string,
    data: {
        name?: string;
        companyId?: string;
        terminalPin?: string;
        status?: string,
    }): Promise<{ status: boolean; message: string }> {
    try {
        const res = await authFetch(`/pos/${id}`, {
            method: "PUT",
            body: JSON.stringify(data),
        });
        const result = res.data;
        if (result.status) {
            revalidatePath("/master/location/list");
        }
        return result;
    } catch (error) {
        return { status: false, message: "Failed to update POS" };
    }
}

// Delete POS
export async function deletePos(id: string, locationId: string): Promise<{ status: boolean; message: string }> {
    try {
        const res = await authFetch(`/pos/${id}`, {
            method: "DELETE",
        });
        const result = res.data;
        if (result.status) {
            revalidatePath(`/master/location/pos/${locationId}`);
        }
        return result;
    } catch (error) {
        return { status: false, message: "Failed to delete POS" };
    }
}

// ----------------------------------------------------------------------
// Cookie Based Terminal Memory
// ----------------------------------------------------------------------

export async function setPosTerminalAction(terminalInfo: any) {
    const cookieStore = await cookies();
    cookieStore.set("pos_remembered_terminal", JSON.stringify(terminalInfo), {
        path: "/",
        domain: process.env.COOKIE_DOMAIN || undefined,
        maxAge: 30 * 24 * 60 * 60, // 30 days
    });
}

export async function getPosTerminalAction() {
    const cookieStore = await cookies();
    const val = cookieStore.get("pos_remembered_terminal")?.value;
    if (!val) return null;
    try {
        return JSON.parse(val);
    } catch (e) {
        return null;
    }
}

export async function clearPosTerminalAction() {
    const cookieStore = await cookies();
    cookieStore.set("pos_remembered_terminal", "", {
        maxAge: 0,
        path: "/",
        domain: process.env.COOKIE_DOMAIN || undefined
    });
}
