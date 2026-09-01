'use server';

import { authFetch } from '@/lib/auth';

export interface EOBIEmployee {
    id: string;
    employeeId: string;
    employeeName: string;
    department: string;
    subDepartment: string;
    designation: string;
    employeeContribution: number;
    employerContribution: number;
    totalEOBIBalance: number;
    totalWithdrawn: number;
    availableBalance: number;
    lastContributionMonth: string;
    totalMonths: number;
}

// Get all EOBI employees with their balances
export async function getEOBIEmployees(): Promise<{ status: boolean; data?: EOBIEmployee[]; message?: string }> {
    try {
        const response = await authFetch(`/eobi/employees`, {
            method: 'GET',
        });

        const result = response.data;

        if (!response.ok) {
            return {
                status: false,
                message: result.message || `HTTP error! status: ${response.status}`
            };
        }

        return result;
    } catch (error) {
        console.error('Error fetching EOBI employees:', error);
        return {
            status: false,
            message: error instanceof Error ? error.message : 'An unexpected error occurred',
        };
    }
}

// Get single employee EOBI balance
export async function getEmployeeEOBIBalance(employeeId: string): Promise<{
    status: boolean;
    data?: { totalEOBIBalance: number; totalWithdrawn: number; availableBalance: number };
    message?: string;
}> {
    try {
        const result = await getEOBIEmployees();
        if (!result.status || !result.data) {
            return { status: false, message: result.message };
        }
        const employee = result.data.find((e) => e.id === employeeId);
        if (!employee) {
            return { status: false, message: 'Employee not found' };
        }
        return {
            status: true,
            data: {
                totalEOBIBalance: employee.totalEOBIBalance,
                totalWithdrawn: employee.totalWithdrawn,
                availableBalance: employee.availableBalance,
            },
        };
    } catch (error) {
        return {
            status: false,
            message: error instanceof Error ? error.message : 'An unexpected error occurred',
        };
    }
}
