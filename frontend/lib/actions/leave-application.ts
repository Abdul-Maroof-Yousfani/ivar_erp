"use server";
import { authFetch } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export interface LeaveBalance {
  id: string;
  leaveTypeId: string;
  leaveTypeName: string;
  totalLeaves: number;
  usedLeaves: number;
  remainingLeaves: number;
}

export interface EmployeeLeaveInfo {
  employeeId: string;
  employeeName: string;
  leavePolicyId: string;
  leavePolicyName: string;
  leaveBalances: LeaveBalance[];
  totalTaken: number;
  totalRemaining: number;
}

export interface CreateLeaveApplicationData {
  employeeId: string;
  leaveTypeId: string;
  dayType: "fullDay" | "halfDay" | "shortLeave";
  fromDate: string;
  toDate: string;
  reasonForLeave: string;
  addressWhileOnLeave: string;
}

// Get employee leave balance
export async function getEmployeeLeaveBalance(employeeId: string): Promise<{ status: boolean; data?: EmployeeLeaveInfo; message?: string }> {
  try {
    const res = await authFetch(`/leave-applications/balance/${employeeId}`, {});
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to fetch leave balance" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    const result = res.data;
    if (result.status && result.data) {
      return { status: true, data: result.data };
    }
    return { status: false, message: result.message || "Failed to fetch leave balance" };
  } catch (error) {
    console.error("Error fetching leave balance:", error);
    return {
      status: false,
      message: error instanceof Error ? error.message : "Failed to fetch leave balance",
    };
  }
}

// Create leave application
export async function createLeaveApplication(data: CreateLeaveApplicationData): Promise<{ status: boolean; data?: any; message?: string }> {
  try {
    const res = await authFetch(`/leave-applications`, {
      method: "POST",
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to create leave application" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    const result = res.data;
    if (result.status && result.data) {
      revalidatePath("/hr/leaves/requests");
      return { status: true, data: result.data };
    }
    return { status: false, message: result.message || "Failed to create leave application" };
  } catch (error) {
    console.error("Error creating leave application:", error);
    return {
      status: false,
      message: error instanceof Error ? error.message : "Failed to create leave application",
    };
  }
}
