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