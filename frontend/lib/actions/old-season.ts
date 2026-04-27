"use server";

import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface OldSeason {
  id: string;
  name: string;
  status: string;
  createdBy?: string;
  createdById?: string;
  createdAt: string;
  updatedAt: string;
}

export async function getOldSeasons(): Promise<{ status: boolean; data: OldSeason[]; message?: string }> {
  try {
    const res = await authFetch("/master/erp/old-season", {
      cache: "no-store",
    });
    if (!res.ok) {
      return { status: false, data: [], message: "Failed to fetch old seasons" };
    }
    return res.data;
  } catch (error) {
    console.error("Failed to fetch old seasons:", error);
    return { status: false, data: [], message: "Failed to fetch old seasons" };
  }
}

export async function createOldSeasons(items: { name: string; status?: string }[]): Promise<{ status: boolean; message: string }> {
  try {
    const res = await authFetch("/master/erp/old-season", {
      method: "POST",
      body: JSON.stringify({ items }),
    });
    if (!res.ok) {
      return { status: false, message: "Failed to create old seasons" };
    }
    return res.data;
  } catch (error) {
    console.error("Failed to create old seasons:", error);
    return { status: false, message: "Failed to create old seasons" };
  }
}

export async function updateOldSeason(id: string, data: { name?: string; status?: string }): Promise<{ status: boolean; message: string }> {
  try {
    const res = await authFetch(`/master/erp/old-season/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    revalidatePath("/master/old-season/list");
    if (!res.ok) {
      return { status: false, message: "Failed to update old season" };
    }
    return res.data;
  } catch (error) {
    console.error("Failed to update old season:", error);
    return { status: false, message: "Failed to update old season" };
  }
}

export async function deleteOldSeason(id: string): Promise<{ status: boolean; message: string }> {
  try {
    const res = await authFetch(`/master/erp/old-season/${id}`, {
      method: "DELETE",
    });
    revalidatePath("/master/old-season/list");
    if (!res.ok) {
      return { status: false, message: "Failed to delete old season" };
    }
    return res.data;
  } catch (error) {
    console.error("Failed to delete old season:", error);
    return { status: false, message: "Failed to delete old season" };
  }
}

export async function bulkUpdateOldSeasons(items: { id: string; name: string; status?: string }[]): Promise<{ status: boolean; message: string }> {
  try {
    const res = await authFetch(`/master/erp/old-season/bulk`, {
      method: "PUT",
      body: JSON.stringify({ items }),
    });
    revalidatePath("/master/old-season/list");
    if (!res.ok) {
      return { status: false, message: "Failed to bulk update old seasons" };
    }
    return res.data;
  } catch (error) {
    console.error("Failed to bulk update old seasons:", error);
    return { status: false, message: "Failed to bulk update old seasons" };
  }
}

export async function bulkDeleteOldSeasons(ids: string[]): Promise<{ status: boolean; message: string }> {
  try {
    const res = await authFetch(`/master/erp/old-season/bulk`, {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
    revalidatePath("/master/old-season/list");
    if (!res.ok) {
      return { status: false, message: "Failed to bulk delete old seasons" };
    }
    return res.data;
  } catch (error) {
    console.error("Failed to bulk delete old seasons:", error);
    return { status: false, message: "Failed to bulk delete old seasons" };
  }
}
