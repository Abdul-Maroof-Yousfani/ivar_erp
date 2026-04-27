"use server";
import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface JobType {
  id: string;
  name: string;
  status: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export async function getJobTypes(): Promise<{ status: boolean; data: JobType[]; message?: string }> {
  try {
    const res = await authFetch(`/job-types`, {});
    if (!res.ok) {
      return { status: false, data: [], message: "Failed to fetch job types" };
    }
    return res.data;
  } catch (error) {
    console.error("Failed to fetch job types:", error);
    return { status: false, data: [], message: "Failed to fetch job types" };
  }
}

export async function getJobTypeById(id: string): Promise<{ status: boolean; data: JobType | null }> {
  try {
    const res = await authFetch(`/job-types/${id}`, {});
    if (!res.ok) {
      return { status: false, data: null };
    }
    return res.data;
  } catch (error) {
    console.error("Failed to fetch job type:", error);
    return { status: false, data: null };
  }
}

export async function createJobType(formData: FormData): Promise<{ status: boolean; message: string; data?: JobType }> {
  const name = formData.get("name") as string;
  if (!name?.trim()) {
    return { status: false, message: "Name is required" };
  }
  try {
    const res = await authFetch(`/job-types`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    const data = res.data;
    if (data.status) {
      revalidatePath("/master/job-type");
    }
    return data;
  } catch (error) {
    return { status: false, message: "Failed to create job type" };
  }
}

export async function createJobTypes(names: string[]): Promise<{ status: boolean; message: string }> {
  if (!names.length) {
    return { status: false, message: "At least one name is required" };
  }
  try {
    const res = await authFetch(`/job-types/bulk`, {
      method: "POST",
      body: JSON.stringify({ names }),
    });
    const data = res.data;
    if (data.status) {
      revalidatePath("/master/job-type");
    }
    return data;
  } catch (error) {
    return { status: false, message: "Failed to create job types" };
  }
}

export async function updateJobType(id: string, formData: FormData): Promise<{ status: boolean; message: string; data?: JobType }> {
  const name = formData.get("name") as string;
  if (!name?.trim()) {
    return { status: false, message: "Name is required" };
  }
  try {
    const res = await authFetch(`/job-types/${id}`, {
      method: "PUT",
      body: JSON.stringify({ id, name }),
    });
    const data = res.data;
    if (data.status) {
      revalidatePath("/master/job-type");
    }
    return data;
  } catch (error) {
    return { status: false, message: "Failed to update job type" };
  }
}

export async function deleteJobType(id: string): Promise<{ status: boolean; message: string }> {
  try {
    const res = await authFetch(`/job-types/${id}`, {
      method: "DELETE",
    });
    const data = res.data;
    if (data.status) {
      revalidatePath("/master/job-type");
    }
    return data;
  } catch (error) {
    return { status: false, message: "Failed to delete job type" };
  }
}

export async function deleteJobTypes(ids: string[]): Promise<{ status: boolean; message: string }> {
  if (!ids.length) {
    return { status: false, message: "No items to delete" };
  }
  try {
    const res = await authFetch(`/job-types/bulk`, {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    });
    const data = res.data;
    if (data.status) {
      revalidatePath("/master/job-type");
    }
    return data;
  } catch (error) {
    return { status: false, message: "Failed to delete job types" };
  }
}

export async function updateJobTypes(items: { id: string; name: string }[]): Promise<{ status: boolean; message: string }> {
  if (!items.length) {
    return { status: false, message: "No items to update" };
  }
  try {
    const res = await authFetch(`/job-types/bulk`, {
      method: "PUT",
      body: JSON.stringify({ items }),
    });
    const data = res.data;
    if (data.status) {
      revalidatePath("/master/job-type");
    }
    return data;
  } catch (error) {
    return { status: false, message: "Failed to update job types" };
  }
}