"use server";
import { authFetch } from "@/lib/auth"; import { revalidatePath } from "next/cache";
// Removed BACKEND_URL definition as authFetch handles the base URL

export async function previewPayroll(data: {
    month: string;
    year: string;
    employeeIds?: string[];
}) {
    try {
        const response = await authFetch("/payroll/preview", {
            method: "POST",
            body: JSON.stringify(data),
        });

        const result = response.data;

        if (!response.ok) {
            return {
                status: false,
                message: result.message || "Failed to preview payroll",
            };
        }

        return {
            status: true,
            message: "Payroll preview generated",
            data: result,
        };
    } catch (error) {
        console.error("Preview payroll error:", error);
        return {
            status: false,
            message: "An error occurred while previewing payroll",
        };
    }
}

export async function confirmPayroll(data: {
    month: string;
    year: string;
    generatedBy: string;
    details: any[];
}) {
    try {
        const response = await authFetch("/payroll/confirm", {
            method: "POST",
            body: JSON.stringify(data),
        });

        const result = response.data;

        if (!response.ok) {
            return {
                status: false,
                message: result.message || "Failed to confirm payroll",
            };
        }

        revalidatePath("/hr/payroll");
        return {
            status: true,
            message: "Payroll confirmed and saved successfully",
            data: result,
        };
    } catch (error) {
        console.error("Confirm payroll error:", error);
        return {
            status: false,
            message: "An error occurred while confirming payroll",
        };
    }
}

export async function getPayrollReport(filters: {
    month?: string;
    year?: string;
    departmentId?: string;
    subDepartmentId?: string;
    employeeId?: string;
}) {
    try {
        const queryParams = new URLSearchParams();
        if (filters.month && filters.month !== 'all') queryParams.append("month", filters.month);
        if (filters.year && filters.year !== 'all') queryParams.append("year", filters.year);
        if (filters.departmentId && filters.departmentId !== 'all') queryParams.append("departmentId", filters.departmentId);
        if (filters.subDepartmentId && filters.subDepartmentId !== 'all') queryParams.append("subDepartmentId", filters.subDepartmentId);
        if (filters.employeeId && filters.employeeId !== 'all') queryParams.append("employeeId", filters.employeeId);

        const response = await authFetch(`/payroll/report?${queryParams.toString()}`, {
            method: "GET",
        });

        const result = response.data;

        if (!response.ok) {
            return {
                status: false,
                message: result.message || "Failed to fetch payroll report",
            };
        }

        return {
            status: true,
            data: result,
        };
    } catch (error) {
        console.error("Get payroll report error:", error);
        return {
            status: false,
            message: "An error occurred while fetching payroll report",
        };
    }
}

export async function getBankReport(filters: {
    month: string;
    year: string;
    bankName: string;
}) {
    try {
        const queryParams = new URLSearchParams({
            month: filters.month,
            year: filters.year,
            bankName: filters.bankName,
        });

        const response = await authFetch(`/payroll/bank-report?${queryParams.toString()}`, {
            method: "GET",
        });

        const result = response.data;

        if (!response.ok) {
            return {
                status: false,
                message: result.message || "Failed to fetch bank report",
            };
        }

        return {
            status: true,
            data: result,
        };
    } catch (error) {
        console.error("Get bank report error:", error);
        return {
            status: false,
            message: "An error occurred while fetching bank report",
        };
    }
}

export async function getPayslips(filters: {
    month?: string;
    year?: string;
    departmentId?: string;
    subDepartmentId?: string;
    employeeId?: string;
}) {
    try {
        const queryParams = new URLSearchParams();
        if (filters.month && filters.month !== 'all') queryParams.append("month", filters.month);
        if (filters.year && filters.year !== 'all') queryParams.append("year", filters.year);
        if (filters.departmentId && filters.departmentId !== 'all') queryParams.append("departmentId", filters.departmentId);
        if (filters.subDepartmentId && filters.subDepartmentId !== 'all') queryParams.append("subDepartmentId", filters.subDepartmentId);
        if (filters.employeeId && filters.employeeId !== 'all') queryParams.append("employeeId", filters.employeeId);

        const response = await authFetch(`/payroll/payslips?${queryParams.toString()}`, {
            method: "GET",
        });

        const result = response.data;

        if (!response.ok) {
            return {
                status: false,
                message: result.message || "Failed to fetch payslips",
            };
        }

        return {
            status: true,
            data: result,
        };
    } catch (error) {
        console.error("Get payslips error:", error);
        return {
            status: false,
            message: "An error occurred while fetching payslips",
        };
    }
}

export async function getPayslipDetail(detailId: string) {
    try {
        const response = await authFetch(`/payroll/payslip/${detailId}`, {
            method: "GET",
        });

        const result = response.data;

        if (!response.ok) {
            return {
                status: false,
                message: result.message || "Failed to fetch payslip details",
            };
        }

        return {
            status: true,
            data: result,
        };
    } catch (error) {
        console.error("Get payslip detail error:", error);
        return {
            status: false,
            message: "An error occurred while fetching payslip details",
        };
    }
}