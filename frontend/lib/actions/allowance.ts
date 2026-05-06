"use server";
import { authFetch } from "@/lib/auth";

export interface AllowanceHead {
  id: string;
  name: string;
  calculationType?: string; // "Amount" | "Percentage"
  amount?: number | null;
  percentage?: number | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Allowance {
  id: string;
  employeeId: string;
  employeeName?: string;
  employee?: {
    id: string;
    employeeId: string;
    employeeName: string;
    department?: {
      id: string;
      name: string;
    };
    subDepartment?: {
      id: string;
      name: string;
    };
  };
  allowanceHeadId: string;
  allowanceHeadName?: string;
  allowanceHead?: {
    id: string;
    name: string;
  };
  amount: number | string;
  date: string;
  month?: string;
  year?: string;
  type?: string; // "recurring" | "specific"
  paymentMethod?: string; // "with_salary" | "separately"
  adjustmentMethod?: string; // "distributed-remaining-months" | "deduct-current-month"
  isTaxable?: boolean;
  taxPercentage?: number | string | null;
  notes?: string;
  status?: string;
  createdById?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  id: string;
  employeeId: string;
  employeeName: string;
  designation?: string;
  department?: string;
}

// Get all allowance heads
export async function getAllowanceHeads(): Promise<{ status: boolean; data?: AllowanceHead[]; message?: string }> {
  try {
    const res = await authFetch(`/allowance-heads`, {});
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to fetch allowance heads" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error fetching allowance heads:", error);
    return {
      status: false,
      message: error instanceof Error ? error.message : "Failed to fetch allowance heads. Please check your connection.",
    };
  }
}

// Get employees for dropdown
export async function getEmployeesForAllowance(): Promise<{ status: boolean; data?: Employee[]; message?: string }> {
  try {
    const res = await authFetch(`/employees?status=active&select=id,employeeId,employeeName,designation,department`, {});
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to fetch employees" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error fetching employees:", error);
    return {
      status: false,
      message: error instanceof Error ? error.message : "Failed to fetch employees. Please check your connection.",
    };
  }
}

// Create allowance (single)
export async function createAllowance(data: {
  employeeId: string;
  allowanceHeadId: string;
  amount: number;
  date: string;
  month?: string;
  year?: string;
  notes?: string;
  isTaxable?: boolean;
  taxPercentage?: number;
}): Promise<{ status: boolean; data?: Allowance; message?: string }> {
  try {
    const res = await authFetch(`/allowances`, {
      method: "POST",
      body: JSON.stringify({
        month: data.month,
        year: data.year,
        date: data.date,
        allowances: [
          {
            employeeId: data.employeeId,
            allowanceHeadId: data.allowanceHeadId,
            amount: data.amount,
            notes: data.notes,
            isTaxable: data.isTaxable,
            taxPercentage: data.taxPercentage,
          },
        ],
      }),
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to create allowance" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    const result = res.data;
    return { status: result.status, data: result.data?.[0], message: result.message };
  } catch (error) {
    console.error("Error creating allowance:", error);
    return { status: false, message: error instanceof Error ? error.message : "Failed to create allowance" };
  }
}

// Bulk create allowances
export async function bulkCreateAllowances(data: {
  month: string;
  year: string;
  date: string;
  allowances: Array<{
    employeeId: string;
    allowanceHeadId: string;
    amount: number;
    type?: string; // "recurring" | "specific"
    notes?: string;
    isTaxable?: boolean;
    taxPercentage?: number;
  }>;
}): Promise<{ status: boolean; data?: Allowance[]; message?: string }> {
  try {
    const res = await authFetch(`/allowances/bulk`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to create allowances" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error creating allowances:", error);
    return { status: false, message: error instanceof Error ? error.message : "Failed to create allowances" };
  }
}

// Get all allowances
export async function getAllowances(params?: {
  employeeId?: string;
  allowanceHeadId?: string;
  month?: string;
  year?: string;
}): Promise<{ status: boolean; data?: Allowance[]; message?: string }> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.employeeId) queryParams.append("employeeId", params.employeeId);
    if (params?.allowanceHeadId) queryParams.append("allowanceHeadId", params.allowanceHeadId);
    if (params?.month) queryParams.append("month", params.month);
    if (params?.year) queryParams.append("year", params.year);
    const res = await authFetch(`/allowances?${queryParams.toString()}`, {});
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to fetch allowances" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error fetching allowances:", error);
    return {
      status: false,
      message: error instanceof Error ? error.message : "Failed to fetch allowances. Please check your connection.",
    };
  }
}

// Update allowance
export async function updateAllowance(
  id: string,
  data: {
    employeeId?: string;
    allowanceHeadId?: string;
    amount?: number;
    type?: string; // "recurring" | "specific"
    adjustmentMethod?: string; // "distributed-remaining-months" | "deduct-current-month"
    date?: string;
    month?: string;
    year?: string;
    notes?: string;
    isTaxable?: boolean;
    taxPercentage?: number | null;
    status?: string;
  }
): Promise<{ status: boolean; data?: Allowance; message?: string }> {
  try {
    const res = await authFetch(`/allowances/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to update allowance" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error updating allowance:", error);
    return { status: false, message: error instanceof Error ? error.message : "Failed to update allowance" };
  }
}

// Delete allowance
export async function deleteAllowance(id: string): Promise<{ status: boolean; message?: string }> {
  try {
    const res = await authFetch(`/allowances/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to delete allowance" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error deleting allowance:", error);
    return { status: false, message: error instanceof Error ? error.message : "Failed to delete allowance" };
  }
}