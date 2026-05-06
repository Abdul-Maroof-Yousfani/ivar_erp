"use server";

import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

function sanitizeItemData(data: any) {
    const sanitized = { ...data };
    // List of keys that are optional UUIDs or might be empty strings should be removed or set to undefined
    const keysToCheck = [
        "brandId",
        "divisionId",
        "categoryId",
        "subCategoryId",
        "itemClassId",
        "itemSubclassId",
        "channelClassId",
        "genderId",
        "seasonId",
        "segmentId",
        "sizeId",
        "colorId",
        "silhouetteId",
    ];

    for (const key of keysToCheck) {
        if (sanitized[key] === "" || sanitized[key] === "undefined" || sanitized[key] === null) {
            sanitized[key] = undefined;
        }
    }

    // Also sanitizing other string fields if they are empty
    if (sanitized.barCode === "") sanitized.barCode = undefined;
    if (sanitized.hsCode === "") sanitized.hsCode = undefined;
    if (sanitized.description === "") sanitized.description = undefined;
    if (sanitized.imageUrl === "") sanitized.imageUrl = undefined;
    if (sanitized.case === "") sanitized.case = undefined;
    if (sanitized.band === "") sanitized.band = undefined;
    if (sanitized.movementType === "") sanitized.movementType = undefined;
    if (sanitized.heelHeight === "") sanitized.heelHeight = undefined;
    if (sanitized.width === "") sanitized.width = undefined;

    return sanitized;
}

export async function createItem(data: any) {
    try {
        const sanitizedData = sanitizeItemData(data);
        const response = await authFetch("/finance/items", {
            method: "POST",
            body: JSON.stringify(sanitizedData),
        });

        const result = response.data;
        if (result.status) {
            revalidatePath("/erp/items/list");
        }
        return result;
    } catch (error) {
        console.error("Create item error:", error);
        return { status: false, message: "Failed to connect to server" };
    }
}

export async function getItems(
    page: number = 1,
    limit: number = 50,
    search?: string,
    sortBy?: string,
    sortOrder?: "asc" | "desc",
    filters?: {
        brandIds?: string[];
        categoryIds?: string[];
        silhouetteIds?: string[];
        genderIds?: string[];
    },
) {
    try {
        const queryParams = new URLSearchParams();
        queryParams.append("page", page.toString());
        queryParams.append("limit", limit.toString());
        if (search) queryParams.append("search", search);
        if (sortBy) queryParams.append("sortBy", sortBy);
        if (sortOrder) queryParams.append("sortOrder", sortOrder);
        if (filters?.brandIds?.length) queryParams.append("brandIds", filters.brandIds.join(","));
        if (filters?.categoryIds?.length) queryParams.append("categoryIds", filters.categoryIds.join(","));
        if (filters?.silhouetteIds?.length) queryParams.append("silhouetteIds", filters.silhouetteIds.join(","));
        if (filters?.genderIds?.length) queryParams.append("genderIds", filters.genderIds.join(","));

        const response = await authFetch(`/finance/items?${queryParams.toString()}`, { method: "GET" });
        const result = response.data;
        return result;
    } catch (error) {
        console.error("Get items error:", error);
        return { status: false, data: [], meta: { total: 0, page, limit, totalPages: 0 } };
    }
}

export async function getItemById(id: string) {
    try {
        const response = await authFetch(`/finance/items/${id}`, {
            method: "GET",
        });

        return response.data;
    } catch (error) {
        console.error("Get item error:", error);
        return { status: false, data: null };
    }
}

export async function getNextItemId() {
    try {
        const response = await authFetch(`/finance/items/next-id`, {
            method: "GET",
        });
        return response.data;
    } catch (error) {
        console.error("Get next item id error:", error);
        return { status: false, data: null };
    }
}

export async function updateItem(id: string, data: any) {
    try {
        const sanitizedData = sanitizeItemData(data);
        const response = await authFetch(`/finance/items/${id}`, {
            method: "PUT",
            body: JSON.stringify(sanitizedData),
        });

        const result = response.data;
        if (result.status) {
            revalidatePath("/erp/items/list");
        }
        return result;
    } catch (error) {
        console.error("Update item error:", error);
        return { status: false, message: "Failed to connect to server" };
    }
}

export async function deleteItem(id: string) {
    try {
        const response = await authFetch(`/finance/items/${id}`, {
            method: "DELETE",
        });

        const result = response.data;
        if (result.status) {
            revalidatePath("/erp/items/list");
        }
        return result;
    } catch (error) {
        console.error("Delete item error:", error);
        return { status: false, message: "Failed to connect to server" };
    }
}

// ─── Bulk Discount ────────────────────────────────────────────────────────────

export interface BulkDiscountItemOverride {
    id: string;
    discountRate?: number;
    discountAmount?: number;
}

export interface BulkDiscountPayload {
    campaignName: string;
    itemIds: string[];
    discountRate?: number;
    discountAmount?: number;
    discountStartDate?: string;
    discountEndDate?: string;
    clearDiscount?: boolean;
    notes?: string;
    locationIds?: string[];
    locationNames?: string[];
    overrides?: BulkDiscountItemOverride[];
    appliedById?: string;
}

export async function bulkApplyDiscount(payload: BulkDiscountPayload) {
    try {
        const response = await authFetch("/finance/items/bulk-discount", {
            method: "PATCH",
            body: JSON.stringify(payload),
        });
        const result = response.data;
        if (result?.status) {
            revalidatePath("/erp/items/list");
            revalidatePath("/erp/items/bulk-discount");
        }
        return result ?? { status: false, message: "No response from server" };
    } catch (error) {
        console.error("Bulk discount error:", error);
        return { status: false, message: "Failed to connect to server" };
    }
}

export async function rollbackCampaign(campaignId: string) {
    try {
        const response = await authFetch("/finance/items/campaigns/rollback", {
            method: "POST",
            body: JSON.stringify({ campaignId }),
        });
        const result = response.data;
        if (result?.status) {
            revalidatePath("/erp/items/list");
            revalidatePath("/erp/items/bulk-discount");
        }
        return result ?? { status: false, message: "No response from server" };
    } catch (error) {
        console.error("Rollback campaign error:", error);
        return { status: false, message: "Failed to connect to server" };
    }
}

export async function getDiscountCampaigns(page = 1, limit = 20) {
    try {
        const response = await authFetch(
            `/finance/items/campaigns?page=${page}&limit=${limit}`,
            { method: "GET" },
        );
        return response.data ?? { status: false, data: [], meta: {} };
    } catch (error) {
        console.error("Get campaigns error:", error);
        return { status: false, data: [], meta: {} };
    }
}

// ─── Fetch all item IDs matching a search (for select-all-pages) ──────────────

export async function getAllItemIds(
    search?: string,
    filters?: {
        brandIds?: string[];
        categoryIds?: string[];
        silhouetteIds?: string[];
        genderIds?: string[];
    },
): Promise<string[]> {
    try {
        const queryParams = new URLSearchParams();
        queryParams.append("page", "1");
        queryParams.append("limit", "10000");
        queryParams.append("sortBy", "createdAt");
        queryParams.append("sortOrder", "desc");
        if (search) queryParams.append("search", search);
        if (filters?.brandIds?.length) queryParams.append("brandIds", filters.brandIds.join(","));
        if (filters?.categoryIds?.length) queryParams.append("categoryIds", filters.categoryIds.join(","));
        if (filters?.silhouetteIds?.length) queryParams.append("silhouetteIds", filters.silhouetteIds.join(","));
        if (filters?.genderIds?.length) queryParams.append("genderIds", filters.genderIds.join(","));

        const response = await authFetch(`/finance/items?${queryParams.toString()}`, { method: "GET" });
        const result = response.data;
        if (result?.status && Array.isArray(result.data)) {
            return result.data.map((i: any) => i.id as string);
        }
        return [];
    } catch (error) {
        console.error("Get all item IDs error:", error);
        return [];
    }
}

export async function getDiscountCampaign(campaignId: string) {
    try {
        const response = await authFetch(
            `/finance/items/campaigns/${campaignId}`,
            { method: "GET" },
        );
        return response.data ?? { status: false, data: null };
    } catch (error) {
        console.error("Get campaign error:", error);
        return { status: false, data: null };
    }
}

// ─── Bulk Sale Price Update ───────────────────────────────────────────────────

export interface BulkSalePriceItemOverride {
    id: string;
    unitPrice: number;
}

export interface BulkSalePricePayload {
    campaignName: string;
    itemIds: string[];
    unitPrice?: number;
    overrides?: BulkSalePriceItemOverride[];
    notes?: string;
    appliedById?: string;
}

export async function bulkUpdateSalePrice(payload: BulkSalePricePayload) {
    try {
        const response = await authFetch("/finance/items/bulk-sale-price", {
            method: "PATCH",
            body: JSON.stringify(payload),
        });
        const result = response.data;
        if (result?.status) {
            revalidatePath("/erp/items/list");
        }
        return result ?? { status: false, message: "No response from server" };
    } catch (error) {
        console.error("Bulk sale price error:", error);
        return { status: false, message: "Failed to connect to server" };
    }
}
