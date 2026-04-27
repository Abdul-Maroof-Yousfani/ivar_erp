"use server";
import { authFetch } from "@/lib/auth";

export interface AdvanceSalary {
  id: string;
  employeeId: string;
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
  amount: number | string;
  neededOn: string;
  deductionMonth: string;
  deductionYear: string;
  deductionMonthYear: string;
  reason: string;
  approvalStatus: string;
  approvedById?: string;
  approvedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  approvedAt?: string;
  rejectionReason?: string;
  status: string;
  createdById?: string;
  createdBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  updatedById?: string;
  updatedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

// Get all advance salaries
export async function getAdvanceSalaries(params?: {
  employeeId?: string;
  deductionMonth?: string;
  deductionYear?: string;
  deductionMonthYear?: string;
  approvalStatus?: string;
  status?: string;
}): Promise<{ status: boolean; data?: AdvanceSalary[]; message?: string }> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.employeeId) queryParams.append("employeeId", params.employeeId);
    if (params?.deductionMonth) queryParams.append("deductionMonth", params.deductionMonth);
    if (params?.deductionYear) queryParams.append("deductionYear", params.deductionYear);
    if (params?.deductionMonthYear) queryParams.append("deductionMonthYear", params.deductionMonthYear);
    if (params?.approvalStatus) queryParams.append("approvalStatus", params.approvalStatus);
    if (params?.status) queryParams.append("status", params.status);
    const res = await authFetch(`/advance-salaries?${queryParams.toString()}`, {});
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to fetch advance salaries" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error fetching advance salaries:", error);
    return {
      status: false,
      message: error instanceof Error ? error.message : "Failed to fetch advance salaries. Please check your connection.",
    };
  }
}

// Get single advance salary
export async function getAdvanceSalaryById(id: string): Promise<{ status: boolean; data?: AdvanceSalary; message?: string }> {
  try {
    const res = await authFetch(`/advance-salaries/${id}`, {});
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to fetch advance salary" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error fetching advance salary:", error);
    return {
      status: false,
      message: error instanceof Error ? error.message : "Failed to fetch advance salary. Please check your connection.",
    };
  }
}

// Create advance salary (supports multiple employees)
export async function createAdvanceSalary(data: {
  employeeIds: string[];
  amount: number;
  neededOn: string;
  deductionMonthYear: string;
  reason: string;
}): Promise<{ status: boolean; data?: AdvanceSalary[]; message?: string }> {
  try {
    const [year, month] = data.deductionMonthYear.split("-");
    const deductionMonth = month.padStart(2, "0");
    const deductionYear = year;
    const advanceSalaries = data.employeeIds.map((employeeId) => ({
      employeeId,
      amount: data.amount,
      neededOn: data.neededOn,
      deductionMonth,
      deductionYear,
      deductionMonthYear: data.deductionMonthYear,
      reason: data.reason,
    }));
    const res = await authFetch(`/advance-salaries`, {
      method: "POST",
      body: JSON.stringify({
        advanceSalaries,
      }),
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to create advance salary" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error creating advance salary:", error);
    return { status: false, message: error instanceof Error ? error.message : "Failed to create advance salary" };
  }
}

// Update advance salary
export async function updateAdvanceSalary(
  id: string,
  data: {
    amount?: number;
    neededOn?: string;
    deductionMonthYear?: string;
    reason?: string;
    status?: string;
  }
): Promise<{ status: boolean; data?: AdvanceSalary; message?: string }> {
  try {
    const updateData: any = {};
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.neededOn !== undefined) updateData.neededOn = data.neededOn;
    if (data.reason !== undefined) updateData.reason = data.reason;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.deductionMonthYear !== undefined) {
      const [year, month] = data.deductionMonthYear.split("-");
      updateData.deductionMonth = month.padStart(2, "0");
      updateData.deductionYear = year;
      updateData.deductionMonthYear = data.deductionMonthYear;
    }
    const res = await authFetch(`/advance-salaries/${id}`, {
      method: "PUT",
      body: JSON.stringify(updateData),
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to update advance salary" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error updating advance salary:", error);
    return { status: false, message: error instanceof Error ? error.message : "Failed to update advance salary" };
  }
}

// Approve advance salary
export async function approveAdvanceSalary(id: string): Promise<{ status: boolean; data?: AdvanceSalary; message?: string }> {
  try {
    const res = await authFetch(`/advance-salaries/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to approve advance salary" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error approving advance salary:", error);
    return { status: false, message: error instanceof Error ? error.message : "Failed to approve advance salary" };
  }
}

// Reject advance salary
export async function rejectAdvanceSalary(id: string, rejectionReason?: string): Promise<{ status: boolean; data?: AdvanceSalary; message?: string }> {
  try {
    const res = await authFetch(`/advance-salaries/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ rejectionReason }),
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to reject advance salary" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error rejecting advance salary:", error);
    return { status: false, message: error instanceof Error ? error.message : "Failed to reject advance salary" };
  }
}

// Delete advance salary
export async function deleteAdvanceSalary(id: string): Promise<{ status: boolean; message?: string }> {
  try {
    const res = await authFetch(`/advance-salaries/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to delete advance salary" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error deleting advance salary:", error);
    return { status: false, message: error instanceof Error ? error.message : "Failed to delete advance salary" };
  }
}