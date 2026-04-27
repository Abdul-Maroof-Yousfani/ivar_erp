"use server";
import { authFetch } from "@/lib/auth";

export interface PFWithdrawal {
    id: string;
    employeeId: string;
    employee: {
        id: string;
        employeeId: string;
        employeeName: string;
        department: {
            id: string;
            name: string;
        };
        subDepartment?: {
            id: string;
            name: string;
        };
    };
    withdrawalAmount: number;
    withdrawalDate: string;
    month: string;
    year: string;
    monthYear: string;
    reason?: string;
    approvalStatus: string;
    status: string;
    createdAt: string;
    createdBy?: {
        firstName: string;
        lastName: string;
    };
    approvedBy?: {
        firstName: string;
        lastName: string;
    };
}

// Create PF withdrawal
export async function createPFWithdrawal(data: {
    employeeId: string;
    withdrawalAmount: number;
    month: string;
    year: string;
    reason?: string;
}): Promise<{ status: boolean; data?: PFWithdrawal; message?: string }> {
    try {
        const response = await authFetch(`/pf/withdrawals`, {
            method: "POST",
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            const errorData = response.data || { message: "Failed to create PF withdrawal" };
            return { status: false, message: errorData.message || `HTTP error! status: ${response.status}` };
        }
        return response.data;
    } catch (error) {
        console.error("Error creating PF withdrawal:", error);
        return {
            status: false,
            message: error instanceof Error ? error.message : "An unexpected error occurred",
        };
    }
}

// Get all PF withdrawals
export async function getPFWithdrawals(filters?: any): Promise<{ status: boolean; data?: PFWithdrawal[]; message?: string }> {
    try {
        const queryParams = new URLSearchParams();
        if (filters) {
            Object.keys(filters).forEach(key => {
                if (filters[key]) {
                    queryParams.append(key, filters[key]);
                }
            });
        }
        const response = await authFetch(`/pf/withdrawals?${queryParams.toString()}`, {
            method: "GET",
        });
        if (!response.ok) {
            const errorData = response.data || { message: "Failed to fetch PF withdrawals" };
            return { status: false, message: errorData.message || `HTTP error! status: ${response.status}` };
        }
        return response.data;
    } catch (error) {
        console.error("Error fetching PF withdrawals:", error);
        return {
            status: false,
            message: error instanceof Error ? error.message : "An unexpected error occurred",
        };
    }
}