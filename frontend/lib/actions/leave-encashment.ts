"use server";
import { authFetch } from "@/lib/auth";

export interface LeaveEncashment {
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
  encashmentDate: string;
  encashmentDays: number | string;
  encashmentAmount: number | string;
  paymentMonth: string;
  paymentYear: string;
  paymentMonthYear: string;
  grossSalary?: number | string | null;
  annualSalary?: number | string | null;
  perDayAmount?: number | string | null;
  approvalStatus: string; // pending, approved, rejected
  approvedById?: string;
  approvedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  approvedAt?: string;
  rejectionReason?: string;
  status: string; // pending, active, completed, cancelled, rejected
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

// Get all leave encashments
export async function getLeaveEncashments(params?: {
  employeeId?: string;
  paymentMonth?: string;
  paymentYear?: string;
  paymentMonthYear?: string;
  approvalStatus?: string;
  status?: string;
}): Promise<{ status: boolean; data?: LeaveEncashment[]; message?: string }> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.employeeId) queryParams.append("employeeId", params.employeeId);
    if (params?.paymentMonth) queryParams.append("paymentMonth", params.paymentMonth);
    if (params?.paymentYear) queryParams.append("paymentYear", params.paymentYear);
    if (params?.paymentMonthYear) queryParams.append("paymentMonthYear", params.paymentMonthYear);
    if (params?.approvalStatus) queryParams.append("approvalStatus", params.approvalStatus);
    if (params?.status) queryParams.append("status", params.status);
    const res = await authFetch(`/leave-encashments?${queryParams.toString()}`, {});
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to fetch leave encashments" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error fetching leave encashments:", error);
    return {
      status: false,
      message: error instanceof Error ? error.message : "Failed to fetch leave encashments. Please check your connection.",
    };
  }
}

// Get single leave encashment
export async function getLeaveEncashmentById(id: string): Promise<{ status: boolean; data?: LeaveEncashment; message?: string }> {
  try {
    const res = await authFetch(`/leave-encashments/${id}`, {});
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to fetch leave encashment" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error fetching leave encashment:", error);
    return {
      status: false,
      message: error instanceof Error ? error.message : "Failed to fetch leave encashment. Please check your connection.",
    };
  }
}

// Create leave encashment (supports multiple employees)
export async function createLeaveEncashment(data: {
  leaveEncashments: Array<{
    employeeId: string;
    encashmentDate: string;
    encashmentDays: number;
    encashmentAmount: number;
    paymentMonthYear: string;
    grossSalary?: number;
    annualSalary?: number;
    perDayAmount?: number;
  }>;
}): Promise<{ status: boolean; data?: LeaveEncashment[]; message?: string }> {
  try {
    // Parse paymentMonthYear (format: "YYYY-MM")
    const leaveEncashments = data.leaveEncashments.map((item) => {
      const [year, month] = item.paymentMonthYear.split("-");
      return {
        employeeId: item.employeeId,
        encashmentDate: item.encashmentDate,
        encashmentDays: item.encashmentDays,
        encashmentAmount: item.encashmentAmount,
        paymentMonth: month.padStart(2, "0"),
        paymentYear: year,
        paymentMonthYear: item.paymentMonthYear,
        grossSalary: item.grossSalary,
        annualSalary: item.annualSalary,
        perDayAmount: item.perDayAmount,
      };
    });
    const res = await authFetch(`/leave-encashments`, {
      method: "POST",
      body: JSON.stringify({
        leaveEncashments,
      }),
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to create leave encashment" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error creating leave encashment:", error);
    return { status: false, message: error instanceof Error ? error.message : "Failed to create leave encashment" };
  }
}

// Update leave encashment
export async function updateLeaveEncashment(
  id: string,
  data: {
    encashmentDate?: string;
    encashmentDays?: number;
    encashmentAmount?: number;
    paymentMonthYear?: string;
    grossSalary?: number;
    annualSalary?: number;
    perDayAmount?: number;
    status?: string;
  }
): Promise<{ status: boolean; data?: LeaveEncashment; message?: string }> {
  try {
    const updateData: any = {};
    if (data.encashmentDate !== undefined) updateData.encashmentDate = data.encashmentDate;
    if (data.encashmentDays !== undefined) updateData.encashmentDays = data.encashmentDays;
    if (data.encashmentAmount !== undefined) updateData.encashmentAmount = data.encashmentAmount;
    if (data.grossSalary !== undefined) updateData.grossSalary = data.grossSalary;
    if (data.annualSalary !== undefined) updateData.annualSalary = data.annualSalary;
    if (data.perDayAmount !== undefined) updateData.perDayAmount = data.perDayAmount;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.paymentMonthYear !== undefined) {
      const [year, month] = data.paymentMonthYear.split("-");
      updateData.paymentMonth = month.padStart(2, "0");
      updateData.paymentYear = year;
      updateData.paymentMonthYear = data.paymentMonthYear;
    }
    const res = await authFetch(`/leave-encashments/${id}`, {
      method: "PUT",
      body: JSON.stringify(updateData),
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to update leave encashment" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error updating leave encashment:", error);
    return { status: false, message: error instanceof Error ? error.message : "Failed to update leave encashment" };
  }
}

// Approve leave encashment
export async function approveLeaveEncashment(id: string): Promise<{ status: boolean; data?: LeaveEncashment; message?: string }> {
  try {
    const res = await authFetch(`/leave-encashments/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to approve leave encashment" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error approving leave encashment:", error);
    return { status: false, message: error instanceof Error ? error.message : "Failed to approve leave encashment" };
  }
}

// Reject leave encashment
export async function rejectLeaveEncashment(id: string, rejectionReason?: string): Promise<{ status: boolean; data?: LeaveEncashment; message?: string }> {
  try {
    const res = await authFetch(`/leave-encashments/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ rejectionReason }),
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to reject leave encashment" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error rejecting leave encashment:", error);
    return { status: false, message: error instanceof Error ? error.message : "Failed to reject leave encashment" };
  }
}

// Delete leave encashment
export async function deleteLeaveEncashment(id: string): Promise<{ status: boolean; message?: string }> {
  try {
    const res = await authFetch(`/leave-encashments/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to delete leave encashment" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error deleting leave encashment:", error);
    return { status: false, message: error instanceof Error ? error.message : "Failed to delete leave encashment" };
  }
}