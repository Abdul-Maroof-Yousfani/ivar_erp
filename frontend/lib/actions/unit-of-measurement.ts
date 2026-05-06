"use server";

import { revalidatePath } from "next/cache";
import { authFetch } from "@/lib/auth";

export interface UnitOfMeasurement {
    id: string;
    name: string;
    abbreviation: string;
    status: string;
    createdById?: string;
    createdBy?: string;
    createdAt: string;
    updatedAt: string;
}

export async function getUnitsOfMeasurement(): Promise<{ status: boolean; data: UnitOfMeasurement[]; message?: string }> {
    try {
        const res = await authFetch("/units-of-measurement", {
            cache: "no-store",
        });
        return res.data;
    } catch (error) {
        console.error("Failed to fetch units of measurement:", error);
        return { status: false, data: [], message: "Failed to fetch units of measurement" };
    }
}

export async function getUnitOfMeasurementById(id: string): Promise<{ status: boolean; data: UnitOfMeasurement | null }> {
    try {
        const res = await authFetch(`/units-of-measurement/${id}`, {
            cache: "no-store",
        });
        return res.data;
    } catch (error) {
        console.error("Failed to fetch unit of measurement:", error);
        return { status: false, data: null };
    }
}

export async function createUnitsOfMeasurement(items: { name: string; abbreviation: string; status?: string }[]): Promise<{ status: boolean; message: string; data?: UnitOfMeasurement[] }> {
    if (!items.length) {
        return { status: false, message: "At least one unit of measurement is required" };
    }

    try {
        const res = await authFetch("/units-of-measurement", {
            method: "POST",
            body: JSON.stringify({ items }),
        });
        const data = res.data;

        if (data.status) {
            revalidatePath("/master/unit-of-measurement");
        }

        return data;
    } catch (error) {
        return { status: false, message: "Failed to create units of measurement" };
    }
}

export async function updateUnitOfMeasurement(id: string, formData: FormData): Promise<{ status: boolean; message: string; data?: UnitOfMeasurement }> {
    const name = formData.get("name") as string;
    const abbreviation = formData.get("abbreviation") as string;
    const status = formData.get("status") as string;

    if (!name?.trim()) {
        return { status: false, message: "Name is required" };
    }

    if (!abbreviation?.trim()) {
        return { status: false, message: "Abbreviation is required" };
    }

    try {
        const res = await authFetch(`/units-of-measurement/${id}`, {
            method: "PUT",
            body: JSON.stringify({ name, abbreviation, status }),
        });
        const data = res.data;

        if (data.status) {
            revalidatePath("/master/unit-of-measurement");
        }

        return data;
    } catch (error) {
        return { status: false, message: "Failed to update unit of measurement" };
    }
}

export async function updateUnitsOfMeasurement(items: { id: string; name: string; abbreviation: string; status?: string }[]): Promise<{ status: boolean; message: string }> {
    if (!items.length) {
        return { status: false, message: "No items to update" };
    }

    try {
        const res = await authFetch("/units-of-measurement/bulk", {
            method: "PUT",
            body: JSON.stringify({ items }),
        });
        const data = res.data;

        if (data.status) {
            revalidatePath("/master/unit-of-measurement");
        }

        return data;
    } catch (error) {
        return { status: false, message: "Failed to update units of measurement" };
    }
}

export async function deleteUnitOfMeasurement(id: string): Promise<{ status: boolean; message: string }> {
    try {
        const res = await authFetch(`/units-of-measurement/${id}`, {
            method: "DELETE",
        });
        const data = res.data;

        if (data.status) {
            revalidatePath("/master/unit-of-measurement");
        }

        return data;
    } catch (error) {
        return { status: false, message: "Failed to delete unit of measurement" };
    }
}

export async function deleteUnitsOfMeasurement(ids: string[]): Promise<{ status: boolean; message: string }> {
    if (!ids.length) {
        return { status: false, message: "No items to delete" };
    }

    try {
        const res = await authFetch("/units-of-measurement/bulk", {
            method: "DELETE",
            body: JSON.stringify({ ids }),
        });
        const data = res.data;

        if (data.status) {
            revalidatePath("/master/unit-of-measurement");
        }

        return data;
    } catch (error) {
        return { status: false, message: "Failed to delete units of measurement" };
    }
}
