"use server";
import { authFetch } from "@/lib/auth";

export interface LoanRequest {
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
  loanTypeId: string;
  loanType?: {
    id: string;
    name: string;
  };
  amount: number | string;
  requestedDate: string;
  repaymentStartMonthYear?: string;
  numberOfInstallments?: number;
  reason: string;
  additionalDetails?: string;
  status: string; // 'pending' | 'approved' | 'rejected' | 'disbursed' | 'completed' | 'cancelled'
  approvalStatus: string; // 'pending' | 'approved' | 'rejected'
  paidAmount?: number;
  approvedById?: string;
  approvedBy?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  approvedAt?: string;
  rejectionReason?: string;
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

// Get all loan requests
export async function getLoanRequests(params?: {
  employeeId?: string;
  loanTypeId?: string;
  status?: string;
  approvalStatus?: string;
  requestedDate?: string;
  repaymentStartMonthYear?: string;
}): Promise<{ status: boolean; data?: LoanRequest[]; message?: string }> {
  try {
    const queryParams = new URLSearchParams();
    if (params?.employeeId) queryParams.append("employeeId", params.employeeId);
    if (params?.loanTypeId) queryParams.append("loanTypeId", params.loanTypeId);
    if (params?.status) queryParams.append("status", params.status);
    if (params?.approvalStatus) queryParams.append("approvalStatus", params.approvalStatus);
    if (params?.requestedDate) queryParams.append("requestedDate", params.requestedDate);
    if (params?.repaymentStartMonthYear) queryParams.append("repaymentStartMonthYear", params.repaymentStartMonthYear);
    const res = await authFetch(`/loan-requests?${queryParams.toString()}`, {});
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to fetch loan requests" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error fetching loan requests:", error);
    return {
      status: false,
      message: error instanceof Error ? error.message : "Failed to fetch loan requests. Please check your connection.",
    };
  }
}

// Get single loan request
export async function getLoanRequestById(id: string): Promise<{ status: boolean; data?: LoanRequest; message?: string }> {
  try {
    const res = await authFetch(`/loan-requests/${id}`, {});
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to fetch loan request" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error fetching loan request:", error);
    return {
      status: false,
      message: error instanceof Error ? error.message : "Failed to fetch loan request. Please check your connection.",
    };
  }
}

// Create loan request
export async function createLoanRequest(data: {
  employeeIds: string[];
  loanTypeId: string;
  amount: number;
  requestedDate: string;
  repaymentStartMonthYear?: string;
  numberOfInstallments?: number;
  reason: string;
  additionalDetails?: string;
}): Promise<{ status: boolean; data?: LoanRequest | LoanRequest[]; message?: string }> {
  try {
    const loanRequests = data.employeeIds.map((employeeId) => ({
      employeeId,
      loanTypeId: data.loanTypeId,
      amount: data.amount,
      requestedDate: data.requestedDate,
      repaymentStartMonthYear: data.repaymentStartMonthYear,
      numberOfInstallments: data.numberOfInstallments,
      reason: data.reason,
      additionalDetails: data.additionalDetails,
    }));
    const res = await authFetch(`/loan-requests`, {
      method: "POST",
      body: JSON.stringify({
        loanRequests,
      }),
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to create loan request" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error creating loan request:", error);
    return { status: false, message: error instanceof Error ? error.message : "Failed to create loan request" };
  }
}

// Update loan request
export async function updateLoanRequest(
  id: string,
  data: {
    loanTypeId?: string;
    amount?: number;
    requestedDate?: string;
    repaymentStartMonthYear?: string;
    numberOfInstallments?: number;
    reason?: string;
    additionalDetails?: string;
    status?: string;
  }
): Promise<{ status: boolean; data?: LoanRequest; message?: string }> {
  try {
    const res = await authFetch(`/loan-requests/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to update loan request" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error updating loan request:", error);
    return { status: false, message: error instanceof Error ? error.message : "Failed to update loan request" };
  }
}

// Approve loan request
export async function approveLoanRequest(id: string): Promise<{ status: boolean; data?: LoanRequest; message?: string }> {
  try {
    const res = await authFetch(`/loan-requests/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to approve loan request" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error approving loan request:", error);
    return { status: false, message: error instanceof Error ? error.message : "Failed to approve loan request" };
  }
}

// Reject loan request
export async function rejectLoanRequest(id: string, rejectionReason?: string): Promise<{ status: boolean; data?: LoanRequest; message?: string }> {
  try {
    const res = await authFetch(`/loan-requests/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ rejectionReason }),
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to reject loan request" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error rejecting loan request:", error);
    return { status: false, message: error instanceof Error ? error.message : "Failed to reject loan request" };
  }
}

// Delete loan request
export async function deleteLoanRequest(id: string): Promise<{ status: boolean; message?: string }> {
  try {
    const res = await authFetch(`/loan-requests/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const errorData = res.data || { message: "Failed to delete loan request" };
      return { status: false, message: errorData.message || `HTTP error! status: ${res.status}` };
    }
    return res.data;
  } catch (error) {
    console.error("Error deleting loan request:", error);
    return { status: false, message: error instanceof Error ? error.message : "Failed to delete loan request" };
  }
}