"use server";
import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export type OvertimeType = "weekday" | "holiday";

export interface OvertimeRequest {
  id: string;
  employeeId: string;
  employeeName?: string;
  employeeCode?: string;
  overtimeType: OvertimeType;
  title: string;
  description: string;
  date: string;
  weekdayOvertimeHours: number;
  holidayOvertimeHours: number;
  status?: string;
  approval1?: string;
  approval2?: string;
  createdById?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOvertimeRequestData {
  employeeId: string;
  overtimeType: OvertimeType;
  title: string;
  description: string;
  date: string;
  weekdayOvertimeHours: number;
  holidayOvertimeHours: number;
}

export interface UpdateOvertimeRequestData {
  employeeId?: string;
  overtimeType?: OvertimeType;
  title?: string;
  description?: string;
  date?: string;
  weekdayOvertimeHours?: number;
  holidayOvertimeHours?: number;
  status?: string;
}

// Create overtime request
export async function createOvertimeRequest(
  data: CreateOvertimeRequestData
): Promise<{ status: boolean; data?: OvertimeRequest; message?: string }> {
  try {
    const res = await authFetch(`/overtime-requests`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to create overtime request" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    const result = res.data;
    revalidatePath("/hr/payroll-setup/overtime");
    return { status: result.status, data: result.data, message: result.message };
  } catch (error) {
    console.error("Error creating overtime request:", error);
    return { status: false, message: error instanceof Error ? error.message : "Failed to create overtime request" };
  }
}

// Get all overtime requests
export async function getOvertimeRequests(params?: {
  employeeId?: string;
  overtimeType?: OvertimeType;
  status?: string;
  startDate?: string;
  endDate?: string;
}): Promise<{ status: boolean; data?: OvertimeRequest[]; message?: string }> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.employeeId) queryParams.append("employeeId", params.employeeId);
    if (params?.overtimeType) queryParams.append("overtimeType", params.overtimeType);
    if (params?.status) queryParams.append("status", params.status);
    if (params?.startDate) queryParams.append("startDate", params.startDate);
    if (params?.endDate) queryParams.append("endDate", params.endDate);
    const res = await authFetch(`/overtime-requests?${queryParams.toString()}`, {});
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to fetch overtime requests" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error fetching overtime requests:", error);
    return {
      status: false,
      message: error instanceof Error ? error.message : "Failed to fetch overtime requests. Please check your connection.",
    };
  }
}

// Get overtime request by ID
export async function getOvertimeRequestById(
  id: string
): Promise<{ status: boolean; data?: OvertimeRequest; message?: string }> {
  try {
    const res = await authFetch(`/overtime-requests/${id}`, {});
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to fetch overtime request" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error fetching overtime request:", error);
    return {
      status: false,
      message: error instanceof Error ? error.message : "Failed to fetch overtime request. Please check your connection.",
    };
  }
}

// Update overtime request
export async function updateOvertimeRequest(
  id: string,
  data: UpdateOvertimeRequestData
): Promise<{ status: boolean; data?: OvertimeRequest; message?: string }> {
  try {
    const res = await authFetch(`/overtime-requests/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to update overtime request" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    const result = res.data;
    revalidatePath("/hr/payroll-setup/overtime");
    return { status: result.status, data: result.data, message: result.message };
  } catch (error) {
    console.error("Error updating overtime request:", error);
    return { status: false, message: error instanceof Error ? error.message : "Failed to update overtime request" };
  }
}

// Delete overtime request
export async function deleteOvertimeRequest(id: string): Promise<{ status: boolean; message?: string }> {
  try {
    const res = await authFetch(`/overtime-requests/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to delete overtime request" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    const result = res.data;
    revalidatePath("/hr/payroll-setup/overtime");
    return { status: result.status, message: result.message };
  } catch (error) {
    console.error("Error deleting overtime request:", error);
    return { status: false, message: error instanceof Error ? error.message : "Failed to delete overtime request" };
  }
}