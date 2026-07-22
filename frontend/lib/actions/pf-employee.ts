'use server';

import { authFetch } from '@/lib/auth';

export interface PFEmployee {
    id: string;
    employeeId: string;
    employeeName: string;
    department: string;
    subDepartment: string;
    designation: string;
    employeeContribution: number;
    employerContribution: number;
    totalPFBalance: number;
    totalWithdrawn: number;
    availableBalance: number;
    lastContributionMonth: string;
    totalMonths: number;
}

// Get all PF employees with their balances
export async function getPFEmployees(): Promise<{ status: boolean; data?: PFEmployee[]; message?: string }> {
    try {
        const response = await authFetch(`/pf/employees`, {
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
        console.error('Error fetching PF employees:', error);
        return {
            status: false,
            message: error instanceof Error ? error.message : 'An unexpected error occurred',
        };
    }
}

// Get single employee PF balance
export async function getEmployeePFBalance(employeeId: string): Promise<{
    status: boolean;
    data?: { totalPFBalance: number; totalWithdrawn: number; availableBalance: number };
    message?: string;
}> {
    try {
        const result = await getPFEmployees();
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
                totalPFBalance: employee.totalPFBalance,
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